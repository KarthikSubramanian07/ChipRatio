import type { Blinds, BlindLevel } from './types';

// Blind derivation.
//
// Two facts drive this. First, you can only post and pay blinds in chips you actually
// own, so every blind has to be a whole multiple of the smallest chip in the box.
// Second, the community-standard starting depth for a home game is around 100 big
// blinds. So we pick, from a ladder of familiar blind levels (1/2, 2/4, 5/10, 10/20,
// 25/50 ...), the one that lands the buy-in closest to 100 BB. That keeps a 2000-chip
// game at a sane 10/20 instead of a silly 2/4-and-500-BB.

/** The standard "good" opening depth in big blinds. */
export const TARGET_START_BB = 100;
/** Below this many big blinds, a stack plays uncomfortably short for a home game. */
export const SHALLOW_BB = 40;
/** Above this, it plays deep and slow (fine, but worth flagging). */
export const DEEP_BB = 150;

/** How many escalating levels to generate for the optional tournament schedule. */
const SCHEDULE_LEVELS = 8;

/**
 * Small-blind multipliers of the smallest chip. Big blind is always twice the small
 * blind, so each rung stays postable (small blind is a whole number of small chips).
 * These are the blind levels home games and casinos actually use.
 */
export const SB_LADDER = [
  1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000,
  2500, 5000, 10000,
];

/**
 * Base blinds only. Picks the ladder rung whose starting depth is closest to 100 BB.
 * Cheap enough to call inside the solver's hot loop (it powers the change-making check).
 */
export function chooseBlinds(buyIn: number, smallestValue: number): { small: number; big: number } {
  const u = smallestValue > 0 ? smallestValue : 1;
  if (buyIn <= 0) return { small: u, big: 2 * u };

  let best: { small: number; big: number; depth: number; err: number } | null = null;
  for (const m of SB_LADDER) {
    const small = m * u;
    const big = 2 * small;
    const depth = buyIn / big;
    const err = Math.abs(depth - TARGET_START_BB);
    // Nearest to target depth; on a tie, prefer the deeper (smaller) blind.
    if (best === null || err < best.err || (err === best.err && depth > best.depth)) {
      best = { small, big, depth, err };
    }
  }
  return { small: best!.small, big: best!.big };
}

function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * An escalating schedule for tournament play. Big blind grows about 1.5x per level and
 * every value stays a whole multiple of the smallest chip, so every blind is postable.
 * Levels are strictly increasing.
 */
function buildSchedule(small: number, big: number, smallestValue: number): BlindLevel[] {
  const step = smallestValue > 0 ? smallestValue : 1;
  const levels: BlindLevel[] = [];
  let sb = small;
  let bb = big;

  for (let level = 1; level <= SCHEDULE_LEVELS; level++) {
    levels.push({ level, small: sb, big: bb });
    let nextBig = roundToStep(bb * 1.5, step);
    if (nextBig <= bb) nextBig = bb + step;
    bb = nextBig;
    sb = Math.max(step, roundToStep(bb / 2, step));
  }

  return levels;
}

export function deriveBlinds(buyIn: number, smallestValue: number): Blinds {
  const { small, big } = chooseBlinds(buyIn, smallestValue);
  const startingBBDepth = big > 0 ? buyIn / big : 0;
  return {
    small,
    big,
    startingBBDepth,
    schedule: buildSchedule(small, big, smallestValue),
  };
}
