import { gcdAll, nearestReachable, reachableSums, REACHABLE_LIMIT } from './math';
import { chooseBlinds } from './blinds';
import { scoreStack, type QualityContext } from './quality';

// The allocation solver. Everything here is pure and integer-only.
//
// Every player gets an identical stack, so per denomination the most any player can
// receive is floor(count / players). Within those caps we search for the integer
// stack that sums to exactly the buy-in and scores best as a pyramid (see quality.ts).
//
// The search is exact, not heuristic: we enumerate every stack that hits the target and
// keep the best. The trick that keeps it fast is that the smallest denomination is a
// free "remainder absorber" — once the counts of every larger chip are fixed, the count
// of the smallest chip is forced. So we only branch over the larger denominations, and
// real poker sets have very few of those with meaningful caps.

/** Safety valve so a pathological (non-poker) set can never hang the search. */
const NODE_BUDGET = 6_000_000;

export interface AllocationOptions {
  targetStackChips: number;
  allowUnevenSmallChips: boolean;
  /** Optional precomputed reachability table (suggest mode reuses one across candidates). */
  reachable?: boolean[];
}

export interface UnevenSmall {
  /** Always 0: only the smallest denomination is ever allowed to vary. */
  index: number;
  /** Signed. +k: k players get one extra smallest chip. -k: k players get one fewer. */
  extraPlayers: number;
  /** Count of the smallest chip in the base (identical) stack. */
  baseCount: number;
}

export interface Allocation {
  /** False only when the box cannot even equip every player with one chip. */
  feasible: boolean;
  /** Base per-player counts, aligned to the ascending values array. */
  x: number[];
  /** Base stack value. Equals the possibly-snapped target. */
  value: number;
  /** True when value differs from the requested target (granularity or too few chips). */
  snapped: boolean;
  /** Richest possible equal stack: sum of caps times values. */
  capValue: number;
  /** gcd of the denomination values (the finest reachable step). */
  gcd: number;
  quality: number;
  unevenSmall: UnevenSmall | null;
  /** Total value actually dealt across the table, after any uneven-small adjustment. */
  tableValue: number;
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
 * A generous cap on the total chip count prunes the enormous, worthless tail of stacks
 * built from a hundred tiny chips: they always lose on the chip-count penalty anyway, so
 * exploring them is pure waste. If nothing fits under the cap (only when a set genuinely
 * forces a large stack) we fall back to an uncapped pass, so the answer stays exact.
 * Returns null only if no exact stack exists at all.
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
      const cand: Candidate = { x, score: scoreStack(x, ctx), total };
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
      for (let c = hi; c >= lo; c--) {
        x[i] = c;
        dfs(i - 1, remaining - c * vi, chipsSoFar + c);
      }
      x[i] = 0;
    };

    dfs(k - 1, target, 0);
    return best;
  };

  const chipCap = Math.max(60, ctx.targetStackChips * 2 + 40);
  return run(chipCap) ?? run(Infinity);
}

/** Per-denomination caps and the richest possible equal stack, shared by allocate and suggest. */
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

/** Solve for an identical per-player stack, snapping the buy-in only when forced to. */
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
    gcd,
    quality: 0,
    unevenSmall: null,
    tableValue: 0,
  };

  if (k === 0 || capValue <= 0) return result;

  const clamped = Math.max(0, Math.min(target, capValue));

  // Snap the target to the nearest value the box can actually form.
  let snappedTarget: number;
  if (capValue <= REACHABLE_LIMIT) {
    const reachable = opts.reachable ?? reachableSums(values, caps, capValue);
    snappedTarget = nearestReachable(reachable, clamped, capValue);
  } else {
    // Enormous (non-poker) set: fall back to gcd granularity, verified by the search.
    snappedTarget = gcd > 0 ? clamped - (clamped % gcd) : clamped;
  }

  if (snappedTarget <= 0) {
    result.snapped = target > 0;
    return result;
  }

  const solveAt = (t: number): Candidate | null => {
    const { big } = chooseBlinds(t, values[0]);
    const ctx: QualityContext = { values, targetStackChips: opts.targetStackChips, bigBlind: big };
    return searchExact(values, caps, t, ctx);
  };

  let found = solveAt(snappedTarget);
  // Defensive: if a gcd-approximated target is not representable under caps, step down.
  while (!found && snappedTarget > 0) {
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
  result.tableValue = players * snappedTarget;

  applyUnevenSmall(result, values, counts, players, target, opts);
  return result;
}

/**
 * Opt-in: when the exact buy-in was unreachable with an identical stack, let the smallest
 * chip differ by one between players so the table total lands on (or nearest to) the exact
 * requested bankroll. This is the only asymmetry ChipRatio ever introduces.
 */
function applyUnevenSmall(
  result: Allocation,
  values: number[],
  counts: number[],
  players: number,
  target: number,
  opts: AllocationOptions,
): void {
  if (!opts.allowUnevenSmallChips) return;
  if (!result.snapped || target <= 0 || target > result.capValue) return;

  const v0 = values[0];
  const x0 = result.x[0];
  const deltaValue = target - result.value; // signed shortfall per player
  const extra = Math.round((players * deltaValue) / v0);
  if (extra === 0 || Math.abs(extra) > players) return;

  const totalSmallUsed = players * x0 + extra;
  if (totalSmallUsed < 0 || totalSmallUsed > counts[0]) return;
  if (extra < 0 && x0 < 1) return; // some players would need a negative count

  result.unevenSmall = { index: 0, extraPlayers: extra, baseCount: x0 };
  result.tableValue = players * result.value + extra * v0;
}
