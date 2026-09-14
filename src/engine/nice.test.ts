import { describe, it, expect } from 'vitest';
import { isNiceCents, niceStacks, roundness, snapNice } from './nice';
import { reachableSums } from './math';

describe('isNiceCents', () => {
  it('accepts amounts that look like real money denominations', () => {
    for (const c of [1, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2500]) {
      expect(isNiceCents(c)).toBe(true);
    }
  });

  it('rejects amounts nobody makes change with', () => {
    for (const c of [0, 3, 28, 75, 125, 1250, 0.5, -10]) expect(isNiceCents(c)).toBe(false);
  });
});

describe('roundness', () => {
  it('ranks rounder numbers higher', () => {
    expect(roundness(1000)).toBeGreaterThan(roundness(1050));
    expect(roundness(1050)).toBeGreaterThan(roundness(1040));
    expect(roundness(1096)).toBeLessThan(roundness(1100));
    expect(roundness(0)).toBe(0);
  });
});

describe('niceStacks', () => {
  it('lists familiar starting stacks up to a limit', () => {
    const stacks = niceStacks(1100);
    expect(stacks).toContain(500);
    expect(stacks).toContain(1000);
    expect(stacks).not.toContain(1096);
    expect(Math.max(...stacks)).toBeLessThanOrEqual(1100);
  });
});

describe('snapNice', () => {
  // 300-piece set, 6 players: caps 16/16/8/8 on 1/5/25/100, richest stack 1,096.
  const reachable = reachableSums([1, 5, 25, 100], [16, 16, 8, 8], 1096);

  it('keeps a reachable target as is', () => {
    expect(snapNice(reachable, 500, 1096)).toBe(500);
  });

  it('drops a too-big target to a round number, not the raw maximum', () => {
    expect(snapNice(reachable, 1500, 1096)).toBe(1000);
  });

  it('snaps an unreachable target to the roundest nearby value', () => {
    const coarse = reachableSums([5, 25], [10, 10], 300);
    expect(snapNice(coarse, 102, 300)).toBe(100);
  });

  it('returns 0 only for a zero target', () => {
    expect(snapNice(reachable, 0, 1096)).toBe(0);
  });
});
