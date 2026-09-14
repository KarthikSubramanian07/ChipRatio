// "Nice" numbers. The whole point of ChipRatio is that a human reads the answer out loud
// at a table, so every amount it shows should be one a person would pick on their own:
// a white chip worth 10¢ (never 28¢), a starting stack of 1,000 (never 1,096), blinds of
// 25/50 (never 14/27). These helpers define what counts as nice, in one place.

/**
 * True for cash amounts in cents that look like real money denominations: 1, 2, 5 or 25
 * followed by any number of zeros. So 5¢, 10¢, 25¢, 50¢, $1, $2, $2.50, $5, $10, $25 ...
 * are nice, and 28¢, 75¢, $1.25 or $12.50 are not.
 */
export function isNiceCents(cents: number): boolean {
  if (!Number.isInteger(cents) || cents < 1) return false;
  let m = cents;
  while (m >= 10 && m % 10 === 0) m /= 10;
  return m === 1 || m === 2 || m === 5 || m === 25;
}

/** Candidate values for "what is the smallest chip worth", smallest first. */
export const CHIP_CENTS_LADDER: number[] = [
  1, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000,
  100000,
];

/**
 * Steps that make a number feel round, biggest first. A starting stack of 1,000 is rounder
 * than 1,050, which is rounder than 1,040. Used to rank otherwise similar choices.
 */
const ROUND_STEPS = [
  1_000_000, 500_000, 250_000, 100_000, 50_000, 25_000, 10_000, 5000, 2500, 1000, 500, 250, 100, 50,
  25, 10, 5, 2, 1,
];

/** The biggest round step that divides n (1 for an ugly number, 1000 for 3000). */
export function roundness(n: number): number {
  if (!Number.isInteger(n) || n <= 0) return 0;
  for (const step of ROUND_STEPS) {
    if (n % step === 0) return step;
  }
  return 1;
}

/** Mantissas for starting stacks and blind levels people actually use. */
const STACK_MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8];

/** Round starting stacks, ascending: 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 150 ... */
export function niceStacks(max: number): number[] {
  const out: number[] = [];
  for (let scale = 10; scale <= max; scale *= 10) {
    for (const m of STACK_MANTISSAS) {
      const n = m * scale;
      if (n <= max) out.push(n);
    }
  }
  return out;
}

/**
 * Small blinds from real structures, ascending. Big blind is always double. The low end
 * (1/2, 2/4, 5/10) covers sets whose smallest chip is a 1; the rest is the familiar
 * 10/20, 15/30, 25/50, 50/100 ... ladder.
 */
export const SMALL_BLIND_LADDER: number[] = (() => {
  const out = [1, 2, 5];
  for (let scale = 10; scale <= 1_000_000; scale *= 10) {
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5]) out.push(m * scale);
  }
  return out;
})();

/**
 * Snap a requested amount to one the box can build, preferring round numbers. Within 10%
 * of what was asked, the roundest reachable value wins (so 1,500 on a box that tops out at
 * 1,096 becomes 1,000, not 1,096). If nothing reachable is that close, the plain nearest
 * reachable value is used.
 */
export function snapNice(reachable: boolean[], target: number, capValue: number): number {
  const t = Math.max(0, Math.min(Math.round(target), capValue));
  if (t === 0) return 0;
  if (reachable[t] && target <= capValue) return t;

  const anchor = Math.min(target, capValue);
  const lo = Math.max(1, Math.floor(anchor * 0.9));
  const hi = Math.min(capValue, Math.ceil(target * 1.1));
  let best = 0;
  for (let v = lo; v <= hi; v++) {
    if (!reachable[v]) continue;
    if (
      best === 0 ||
      roundness(v) > roundness(best) ||
      (roundness(v) === roundness(best) && Math.abs(v - target) < Math.abs(best - target))
    ) {
      best = v;
    }
  }
  if (best > 0) return best;

  for (let d = 1; d <= capValue; d++) {
    if (t - d >= 1 && reachable[t - d]) return t - d;
    if (t + d <= capValue && reachable[t + d]) return t + d;
  }
  return 0;
}
