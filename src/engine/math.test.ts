import { describe, it, expect } from 'vitest';
import { gcd, gcdAll, clamp, sum, reachableSums, canMakeExact } from './math';

describe('gcd', () => {
  it('computes the greatest common divisor', () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(5, 25)).toBe(5);
    expect(gcd(7, 13)).toBe(1);
  });

  it('handles zero as identity', () => {
    expect(gcd(0, 9)).toBe(9);
    expect(gcd(9, 0)).toBe(9);
  });
});

describe('gcdAll', () => {
  it('reduces a list', () => {
    expect(gcdAll([5, 25, 100])).toBe(5);
    expect(gcdAll([1, 5, 25])).toBe(1);
    expect(gcdAll([10, 20, 50])).toBe(10);
  });

  it('returns 0 for an empty list', () => {
    expect(gcdAll([])).toBe(0);
  });
});

describe('clamp and sum', () => {
  it('clamps to range', () => {
    expect(clamp(5, 2, 10)).toBe(5);
    expect(clamp(1, 2, 10)).toBe(2);
    expect(clamp(99, 2, 10)).toBe(10);
  });

  it('sums a list', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});

describe('reachableSums', () => {
  it('marks exactly the formable values', () => {
    const r = reachableSums([1, 5, 25], [3, 2, 1], 38);
    expect(r[0]).toBe(true);
    expect(r[1]).toBe(true); // one 1
    expect(r[3]).toBe(true); // three 1s
    expect(r[4]).toBe(false); // cannot make 4 (only three 1s, no 4)
    expect(r[6]).toBe(true); // 5 + 1
    expect(r[38]).toBe(true); // everything
    expect(r[39]).toBeUndefined();
  });

  it('respects caps via binary decomposition', () => {
    const r = reachableSums([1], [3], 3);
    expect(r[3]).toBe(true);
    expect(r[4]).toBeUndefined();
    const big = reachableSums([1], [1000], 1000);
    expect(big[1000]).toBe(true);
    expect(big[777]).toBe(true);
  });
});

describe('canMakeExact', () => {
  it('checks subset sums for making change', () => {
    expect(canMakeExact([1, 5], [1, 2], 10)).toBe(true); // two 5s
    expect(canMakeExact([1, 5], [1, 2], 11)).toBe(true); // two 5s + one 1
    expect(canMakeExact([5, 25], [3, 1], 10)).toBe(true); // two 5s
    expect(canMakeExact([5, 25], [1, 1], 10)).toBe(false); // only one 5 and a 25
    expect(canMakeExact([1, 5, 25], [0, 0, 1], 5)).toBe(false); // only a 25
  });

  it('treats zero as trivially reachable', () => {
    expect(canMakeExact([5], [0], 0)).toBe(true);
  });
});
