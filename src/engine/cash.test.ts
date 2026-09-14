import { describe, it, expect } from 'vitest';
import { planCash, smallestChipOptions } from './cash';
import { isNiceCents } from './nice';

// 300-piece set: 100 white (1), 100 red (5), 50 green (25), 50 black (100).
const VALUES = [1, 5, 25, 100];
const COUNTS = [100, 100, 50, 50];

function stackCents(x: number[], worth: number[]): number {
  return x.reduce((a, c, i) => a + c * worth[i], 0);
}

describe('planCash', () => {
  it('turns $20 into chips worth real money, exactly', () => {
    const plan = planCash(VALUES, COUNTS, 6, 2000, null, 30)!;
    expect(plan.stackValue).toBe(2000);
    expect(stackCents(plan.x, plan.worth)).toBe(2000);
    expect(plan.adjusted).toBe(false);
    expect(plan.worth.every(isNiceCents)).toBe(true);
  });

  it('never prices a chip at an odd amount like 28¢ (the old per-chip division bug)', () => {
    for (const cents of [500, 1000, 1500, 2000, 2500, 3000, 5000, 7500, 10000]) {
      for (const players of [3, 5, 6, 8, 10]) {
        const plan = planCash(VALUES, COUNTS, players, cents, null, 30);
        if (!plan) continue;
        expect(plan.worth.every(isNiceCents)).toBe(true);
        expect(isNiceCents(plan.blinds.small)).toBe(true);
      }
    }
  });

  it('keeps the printed ratio between colors', () => {
    const plan = planCash(VALUES, COUNTS, 6, 2000, null, 30)!;
    plan.worth.forEach((c, i) => expect(c / plan.worth[0]).toBe(VALUES[i]));
  });

  it('opens around 100 big blinds deep for a standard buy-in', () => {
    const plan = planCash(VALUES, COUNTS, 6, 2000, null, 30)!;
    expect(plan.blinds.startingBBDepth).toBeGreaterThanOrEqual(50);
    expect(plan.blinds.startingBBDepth).toBeLessThanOrEqual(150);
  });

  it('honors a pinned smallest-chip value', () => {
    const plan = planCash(VALUES, COUNTS, 6, 2000, 5, 30)!;
    expect(plan.worth[0]).toBe(5);
    expect(plan.pinIgnored).toBe(false);
  });

  it('ignores a pin that would put fractions of a cent on a chip', () => {
    const plan = planCash([2, 5], [100, 100], 4, 2000, 1, 30)!;
    expect(plan.pinIgnored).toBe(true);
    expect(plan.stackValue).toBe(2000);
  });

  it('scales chip values up for a big buy-in instead of giving up', () => {
    const plan = planCash(VALUES, COUNTS, 6, 50000, null, 30)!;
    expect(plan.stackValue).toBe(50000);
  });

  it('reports the closest round amount when the exact buy-in is impossible', () => {
    // Only 5s and 25s, two players: odd cent amounts cannot be built at any chip price.
    const plan = planCash([5, 25], [10, 10], 2, 2003, null, 30)!;
    expect(plan.adjusted).toBe(true);
    expect(plan.stackValue).not.toBe(2003);
  });

  it('returns null when the case cannot seat everyone', () => {
    expect(planCash([1], [1], 2, 2000, null, 30)).toBeNull();
  });
});

describe('smallestChipOptions', () => {
  it('only offers pins that keep every color at a clean price', () => {
    const options = smallestChipOptions(VALUES);
    expect(options).toContain(10);
    expect(options).toContain(20);
    expect(options).not.toContain(25); // would make green $6.25
    expect(options).not.toContain(5); // would make green $1.25
  });

  it('handles an empty set', () => {
    expect(smallestChipOptions([])).toEqual([]);
  });
});
