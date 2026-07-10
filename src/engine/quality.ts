import { canMakeExact, clamp, sum } from './math';

// How good is a candidate stack? A great home-game stack is a pyramid: lots of the
// smallest chip, fewer of each larger one, one or two big chips to keep the pile small,
// and enough small change to actually post and pay blinds. We turn that intuition into
// a single score and let the solver maximize it.

/** Weights. Tuned by feel-testing across many sets (see scripts/feel-test.ts). */
export const WEIGHTS = {
  /** Reward counts that never rise as value rises (the pyramid). Dominant term. */
  pyramid: 100,
  /** Punish stacks too thin on small chips to post and change blinds. */
  blind: 45,
  /** Gently pull the total chip count toward the target. */
  totalChips: 4,
  /** Hard-ish penalty when the stack cannot make change for one big blind. */
  change: 60,
} as const;

/** Stacks within this many chips of the target are treated as on-target (no penalty). */
export const CHIP_COUNT_DEADBAND = 4;

export interface QualityContext {
  /** Denomination values, ascending, aligned with the x vector. */
  values: number[];
  /** Preferred total chip count for one stack. */
  targetStackChips: number;
  /** Big blind value, used for the change-making check. */
  bigBlind: number;
}

/**
 * How many of the smallest chip we'd like to see. Enough to post the small blind for a
 * while and make change for the big blind, scaled to the blind size, but always a small
 * sane number. If blinds are 5/10 on 1-value chips you want a dozen ones; if the small
 * chip already equals the small blind, a handful is plenty.
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

export function scoreStack(x: number[], ctx: QualityContext): number {
  const { values, targetStackChips, bigBlind } = ctx;
  if (x.length === 0) return 0;

  const total = sum(x);
  const smallestValue = values[0];
  const smallCount = x[0];

  const pyramid = pyramidFraction(x);

  const wantSmall = minSmallChips(bigBlind, smallestValue);
  const blindShortfall = wantSmall > 0 ? Math.max(0, wantSmall - smallCount) / wantSmall : 0;

  const chipMiss = Math.max(0, Math.abs(total - targetStackChips) - CHIP_COUNT_DEADBAND);

  const canChange = bigBlind > 0 ? canMakeExact(values, x, bigBlind) : true;

  return (
    WEIGHTS.pyramid * pyramid -
    WEIGHTS.blind * blindShortfall -
    WEIGHTS.totalChips * chipMiss -
    WEIGHTS.change * (canChange ? 0 : 1)
  );
}
