// Small, dependency-free number helpers. Kept separate so they are trivial to test.

/**
 * Above this stack value, building a reachability table (an array of this many
 * booleans) is not worth it. Every caller that wants one must check this first; real
 * poker sets never come close, it only guards against absurd hand-entered chip values.
 */
export const REACHABLE_LIMIT = 4_000_000;

/** Greatest common divisor of two non-negative integers. gcd(0, n) === n. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** gcd of a list. Returns 0 for an empty list, which callers treat as "no granularity". */
export function gcdAll(nums: number[]): number {
  return nums.reduce((g, n) => gcd(g, n), 0);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

/**
 * Which values in [0, capValue] can be formed by picking x_i of denom i with
 * 0 <= x_i <= caps[i]? Classic bounded-knapsack reachability, returned as a boolean
 * array indexed by value. This is what powers "is the buy-in reachable" and
 * "snap to the nearest reachable value".
 *
 * Uses binary decomposition of each denom's count so a chip with a big cap does not
 * blow up the inner loop.
 */
export function reachableSums(values: number[], caps: number[], capValue: number): boolean[] {
  const reachable = new Array<boolean>(capValue + 1).fill(false);
  reachable[0] = true;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    let remaining = caps[i];
    if (value <= 0 || remaining <= 0) continue;

    // Binary chunks: 1, 2, 4, ... so we cover every count 0..cap with O(log cap) passes.
    for (let chunk = 1; remaining > 0; chunk = Math.min(chunk * 2, remaining)) {
      const take = Math.min(chunk, remaining);
      const add = take * value;
      for (let v = capValue; v >= add; v--) {
        if (reachable[v - add]) reachable[v] = true;
      }
      remaining -= take;
    }
  }

  return reachable;
}

/**
 * Nearest value to `target` the box can actually form. Ties go to the higher value.
 *
 * 0 chips is always trivially "reachable" but is never a real stack, so a positive
 * target never snaps down to it: if capValue > 0, capValue itself is always reachable
 * (deal every cap), which guarantees some positive candidate exists to find first.
 */
export function nearestReachable(reachable: boolean[], target: number, capValue: number): number {
  const t = clamp(target, 0, capValue);
  if (t === 0) return 0; // reachable[0] is always true by construction
  if (reachable[t]) return t;
  for (let d = 1; d <= capValue; d++) {
    const up = t + d;
    if (up <= capValue && reachable[up]) return up;
    const down = t - d;
    if (down >= 1 && reachable[down]) return down;
  }
  return 0;
}

/**
 * Can a subset of the given chips sum to exactly `target`? Used to check whether a
 * stack can make change for a blind. Small stacks, so a plain boolean DP is plenty.
 *
 * Feeds a scoring heuristic, not a feasibility check, so an absurdly large target (an
 * extreme hand-entered chip value) degrades to a conservative "no" rather than trying
 * to allocate a target-sized array.
 */
export function canMakeExact(chipValues: number[], counts: number[], target: number): boolean {
  if (target === 0) return true;
  if (target < 0 || target > REACHABLE_LIMIT) return false;
  const reachable = new Array<boolean>(target + 1).fill(false);
  reachable[0] = true;
  for (let i = 0; i < chipValues.length; i++) {
    const value = chipValues[i];
    if (value <= 0 || value > target) continue;
    let remaining = counts[i];
    for (let chunk = 1; remaining > 0; chunk = Math.min(chunk * 2, remaining)) {
      const take = Math.min(chunk, remaining);
      const add = take * value;
      for (let v = target; v >= add; v--) {
        if (reachable[v - add]) reachable[v] = true;
      }
      remaining -= take;
    }
    if (reachable[target]) return true;
  }
  return reachable[target];
}
