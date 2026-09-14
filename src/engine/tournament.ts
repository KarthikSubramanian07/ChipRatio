import { gcdAll } from './math';
import { allocate, capsAndCapValue, reachableFor } from './allocate';
import { chooseBlinds, deriveBlinds } from './blinds';
import { niceStacks, roundness, snapNice } from './nice';
import { depthPenalty, type Plan } from './plan';

// Tournaments.
//
// Chips are points, not money, so the printed values are used as they are. The host either
// names a starting stack or lets ChipRatio pick one. Either way the stack is a round number
// people would choose themselves (500, 1,000, 1,500), never whatever the arithmetic lands on.

/** Score cost per big blind outside the comfortable depth band. */
const DEPTH_WEIGHT = 0.5;
/** Ignore auto picks shallower than this when anything deeper exists. */
const MIN_DEPTH = 20;
/** Small nudge toward rounder stacks when two picks are otherwise close. */
const ROUND_BONUS = 1.5;
/**
 * Per chip color in play. A tournament needs its bigger chips on the table from the start,
 * or there is nothing to color up to when the blinds climb.
 */
const COLOR_BONUS = 4;

function buildPlan(
  values: number[],
  counts: number[],
  players: number,
  target: number,
  targetStackChips: number,
  reachable: boolean[] | null,
): Plan | null {
  const { big } = chooseBlinds(target, values[0]);
  const alloc = allocate(values, counts, players, target, {
    targetStackChips,
    reachable: reachable ?? undefined,
    bigBlind: big,
  });
  if (alloc.value <= 0) return null;
  return {
    x: alloc.x,
    worth: values.slice(),
    stackValue: alloc.value,
    capValue: alloc.capValue,
    blinds: deriveBlinds(alloc.value, values[0], { cash: false }),
    quality: alloc.quality,
    adjusted: false,
  };
}

export function planTournament(
  values: number[],
  counts: number[],
  players: number,
  startingStack: number | null,
  targetStackChips: number,
): Plan | null {
  const { caps, capValue } = capsAndCapValue(values, counts, players);
  if (capValue <= 0) return null;
  const reachable = reachableFor(values, caps, capValue);
  const g = gcdAll(values);

  if (startingStack !== null && startingStack >= 1) {
    const wanted = Math.floor(startingStack);
    let t: number;
    if (wanted <= capValue && (reachable ? reachable[wanted] : wanted % g === 0)) {
      t = wanted;
    } else if (reachable) {
      t = snapNice(reachable, wanted, capValue);
    } else {
      t = Math.min(wanted, capValue) - (Math.min(wanted, capValue) % g);
    }
    const plan = t > 0 ? buildPlan(values, counts, players, t, targetStackChips, reachable) : null;
    return plan ? { ...plan, adjusted: plan.stackValue !== wanted } : null;
  }

  // Auto: try every round stack the box can build and keep the best game.
  // Round stacks the case can build. Prefer the ones that land near a sensible chip count
  // (not so small that even the smallest chips make a thin stack, not so big that the pile
  // towers), but fall back to every round stack when a small case rules them all out.
  const minChips = Math.max(1, targetStackChips - 20);
  const maxChips = targetStackChips + 25;
  const round = niceStacks(capValue).filter((t) => (reachable ? reachable[t] : t % g === 0));
  const sensible = round.filter(
    (t) =>
      greedyMostChips(values, caps, t) >= minChips &&
      Math.ceil(t / values[values.length - 1]) <= maxChips,
  );
  const candidates = sensible.length > 0 ? sensible : round;
  if (candidates.length === 0) {
    const fallback = reachable
      ? snapNice(reachable, capValue, capValue)
      : capValue - (capValue % g);
    if (fallback > 0) candidates.push(fallback);
  }

  let best: { plan: Plan; score: number; depth: number } | null = null;
  let shallowest: Plan | null = null;
  for (const t of candidates) {
    const plan = buildPlan(values, counts, players, t, targetStackChips, reachable);
    if (!plan) continue;
    const depth = plan.blinds.startingBBDepth;
    if (depth < MIN_DEPTH) {
      if (!shallowest || plan.stackValue > shallowest.stackValue) shallowest = plan;
      continue;
    }
    const score =
      plan.quality -
      depthPenalty(depth, DEPTH_WEIGHT) +
      ROUND_BONUS * Math.log10(roundness(plan.stackValue)) +
      COLOR_BONUS * plan.x.filter((c) => c > 0).length;
    if (best === null || score > best.score) best = { plan, score, depth };
  }

  // Nothing cleared the depth floor (a very small set). The richest stack it can deal is
  // still a usable game, and the result will say it plays short.
  return best?.plan ?? shallowest;
}

/** Upper bound on how many chips can make `t`: fill from the smallest chip up. */
function greedyMostChips(values: number[], caps: number[], t: number): number {
  let remaining = t;
  let chips = 0;
  for (let i = 0; i < values.length && remaining > 0; i++) {
    const take = Math.min(caps[i], Math.floor(remaining / values[i]));
    chips += take;
    remaining -= take * values[i];
  }
  return chips;
}
