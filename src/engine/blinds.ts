import type { Blinds, BlindLevel } from './types';
import { SMALL_BLIND_LADDER, isNiceCents } from './nice';

// Blinds.
//
// Two rules decide everything. First, a blind has to be postable with chips that exist, so
// every level is a whole multiple of the smallest chip. Second, it has to be a level people
// actually play: 5/10, 25/50, 100/200. Never 14/27. So ChipRatio picks from a ladder of real
// blind levels rather than doing arithmetic on the buy-in and rounding whatever falls out.

/** The standard opening depth for a home game, in big blinds. */
export const TARGET_START_BB = 100;
/** Below this many big blinds a stack plays uncomfortably short. */
export const SHALLOW_BB = 40;
/** Above this it plays deep and slow (fine, but worth saying). */
export const DEEP_BB = 160;

/** How many levels the tournament schedule prints. */
const SCHEDULE_LEVELS = 8;
/** Minimum jump between printed levels, so a schedule does not crawl. */
const LEVEL_STEP = 1.4;

/**
 * Blind levels this box can actually post: ladder rungs that are whole multiples of the
 * smallest chip. In a cash game the rungs must also be real money amounts (10¢/20¢, never
 * 3¢/6¢), because the "value" of a chip there is its price in cents.
 */
export function blindLadder(smallestValue: number, cash: boolean): number[] {
  const unit = smallestValue > 0 ? Math.round(smallestValue) : 1;
  const rungs = SMALL_BLIND_LADDER.filter(
    (sb) => sb % unit === 0 && (!cash || (isNiceCents(sb) && isNiceCents(2 * sb))),
  );
  // A hand-entered oddity (a smallest chip worth 7) has no familiar rungs at all. Fall back
  // to plain multiples of that chip so the blinds stay postable, which matters more.
  return rungs.length > 0 ? rungs : [1, 2, 3, 5, 10, 20, 25, 50, 100].map((m) => m * unit);
}

/**
 * The rung that starts the game closest to 100 big blinds deep. Cheap enough to call inside
 * the solver's loop, which is why it takes plain numbers rather than a Blinds object.
 */
export function chooseBlinds(
  stackValue: number,
  smallestValue: number,
  cash = false,
): { small: number; big: number } {
  const ladder = blindLadder(smallestValue, cash);
  if (stackValue <= 0) return { small: ladder[0], big: 2 * ladder[0] };

  let best = { small: ladder[0], big: 2 * ladder[0], depth: Infinity, err: Infinity };
  for (const small of ladder) {
    const big = 2 * small;
    const depth = stackValue / big;
    const err = Math.abs(depth - TARGET_START_BB);
    // Closest to the target depth; on a tie, prefer the deeper (smaller) blind.
    if (err < best.err || (err === best.err && depth > best.depth)) {
      best = { small, big, depth, err };
    }
  }
  return { small: best.small, big: best.big };
}

/** An escalating schedule: the next rungs up the same ladder, each a real jump from the last. */
function buildSchedule(small: number, smallestValue: number): BlindLevel[] {
  const ladder = blindLadder(smallestValue, false);
  const levels: BlindLevel[] = [{ level: 1, small, big: 2 * small }];
  let current = small;

  for (const sb of ladder) {
    if (levels.length >= SCHEDULE_LEVELS) break;
    if (sb < current * LEVEL_STEP) continue;
    levels.push({ level: levels.length + 1, small: sb, big: 2 * sb });
    current = sb;
  }

  // A tiny ladder can run out before eight levels. Keep doubling so the schedule still ends
  // somewhere playable rather than stopping two levels in.
  while (levels.length < SCHEDULE_LEVELS) {
    current *= 2;
    levels.push({ level: levels.length + 1, small: current, big: 2 * current });
  }

  return levels;
}

export interface BlindOptions {
  /** Cash games hold their blinds still and price them in cents. */
  cash: boolean;
}

export function deriveBlinds(
  stackValue: number,
  smallestValue: number,
  opts: BlindOptions,
): Blinds {
  const { small, big } = chooseBlinds(stackValue, smallestValue, opts.cash);
  return {
    small,
    big,
    startingBBDepth: big > 0 ? stackValue / big : 0,
    schedule: opts.cash ? [] : buildSchedule(small, smallestValue),
  };
}
