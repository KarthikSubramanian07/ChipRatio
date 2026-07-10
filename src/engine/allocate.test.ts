import { describe, it, expect } from 'vitest';
import { allocate, capsAndCapValue, type AllocationOptions } from './allocate';

const OPTS: AllocationOptions = { targetStackChips: 30, allowUnevenSmallChips: false };

function stackValue(x: number[], values: number[]): number {
  return x.reduce((acc, c, i) => acc + c * values[i], 0);
}

describe('allocate', () => {
  it('hits an exact reachable buy-in and stays within caps', () => {
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
      expect(players * c).toBeLessThanOrEqual(counts[i]); // never over-deal
    });
  });

  it('is fully deterministic', () => {
    const values = [1, 5, 25, 100];
    const counts = [100, 100, 50, 50];
    const a = allocate(values, counts, 5, 300, OPTS);
    const b = allocate(values, counts, 5, 300, OPTS);
    expect(a.x).toEqual(b.x);
    expect(a.value).toBe(b.value);
    expect(a.quality).toBe(b.quality);
  });

  it('snaps to the nearest reachable value when the buy-in is not formable', () => {
    const values = [5, 25];
    const counts = [10, 4];
    const a = allocate(values, counts, 2, 7, OPTS);
    expect(a.snapped).toBe(true);
    expect(a.value).toBe(5); // 5 is closer to 7 than 10
    expect(stackValue(a.x, values)).toBe(a.value);
  });

  it('snaps down to the richest stack when the buy-in is infeasible', () => {
    const values = [5, 25];
    const counts = [10, 4];
    const a = allocate(values, counts, 2, 100000, OPTS);
    expect(a.snapped).toBe(true);
    expect(a.value).toBe(a.capValue);
    expect(a.value).toBe(75); // caps: five 5s + two 25s per player = 25 + 50
  });

  it('reports infeasible when the box cannot seat the players', () => {
    const a = allocate([1, 5], [1, 1], 2, 10, OPTS);
    expect(a.feasible).toBe(false);
    expect(a.capValue).toBe(0);
  });

  it('produces a pyramid: never more of a bigger chip than a smaller one', () => {
    const values = [1, 5, 25, 100];
    const counts = [200, 200, 100, 100];
    const a = allocate(values, counts, 8, 500, OPTS);
    expect(a.value).toBe(500);
    for (let i = 1; i < a.x.length; i++) {
      expect(a.x[i]).toBeLessThanOrEqual(a.x[i - 1]);
    }
  });

  it('solves a rich 500-set quickly without exploding', () => {
    const values = [1, 5, 25, 100, 500];
    const counts = [150, 150, 100, 75, 25];
    const start = performance.now();
    const a = allocate(values, counts, 4, 2000, OPTS);
    const elapsed = performance.now() - start;
    expect(a.value).toBe(2000);
    expect(stackValue(a.x, values)).toBe(2000);
    expect(elapsed).toBeLessThan(500);
  });

  it('keeps allocations valid when uneven small chips are allowed', () => {
    const values = [1, 5, 25];
    const counts = [12, 12, 8];
    const a = allocate(values, counts, 3, 41, { ...OPTS, allowUnevenSmallChips: true });
    // Whatever it decides, chips must be conserved and the base stack must be valid.
    a.x.forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
    if (a.unevenSmall) {
      const used = a.x.map(
        (c, i) => 3 * c + (i === a.unevenSmall!.index ? a.unevenSmall!.extraPlayers : 0),
      );
      used.forEach((u, i) => {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(counts[i]);
      });
    }
  });

  it('treats 0 players as infeasible rather than dividing by zero', () => {
    const a = allocate([1, 5, 25], [100, 100, 50], 0, 100, OPTS);
    expect(a.feasible).toBe(false);
    expect(a.capValue).toBe(0);
    expect(Number.isFinite(a.capValue)).toBe(true);
  });
});

describe('capsAndCapValue', () => {
  it('caps each denomination at floor(count / players)', () => {
    const { caps, capValue } = capsAndCapValue([1, 5, 25], [10, 10, 10], 3);
    expect(caps).toEqual([3, 3, 3]);
    expect(capValue).toBe(3 * 1 + 3 * 5 + 3 * 25);
  });

  it('returns zero caps for zero or negative players instead of Infinity', () => {
    expect(capsAndCapValue([1, 5], [10, 10], 0)).toEqual({ caps: [0, 0], capValue: 0 });
    expect(capsAndCapValue([1, 5], [10, 10], -1)).toEqual({ caps: [0, 0], capValue: 0 });
  });
});
