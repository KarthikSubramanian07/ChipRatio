import type { ChipSet, Config, PerPlayerChip, Result, UnevenSmall, Warning } from './types';
import { clamp } from './math';
import { allocate, type AllocationOptions, type UnevenSmall as InternalUneven } from './allocate';
import { deriveBlinds, DEEP_BB, SHALLOW_BB } from './blinds';
import { minSmallChips } from './quality';
import { mapMoney } from './money';
import { suggestBuyIn } from './suggest';

// The one function the UI calls. Everything below it is pure. Give it a chip set and a
// config, get back a fully assembled Result: the stack, the leftovers, the blinds, the
// money, and every warning worth surfacing.

// Re-exports only what the UI actually consumes through this barrel. Everything else
// (blinds helpers, presets types, summary options) is used directly from its own
// submodule by tests and scripts, so re-exporting it here again would just be dead API
// surface.
export * from './types';
export { PALETTE, PRESETS, STANDARD_300, cloneSet, colorHex, colorEdge } from './presets';
export { buildSummary } from './summary';
export { formatMoney, unevenSmallNote } from './format';

/** Sensible defaults for a fresh session. targetStackChips leans tournament (30-50/player). */
export const DEFAULT_CONFIG: Config = {
  players: 6,
  mode: 'suggest',
  buyIn: null,
  moneyBuyIn: null,
  targetStackChips: 30,
  allowUnevenSmallChips: false,
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
        d.value > 0 &&
        Number.isFinite(d.count) &&
        d.count >= 0 &&
        Math.floor(d.count) === d.count,
    )
    .map((d) => ({ id: d.id, color: d.color, value: Math.floor(d.value), count: d.count }))
    .sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function emptyResult(requestedBuyIn: number | null, warnings: Warning[]): Result {
  return {
    ok: false,
    perPlayer: [],
    stackValue: 0,
    requestedBuyIn,
    totalChipsPerPlayer: 0,
    leftover: [],
    unevenSmall: null,
    blinds: null,
    money: null,
    suggestion: null,
    warnings,
    quality: 0,
  };
}

function publicUneven(u: InternalUneven | null, denoms: CleanDenom[]): UnevenSmall | null {
  if (!u) return null;
  return { denomId: denoms[u.index].id, extraPlayers: u.extraPlayers, baseCount: u.baseCount };
}

export function calculate(chipSet: ChipSet, config: Config): Result {
  const warnings: Warning[] = [];
  const denoms = normalizeSet(chipSet);

  if (denoms.length === 0) {
    return emptyResult(config.buyIn, [
      { code: 'input', message: 'Add at least one chip denomination to get started.' },
    ]);
  }

  const players = clamp(Math.round(config.players), 2, 10);
  if (players !== config.players) {
    warnings.push({
      code: 'input',
      message: `Player count set to ${players}. ChipRatio handles 2 to 10 players.`,
    });
  }

  const values = denoms.map((d) => d.value);
  const counts = denoms.map((d) => d.count);
  const smallest = values[0];

  const opts: AllocationOptions = {
    targetStackChips:
      config.targetStackChips > 0 ? config.targetStackChips : DEFAULT_CONFIG.targetStackChips,
    allowUnevenSmallChips: config.allowUnevenSmallChips,
  };

  // Decide the target buy-in. Suggest mode (or a missing/invalid buy-in in solve mode)
  // hands off to the recommender. A buy-in that floors below 1 chip (0, a fraction, or
  // negative) is treated the same as "none entered" rather than silently dealing an
  // empty stack.
  let target: number;
  let suggestion: { buyIn: number; rationale: string } | null = null;
  const wantSuggest = config.mode === 'suggest' || config.buyIn === null || !(config.buyIn >= 1);

  if (wantSuggest) {
    const s = suggestBuyIn(values, counts, players, opts);
    if (!s) {
      return emptyResult(config.buyIn, [
        ...warnings,
        {
          code: 'not-enough-chips',
          message: `This box cannot give ${players} players a full stack. Add more chips or seat fewer players.`,
        },
      ]);
    }
    target = s.buyIn;
    suggestion = { buyIn: s.buyIn, rationale: s.rationale };
    // The recommender already built a reachability table while choosing this buy-in;
    // hand it to the final allocate() call below instead of rebuilding it from scratch.
    if (s.reachable) opts.reachable = s.reachable;
    if (config.mode === 'solve') {
      warnings.push({
        code: 'input',
        message: 'No buy-in entered, so ChipRatio suggested one for you.',
      });
    }
  } else {
    target = Math.floor(config.buyIn as number);
  }

  const alloc = allocate(values, counts, players, target, opts);

  if (!alloc.feasible) {
    return emptyResult(wantSuggest ? null : config.buyIn, [
      ...warnings,
      {
        code: 'not-enough-chips',
        message: `This box cannot give ${players} players a full stack. Add more chips or seat fewer players.`,
      },
    ]);
  }

  const blinds = deriveBlinds(alloc.value, smallest);

  // --- Warnings ---------------------------------------------------------------
  if (target > alloc.capValue) {
    warnings.push({
      code: 'infeasible',
      message: `A buy-in of ${target} is richer than the biggest equal stack this box allows (${alloc.capValue}). Snapped down to ${alloc.value}. Add chips or seat fewer players to go higher.`,
    });
  } else if (alloc.unevenSmall) {
    const extra = alloc.unevenSmall.extraPlayers;
    const n = Math.abs(extra);
    const direction = extra > 0 ? 'an extra' : 'one fewer';
    warnings.push({
      code: 'uneven-small-chips',
      message: `To land the table on ${target}, ${n} player${n === 1 ? '' : 's'} get ${direction} of the smallest chip. Every other chip is identical.`,
    });
    if (alloc.tableValue !== players * target) {
      warnings.push({
        code: 'buyin-snapped',
        message: `Even with uneven small chips, ${target} is not perfectly reachable. Closest is ${alloc.value} per player.`,
      });
    }
  } else if (alloc.snapped) {
    warnings.push({
      code: 'buyin-snapped',
      message: `A buy-in of ${target} is not reachable with identical stacks. Snapped to the nearest, ${alloc.value}.`,
    });
    if (alloc.gcd > 1 && target % alloc.gcd !== 0) {
      warnings.push({
        code: 'granularity-limited',
        message: `Your smallest reachable step is ${alloc.gcd} (no chip splits it finer), so some buy-ins have to round.`,
      });
    }
  }

  if (blinds.startingBBDepth > 0 && blinds.startingBBDepth < SHALLOW_BB) {
    warnings.push({
      code: 'shallow-stack',
      message: `Starting depth is about ${Math.round(blinds.startingBBDepth)} big blinds, which plays short. 50 or more is roomier.`,
    });
  } else if (blinds.startingBBDepth > DEEP_BB) {
    warnings.push({
      code: 'deep-stack',
      message: `Starting depth is about ${Math.round(blinds.startingBBDepth)} big blinds, which plays deep and slow. Fine if that is the plan.`,
    });
  }

  const wantSmall = minSmallChips(blinds.big, smallest);
  if (alloc.x[0] < wantSmall) {
    warnings.push({
      code: 'few-small-chips',
      message: `Only ${alloc.x[0]} of the smallest chip per stack. Posting and changing the early blinds gets fiddly below ${wantSmall}.`,
    });
  }

  // --- Assemble ---------------------------------------------------------------
  const perPlayer: PerPlayerChip[] = denoms
    .map((d, i) => ({ denomId: d.id, color: d.color, value: d.value, count: alloc.x[i] }))
    .filter((p) => p.count > 0);

  const leftover: PerPlayerChip[] = denoms
    .map((d, i) => {
      let used = players * alloc.x[i];
      if (alloc.unevenSmall && i === alloc.unevenSmall.index)
        used += alloc.unevenSmall.extraPlayers;
      return { denomId: d.id, color: d.color, value: d.value, count: d.count - used };
    })
    .filter((p) => p.count > 0);

  const money = mapMoney(alloc.value, config.moneyBuyIn, denoms);

  return {
    ok: true,
    perPlayer,
    stackValue: alloc.value,
    requestedBuyIn: wantSuggest ? null : Math.floor(config.buyIn as number),
    totalChipsPerPlayer: alloc.x.reduce((a, b) => a + b, 0),
    leftover,
    unevenSmall: publicUneven(alloc.unevenSmall, denoms),
    blinds,
    money,
    suggestion,
    warnings,
    quality: alloc.quality,
  };
}
