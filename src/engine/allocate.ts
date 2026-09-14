import { gcdAll, nearestReachable, reachableSums, REACHABLE_LIMIT } from './math';
import { chooseBlinds } from './blinds';
import { scoreStack, type QualityContext } from './quality';

// The allocation solver. Everything here is pure and integer-only.
//
// Every player gets an identical stack, so per denomination the most any player can
// receive is floor(count / players). Within those caps we search for the integer stack that
// sums to exactly the target and scores best (see quality.ts).
//
// The search is exact, not heuristic: we enumerate every stack that hits the target and
// keep the best. The trick that keeps it fast is that the smallest denomination is a free
// "remainder absorber": once the counts of every larger chip are fixed, the count of the
// smallest chip is forced. So we only branch over the larger denominations, and real poker
// sets have very few of those.

/**
 * Work cap for one search pass. Real 3 to 5 color sets finish far below it; a 7-color case
 * split between two players has millions of exact stacks, and past this point the search
 * keeps the best one found so far (still deterministic, since the order is fixed). Counts
 * are tried smallest first, so the stacks explored early are the pyramid-shaped ones that
 * tend to win anyway.
 */
const NODE_BUDGET = 150_000;

export interface AllocationOptions {
  targetStackChips: number;
  /** Optional precomputed reachability table for these values and caps. */
  reachable?: boolean[];
  /** Big blind in the same unit as values. Derived from the target when omitted. */
  bigBlind?: number;
}

export interface Allocation {
  /** False only when the box cannot give every player even one chip. */
  feasible: boolean;
  /** Per-player counts, aligned to the ascending values array. */
  x: number[];
  /** Stack value. Equals the target unless it had to be snapped. */
  value: number;
  /** True when value differs from the requested target. */
  snapped: boolean;
  /** Richest possible equal stack: sum of caps times values. */
  capValue: number;
  quality: number;
}

interface Candidate {
  x: number[];
  score: number;
  total: number;
}

/** Strict "A is a better pick than B", with fully deterministic tie-breaks. */
function betterThan(a: Candidate, b: Candidate): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.total !== b.total) return a.total < b.total; // fewer chips is tidier
  for (let i = 0; i < a.x.length; i++) {
    if (a.x[i] !== b.x[i]) return a.x[i] > b.x[i]; // then more small chips first
  }
  return false;
}

/**
 * Enumerate every stack that sums to exactly `target` within caps and keep the best one.
 *
 * A cap on the total chip count prunes the enormous, worthless tail of stacks built from a
 * hundred tiny chips: they always lose on the chip-count penalty anyway. If nothing fits
 * under the cap (only when a set genuinely forces a large stack) the cap widens, ending in
 * an uncapped pass, so a stack is always found when one exists. Returns null only if no exact stack exists.
 */
function searchExact(
  values: number[],
  caps: number[],
  target: number,
  ctx: QualityContext,
): Candidate | null {
  const k = values.length;
  if (k === 0) return null;

  // maxUpTo[i] = the most value denoms 0..i can contribute. Powers the pruning bounds.
  const maxUpTo = new Array<number>(k).fill(0);
  let acc = 0;
  for (let i = 0; i < k; i++) {
    acc += caps[i] * values[i];
    maxUpTo[i] = acc;
  }

  const v0 = values[0];

  const run = (chipCap: number): Candidate | null => {
    const x = new Array<number>(k).fill(0);
    let best: Candidate | null = null;
    let nodes = 0;

    const consider = (total: number): void => {
      const score = scoreStack(x, ctx, best === null ? -Infinity : best.score);
      if (score === -Infinity) return;
      const cand: Candidate = { x, score, total };
      if (best === null || betterThan(cand, best)) {
        best = { x: x.slice(), score: cand.score, total };
      }
    };

    const dfs = (i: number, remaining: number, chipsSoFar: number): void => {
      if (nodes++ > NODE_BUDGET) return;
      if (i === 0) {
        // The smallest chip absorbs whatever value is left, if it divides evenly.
        if (remaining % v0 === 0) {
          const c = remaining / v0;
          if (c >= 0 && c <= caps[0] && chipsSoFar + c <= chipCap) {
            x[0] = c;
            consider(chipsSoFar + c);
          }
        }
        return;
      }
      const vi = values[i];
      // The fewest chips that can finish uses the largest remaining denom (index i).
      if (chipsSoFar + Math.ceil(remaining / vi) > chipCap) return;
      const maxBelow = maxUpTo[i - 1];
      const hi = Math.min(caps[i], Math.floor(remaining / vi));
      const lo = Math.max(0, Math.ceil((remaining - maxBelow) / vi));
      for (let c = lo; c <= hi; c++) {
        x[i] = c;
        dfs(i - 1, remaining - c * vi, chipsSoFar + c);
      }
      x[i] = 0;
    };

    dfs(k - 1, target, 0);
    return best;
  };

  // Widen the chip cap only when a tighter pass finds nothing at all.
  return run(ctx.targetStackChips + 25) ?? run(ctx.targetStackChips * 2 + 40) ?? run(Infinity);
}

/** Per-denomination caps and the richest possible equal stack. */
export function capsAndCapValue(
  values: number[],
  counts: number[],
  players: number,
): { caps: number[]; capValue: number } {
  if (players < 1) return { caps: values.map(() => 0), capValue: 0 };
  const caps = counts.map((c) => Math.floor(c / players));
  let capValue = 0;
  for (let i = 0; i < values.length; i++) capValue += caps[i] * values[i];
  return { caps, capValue };
}

/** Reachability table for these chips, or null when the stack value is absurdly large. */
export function reachableFor(values: number[], caps: number[], capValue: number): boolean[] | null {
  return capValue > 0 && capValue <= REACHABLE_LIMIT ? reachableSums(values, caps, capValue) : null;
}

/** Solve for an identical per-player stack, snapping the target only when forced to. */
export function allocate(
  values: number[],
  counts: number[],
  players: number,
  target: number,
  opts: AllocationOptions,
): Allocation {
  const k = values.length;
  const gcd = gcdAll(values);
  const { caps, capValue } = capsAndCapValue(values, counts, players);

  const result: Allocation = {
    feasible: capValue > 0,
    x: new Array<number>(k).fill(0),
    value: 0,
    snapped: false,
    capValue,
    quality: 0,
  };

  if (k === 0 || capValue <= 0) return result;

  const clamped = Math.max(0, Math.min(target, capValue));

  let snappedTarget: number;
  const reachable = opts.reachable ?? reachableFor(values, caps, capValue);
  if (reachable) {
    snappedTarget = nearestReachable(reachable, clamped, capValue);
  } else {
    // Enormous (non-poker) set: fall back to gcd granularity, verified by the search.
    snappedTarget = gcd > 0 ? clamped - (clamped % gcd) : clamped;
  }

  const solveAt = (t: number) => {
    const bigBlind = opts.bigBlind ?? chooseBlinds(t, values[0]).big;
    const ctx: QualityContext = { values, targetStackChips: opts.targetStackChips, bigBlind };
    return searchExact(values, caps, t, ctx);
  };

  let found = snappedTarget > 0 ? solveAt(snappedTarget) : null;
  // Defensive: if a gcd-approximated target is not representable under caps, step down.
  while (!found && snappedTarget > 0 && !reachable) {
    snappedTarget -= gcd > 0 ? gcd : 1;
    if (snappedTarget > 0) found = solveAt(snappedTarget);
  }
  if (!found) {
    result.snapped = target > 0;
    return result;
  }

  result.x = found.x;
  result.value = snappedTarget;
  result.snapped = snappedTarget !== target;
  result.quality = found.score;
  return result;
}
