import type { ChipSet, Config, Result, StackChip, Warning } from './types';
import { clamp } from './math';
import { DEEP_BB, SHALLOW_BB } from './blinds';
import { minSmallChips } from './quality';
import { planCash } from './cash';
import { planTournament } from './tournament';
import { colorName, formatAmount, formatCents } from './format';
import type { Plan } from './plan';

// The one function the UI calls. Everything below it is pure. Give it a chip set and a
// config, get back a fully assembled Result: the stack, what each chip is worth, the
// leftovers, the blinds, and every warning worth surfacing, in plain words.

export * from './types';
export {
  PALETTE,
  PRESETS,
  STANDARD_300,
  cloneSet,
  colorHex,
  colorEdge,
  matchingPresetId,
} from './presets';
export { buildSummary } from './summary';
export { chipFace, colorName, formatAmount, formatCents, formatNumber, plural } from './format';
export { smallestChipOptions } from './cash';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
/** Fewer chips than this per player is not really a stack. */
const THIN_STACK_CHIPS = 12;

/** Sensible defaults for a fresh session: six friends, a $20 cash game. */
export const DEFAULT_CONFIG: Config = {
  players: 6,
  game: 'cash',
  buyInCents: 2000,
  smallestChipCents: null,
  startingStack: null,
  targetStackChips: 30,
  currency: '$',
};

interface CleanDenom {
  id: string;
  color: string;
  value: number;
  count: number;
}

function normalizeSet(set: ChipSet): CleanDenom[] {
  return set.denominations
    .filter(
      (d) =>
        Number.isFinite(d.value) &&
        d.value >= 1 &&
        Number.isFinite(d.count) &&
        d.count >= 0 &&
        Math.floor(d.count) === d.count,
    )
    .map((d) => ({ id: d.id, color: d.color, value: Math.floor(d.value), count: d.count }))
    .sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function emptyResult(config: Config, requested: number | null, warnings: Warning[]): Result {
  return {
    ok: false,
    game: config.game,
    perPlayer: [],
    stackValue: 0,
    requested,
    autoPicked: false,
    totalChipsPerPlayer: 0,
    leftover: [],
    rebuys: 0,
    blinds: null,
    warnings,
    quality: 0,
  };
}

export function calculate(chipSet: ChipSet, config: Config): Result {
  const warnings: Warning[] = [];
  const game = config.game === 'tournament' ? 'tournament' : 'cash';
  const symbol = config.currency || '$';
  const amount = (n: number): string => formatAmount(n, game, symbol);
  const denoms = normalizeSet(chipSet);

  const requested =
    game === 'cash'
      ? config.buyInCents !== null && config.buyInCents >= 1
        ? Math.round(config.buyInCents)
        : null
      : config.startingStack !== null && config.startingStack >= 1
        ? Math.floor(config.startingStack)
        : null;

  if (denoms.length === 0 || denoms.every((d) => d.count === 0)) {
    return emptyResult(config, requested, [
      { code: 'input', message: 'Add the chips in your case to get started.' },
    ]);
  }

  const players = clamp(Math.round(config.players) || MIN_PLAYERS, MIN_PLAYERS, MAX_PLAYERS);
  if (players !== config.players) {
    warnings.push({
      code: 'input',
      message: `Using ${players} players. ChipRatio handles ${MIN_PLAYERS} to ${MAX_PLAYERS}.`,
    });
  }

  if (game === 'cash' && requested === null) {
    return emptyResult(config, null, [
      { code: 'input', message: 'Enter how much each player buys in for.' },
    ]);
  }

  const values = denoms.map((d) => d.value);
  const counts = denoms.map((d) => d.count);
  const targetStackChips = config.targetStackChips > 0 ? config.targetStackChips : 30;

  let plan: Plan | null;
  if (game === 'cash') {
    const cash = planCash(
      values,
      counts,
      players,
      requested as number,
      config.smallestChipCents,
      targetStackChips,
    );
    if (cash?.pinIgnored) {
      warnings.push({
        code: 'chip-value-ignored',
        message: `A ${colorLabelFor(denoms[0].color)} chip can't be worth ${formatCents(config.smallestChipCents as number, symbol)} with these chip values (the others would land on fractions of a cent), so ChipRatio picked the chip values itself.`,
      });
    }
    plan = cash;
  } else {
    plan = planTournament(values, counts, players, requested, targetStackChips);
  }

  if (!plan) {
    return emptyResult(config, requested, [
      ...warnings,
      {
        code: 'not-enough-chips',
        message: `There aren't enough chips to give ${players} players a stack. Add chips or seat fewer players.`,
      },
    ]);
  }

  // --- Warnings, in the words a host would use ---------------------------------
  if (requested !== null && plan.adjusted) {
    const tooRich = requested > plan.capValue;
    const noun = game === 'cash' ? `${amount(requested)} buy-in` : `${amount(requested)} stack`;
    warnings.push({
      code: 'amount-adjusted',
      message: tooRich
        ? `Not enough chips for a ${noun} with ${players} players, so this uses ${amount(plan.stackValue)}. Add chips or seat fewer players to go higher.`
        : `These chips can't split a ${noun} evenly, so this uses ${amount(plan.stackValue)}, the closest even split.`,
    });
  }

  const blinds = plan.blinds;
  const depth = Math.round(blinds.startingBBDepth);
  if (blinds.startingBBDepth > 0 && blinds.startingBBDepth < SHALLOW_BB) {
    warnings.push({
      code: 'short-stack',
      message:
        game === 'cash'
          ? `Stacks start only ${depth} big blinds deep, so expect a lot of all-ins. A bigger buy-in or cheaper chips play better.`
          : `Stacks start only ${depth} big blinds deep, so expect a lot of all-ins early.`,
    });
  } else if (blinds.startingBBDepth > DEEP_BB) {
    warnings.push({
      code: 'deep-stack',
      message: `Stacks start ${depth} big blinds deep. That's a long, slow game. Fine if that's the plan.`,
    });
  }

  const totalChips = plan.x.reduce((a, b) => a + b, 0);
  const wantSmall = minSmallChips(blinds.big, plan.worth[0]);
  if (totalChips < THIN_STACK_CHIPS) {
    warnings.push({
      code: 'thin-stack',
      message: `Only ${totalChips} chips each. This case is small for ${players} players, so stacks will be thin. Seat fewer players or add chips.`,
    });
  } else if (plan.x[0] < wantSmall) {
    warnings.push({
      code: 'few-small-chips',
      message: `Only ${plan.x[0]} ${colorLabelFor(denoms[0].color)} chips each. Paying blinds and making change will be fiddly.`,
    });
  }

  // --- Assemble -------------------------------------------------------------------
  const cents = (i: number): number | null => (game === 'cash' ? plan.worth[i] : null);
  const perPlayer: StackChip[] = denoms
    .map((d, i) => ({
      denomId: d.id,
      color: d.color,
      value: d.value,
      count: plan.x[i],
      cents: cents(i),
    }))
    .filter((p) => p.count > 0);

  const leftCounts = denoms.map((d, i) => d.count - players * plan.x[i]);
  const leftover: StackChip[] = denoms
    .map((d, i) => ({
      denomId: d.id,
      color: d.color,
      value: d.value,
      count: leftCounts[i],
      cents: cents(i),
    }))
    .filter((p) => p.count > 0);

  let rebuys = Infinity;
  plan.x.forEach((c, i) => {
    if (c > 0) rebuys = Math.min(rebuys, Math.floor(leftCounts[i] / c));
  });

  return {
    ok: true,
    game,
    perPlayer,
    stackValue: plan.stackValue,
    requested,
    autoPicked: requested === null,
    totalChipsPerPlayer: totalChips,
    leftover,
    rebuys: Number.isFinite(rebuys) ? rebuys : 0,
    blinds,
    warnings,
    quality: plan.quality,
  };
}

function colorLabelFor(color: string): string {
  return colorName(color).toLowerCase();
}
