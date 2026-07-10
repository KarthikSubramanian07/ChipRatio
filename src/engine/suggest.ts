import { nearestReachable, reachableSums, REACHABLE_LIMIT } from './math';
import { allocate, capsAndCapValue, type AllocationOptions } from './allocate';
import { chooseBlinds, SB_LADDER, TARGET_START_BB } from './blinds';

// Smart Suggest: no buy-in entered, so pick a good one. "Good" means a clean pyramid
// stack that plays around 100 big blinds deep (the community-standard home-game start).
// This is the utility's version of an opponent AI: it makes the smart call for the host
// who does not want to think about it.
//
// We build one candidate per blind rung (a ~100 BB game at 1/2, at 2/4, at 5/10, ...),
// solve each, and keep whichever gives the best stack. That naturally scales the buy-in
// to the box: a small set lands on a 1/2 game, a rich one can go higher if the chips
// make a better pyramid there.

/** Score cost per big blind away from the target depth. */
const DEPTH_WEIGHT = 0.6;
/** Ignore candidates shallower than this; not worth suggesting. */
const MIN_DEPTH = 20;

export interface Suggestion {
  buyIn: number;
  rationale: string;
  /** The reachability table computed along the way, so calculate() can reuse it. */
  reachable: boolean[] | null;
}

function niceness(value: number, unit: number): number {
  if (value % (10 * unit) === 0) return 3;
  if (value % (5 * unit) === 0) return 1;
  return 0;
}

export function suggestBuyIn(
  values: number[],
  counts: number[],
  players: number,
  opts: AllocationOptions,
): Suggestion | null {
  const k = values.length;
  if (k === 0 || players < 1) return null;

  const { caps, capValue } = capsAndCapValue(values, counts, players);
  if (capValue <= 0) return null;

  const u = values[0];
  // Same guard allocate() uses: an absurd chip value can make capValue huge, and a
  // reachability table costs one boolean per unit of value. Skip it rather than OOM.
  const reachable = capValue <= REACHABLE_LIMIT ? reachableSums(values, caps, capValue) : null;
  const nearest = (target: number): number =>
    reachable
      ? nearestReachable(reachable, target, capValue)
      : Math.min(Math.max(target, 0), capValue);

  // One candidate buy-in per blind rung: a ~100 BB game at that blind scale.
  const candidateSet = new Set<number>();
  for (const m of SB_LADDER) {
    const big = 2 * m * u;
    const idealBuy = TARGET_START_BB * big;
    const t = nearest(Math.min(idealBuy, capValue));
    if (t > 0) candidateSet.add(t);
    if (idealBuy > capValue) break; // richer rungs only snap back down to capValue
  }
  candidateSet.add(nearest(capValue));
  const candidates = [...candidateSet].sort((a, b) => a - b);

  const sharedOpts: AllocationOptions = {
    ...opts,
    reachable: reachable ?? undefined,
    allowUnevenSmallChips: false,
  };
  let best: { buyIn: number; depth: number; score: number } | null = null;

  for (const t of candidates) {
    const alloc = allocate(values, counts, players, t, sharedOpts);
    if (alloc.value !== t) continue; // only exactly reachable buy-ins
    const { big } = chooseBlinds(t, u);
    const depth = big > 0 ? t / big : 0;
    if (depth < MIN_DEPTH) continue;
    const score = alloc.quality - DEPTH_WEIGHT * Math.abs(depth - TARGET_START_BB) + niceness(t, u);
    if (best === null || score > best.score) {
      best = { buyIn: t, depth, score };
    }
  }

  // Nothing cleared the depth floor (a very small or coarse set). Fall back to the
  // richest reachable stack so the host still gets a usable game.
  if (best === null) {
    const t = nearest(capValue);
    const { big } = chooseBlinds(t, u);
    best = { buyIn: t, depth: big > 0 ? t / big : 0, score: 0 };
  }

  return { buyIn: best.buyIn, rationale: rationale(best.depth), reachable };
}

function rationale(depth: number): string {
  const bb = Math.round(depth);
  if (depth < 40) {
    return `About ${bb} big blinds deep. On the short side, but it is the most this box can seat evenly.`;
  }
  if (depth > 130) {
    return `About ${bb} big blinds deep, a patient, deep game.`;
  }
  return `About ${bb} big blinds deep, with enough small chips to post and change the early blinds.`;
}
