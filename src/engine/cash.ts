import { gcdAll } from './math';
import { allocate, capsAndCapValue, reachableFor } from './allocate';
import { deriveBlinds } from './blinds';
import { CHIP_CENTS_LADDER, isNiceCents, snapNice } from './nice';
import { depthPenalty, type Plan } from './plan';

// Cash games.
//
// The host thinks in money: "$20 each". The question is what each chip color is worth.
// Dividing the buy-in by a chip total gives answers like 28¢ a chip, which nobody can make
// change with. So instead we try every real money value for the smallest chip (5¢, 10¢,
// 25¢, $1 ...), keep the printed ratios between colors, throw out any choice that puts an
// odd price on a color ($1.25, $12.50), and solve the stack for each survivor. The best
// stack wins. Everything is integer cents, so there is no floating-point rounding anywhere.

/** Score cost per big blind outside the comfortable depth band. */
const DEPTH_WEIGHT = 0.5;

export interface CashPlan extends Plan {
  /** True when a pinned smallest-chip value was unusable and ChipRatio picked instead. */
  pinIgnored: boolean;
}

interface Candidate {
  plan: Plan;
  miss: number;
  score: number;
  smallestCents: number;
}

/** Cents per chip for each color when the smallest chip is worth `smallestCents`. */
function centsPerChip(values: number[], smallestCents: number): number[] | null {
  const out: number[] = [];
  for (const v of values) {
    const c = (v * smallestCents) / values[0];
    if (!Number.isInteger(c)) return null;
    out.push(c);
  }
  return out;
}

function tryValue(
  counts: number[],
  players: number,
  buyInCents: number,
  worth: number[],
  targetStackChips: number,
): Candidate | null {
  // Solve in the coarsest unit the chip prices share, which keeps the tables small.
  const g = gcdAll(worth);
  const units = worth.map((c) => c / g);
  const { caps, capValue } = capsAndCapValue(units, counts, players);
  if (capValue <= 0) return null;

  const reachable = reachableFor(units, caps, capValue);
  const wanted = buyInCents / g;
  let t: number;
  if (Number.isInteger(wanted) && wanted <= capValue && (!reachable || reachable[wanted])) {
    t = wanted;
  } else if (reachable) {
    t = snapNice(reachable, wanted, capValue);
  } else {
    t = Math.min(Math.floor(wanted), capValue);
  }
  if (t <= 0) return null;

  const blinds = deriveBlinds(t * g, worth[0], { cash: true });
  const alloc = allocate(units, counts, players, t, {
    targetStackChips,
    reachable: reachable ?? undefined,
    bigBlind: blinds.big / g,
  });
  if (alloc.value <= 0) return null;

  const stackValue = alloc.value * g;
  const final = stackValue === t * g ? blinds : deriveBlinds(stackValue, worth[0], { cash: true });
  return {
    plan: {
      x: alloc.x,
      worth,
      stackValue,
      capValue: capValue * g,
      blinds: final,
      quality: alloc.quality,
      adjusted: stackValue !== buyInCents,
    },
    miss: Math.abs(stackValue - buyInCents),
    score: alloc.quality - depthPenalty(final.startingBBDepth, DEPTH_WEIGHT),
    smallestCents: worth[0],
  };
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.miss !== b.miss) return a.miss < b.miss; // hitting the host's buy-in comes first
  if (a.score !== b.score) return a.score > b.score;
  return a.smallestCents < b.smallestCents;
}

export function planCash(
  values: number[],
  counts: number[],
  players: number,
  buyInCents: number,
  pinnedSmallestCents: number | null,
  targetStackChips: number,
): CashPlan | null {
  const pinned = pinnedSmallestCents !== null ? centsPerChip(values, pinnedSmallestCents) : null;
  const pinIgnored = pinnedSmallestCents !== null && pinned === null;

  const options: number[][] = [];
  if (pinned) {
    options.push(pinned);
  } else {
    for (const smallest of CHIP_CENTS_LADDER) {
      const worth = centsPerChip(values, smallest);
      if (worth && worth.every(isNiceCents)) options.push(worth);
    }
    // A custom set with unusual ratios (1, 3, 7) can rule out every nice price. Integer
    // cents with the familiar smallest values is the next best thing.
    if (options.length === 0) {
      for (const smallest of CHIP_CENTS_LADDER) {
        const worth = centsPerChip(values, smallest);
        if (worth) options.push(worth);
      }
    }
  }

  let best: Candidate | null = null;
  for (const worth of options) {
    const cand = tryValue(counts, players, buyInCents, worth, targetStackChips);
    if (cand && (best === null || better(cand, best))) best = cand;
  }

  return best ? { ...best.plan, pinIgnored } : null;
}

/**
 * The values a host can pin the smallest chip to without putting an odd price on any other
 * color. Powers the "smallest chip is worth" picker, so it only ever offers clean choices.
 */
export function smallestChipOptions(values: number[]): number[] {
  const sorted = [...values].filter((v) => v >= 1).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return CHIP_CENTS_LADDER.filter((smallest) => {
    const worth = centsPerChip(sorted, smallest);
    return worth !== null && worth.every(isNiceCents);
  });
}
