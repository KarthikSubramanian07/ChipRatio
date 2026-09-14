import { describe, it, expect } from 'vitest';
import { allocate, capsAndCapValue, reachableFor, type AllocationOptions } from './allocate';

const OPTS: AllocationOptions = { targetStackChips: 30 };

function stackValue(x: number[], values: number[]): number {
  return x.reduce((acc, c, i) => acc + c * values[i], 0);
}

describe('allocate', () => {
  it('hits an exact reachable target and stays within caps', () => {
    const values = [1, 5, 25, 100];
    const counts = [100, 100, 50, 50];
    const players = 6;
    const a = allocate(values, counts, players, 137, OPTS);

    expect(a.feasible).toBe(true);
    expect(a.snapped).toBe(false);
    expect(a.value).toBe(137);
    expect(stackValue(a.x, values)).toBe(137);
    a.x.forEach((c, i) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(players * c).toBeLessThanOrEqual(counts[i]);
    });
  });

  it('is fully deterministic', () => {
    const values = [1, 5, 25, 100];
    const counts = [100, 100, 50, 50];
    expect(allocate(values, counts, 5, 300, OPTS)).toEqual(allocate(values, counts, 5, 300, OPTS));
  });

  it('snaps to the nearest reachable value when the target is not formable', () => {
    const a = allocate([5, 25], [10, 4], 2, 7, OPTS);
    expect(a.snapped).toBe(true);
    expect(a.value).toBe(5);
    expect(stackValue(a.x, [5, 25])).toBe(a.value);
  });

  it('snaps down to the richest stack when the target is too big', () => {
    const a = allocate([5, 25], [10, 4], 2, 100000, OPTS);
    expect(a.snapped).toBe(true);
    expect(a.value).toBe(75); // five 5s + two 25s per player
  });

  it('reports infeasible when the case cannot seat the players', () => {
    const a = allocate([1, 5], [1, 1], 2, 10, OPTS);
    expect(a.feasible).toBe(false);
    expect(a.capValue).toBe(0);
  });

  it('builds a pyramid: never more of a bigger chip than a smaller one', () => {
    const values = [1, 5, 25, 100];
    const a = allocate(values, [200, 200, 100, 100], 8, 500, OPTS);
    expect(a.value).toBe(500);
    for (let i = 1; i < a.x.length; i++) expect(a.x[i]).toBeLessThanOrEqual(a.x[i - 1]);
  });

  it('prefers counts you can deal in fives', () => {
    // 200 on 1/5/25 with plenty of chips: 25 + 10x5 + 5x25 beats odd splits like 17/7/6.
    const a = allocate([1, 5, 25], [200, 200, 200], 4, 200, { targetStackChips: 40 });
    const awkward = a.x.filter((c) => c > 5 && c % 5 !== 0);
    expect(awkward).toEqual([]);
  });

  it('solves a rich 500-set quickly', () => {
    const values = [1, 5, 25, 100, 500];
    const start = performance.now();
    const a = allocate(values, [150, 150, 100, 75, 25], 4, 2000, OPTS);
    expect(a.value).toBe(2000);
    expect(stackValue(a.x, values)).toBe(2000);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('treats 0 players as infeasible rather than dividing by zero', () => {
    const a = allocate([1, 5, 25], [100, 100, 50], 0, 100, OPTS);
    expect(a.feasible).toBe(false);
    expect(Number.isFinite(a.capValue)).toBe(true);
  });
});

describe('capsAndCapValue', () => {
  it('caps each denomination at floor(count / players)', () => {
    const { caps, capValue } = capsAndCapValue([1, 5, 25], [10, 10, 10], 3);
    expect(caps).toEqual([3, 3, 3]);
    expect(capValue).toBe(3 + 15 + 75);
  });

  it('returns zero caps for zero or negative players', () => {
    expect(capsAndCapValue([1, 5], [10, 10], 0)).toEqual({ caps: [0, 0], capValue: 0 });
    expect(capsAndCapValue([1, 5], [10, 10], -1)).toEqual({ caps: [0, 0], capValue: 0 });
  });
});

describe('reachableFor', () => {
  it('skips the table for absurd stack values instead of allocating it', () => {
    expect(reachableFor([100_000_000], [2], 200_000_000)).toBeNull();
    expect(reachableFor([1], [0], 0)).toBeNull();
    expect(reachableFor([1, 5], [2, 2], 12)![7]).toBe(true);
  });
});
