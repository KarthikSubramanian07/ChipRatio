import { canMakeExact, clamp, sum } from './math';

// How good is a candidate stack? A great home-game stack is a pyramid: lots of the
// smallest chip, fewer of each larger one, one or two big chips to keep the pile small,
// and enough small change to actually post and pay blinds. It should also be easy to
// deal: "20 white, 10 red, 4 green" gets counted out in seconds, "17 white, 7 red, 6 green"
// does not. We turn that intuition into a single score and let the solver maximize it.

/** Weights. Tuned by feel-testing across many sets (see scripts/feel-test.ts). */
export const WEIGHTS = {
  /** Reward counts that never rise as value rises (the pyramid). Dominant term. */
  pyramid: 100,
  /** Punish stacks too thin on small chips to post and change blinds. */
  blind: 45,
  /** Gently pull the total chip count toward the target, per chip over it. */
  totalChips: 3,
  /** Per chip under the target. Harsher: a five-chip stack is barely a stack. */
  tooFewChips: 5,
  /** Hard-ish penalty when the stack cannot make change for one big blind. */
  change: 60,
  /** Per chip color whose count is awkward to count out (not a multiple of 5). */
  awkwardCount: 9,
} as const;

/** Stacks within this many chips of the target are treated as on-target (no penalty). */
export const CHIP_COUNT_DEADBAND = 5;

export interface QualityContext {
  /** Denomination values, ascending, aligned with the x vector. */
  values: number[];
  /** Preferred total chip count for one stack. */
  targetStackChips: number;
  /** Big blind value, in the same unit as values. Used for the change-making check. */
  bigBlind: number;
}

/**
 * How many of the smallest chip we'd like to see. Enough to post the small blind for a
 * while and make change for the big blind, scaled to the blind size, but always a small
 * sane number.
 */
export function minSmallChips(bigBlind: number, smallestValue: number): number {
  if (smallestValue <= 0) return 0;
  return clamp(Math.round((2 * bigBlind) / smallestValue), 4, 12);
}

/** The pyramid signal: the fraction of adjacent denomination pairs that do not rise. */
export function pyramidFraction(x: number[]): number {
  if (x.length <= 1) return 1;
  let good = 0;
  for (let i = 0; i < x.length - 1; i++) {
    if (x[i] >= x[i + 1]) good++;
  }
  return good / (x.length - 1);
}

/**
 * How awkward a count is to deal, from 0 (easy) to 1. A handful (up to 5) is glanced at,
 * multiples of 5 are counted in fives from the rack, even numbers are half-bad, and odd
 * counts like 7 or 13 are the ones that make a host recount.
 */
export function countAwkwardness(count: number): number {
  if (count <= 5 || count % 5 === 0) return 0;
  return count % 2 === 0 ? 0.5 : 1;
}

/**
 * Score a stack. Pass `floor` to skip the expensive change-making check when the stack
 * cannot reach that score even before it: the solver uses this to discard losers cheaply.
 * A skipped stack returns -Infinity.
 */
export function scoreStack(x: number[], ctx: QualityContext, floor = -Infinity): number {
  const { values, targetStackChips, bigBlind } = ctx;
  if (x.length === 0) return 0;

  const total = sum(x);
  const smallestValue = values[0];

  const wantSmall = minSmallChips(bigBlind, smallestValue);
  const blindShortfall = wantSmall > 0 ? Math.max(0, wantSmall - x[0]) / wantSmall : 0;
  const over = Math.max(0, total - targetStackChips - CHIP_COUNT_DEADBAND);
  const under = Math.max(0, targetStackChips - CHIP_COUNT_DEADBAND - total);

  let awkward = 0;
  for (const c of x) awkward += countAwkwardness(c);

  const base =
    WEIGHTS.pyramid * pyramidFraction(x) -
    WEIGHTS.blind * blindShortfall -
    WEIGHTS.totalChips * over -
    WEIGHTS.tooFewChips * under -
    WEIGHTS.awkwardCount * awkward;
  if (base < floor) return -Infinity;

  const canChange = bigBlind > 0 ? canMakeExact(values, x, bigBlind) : true;
  return base - WEIGHTS.change * (canChange ? 0 : 1);
}
