import { describe, it, expect } from 'vitest';
import { chooseBlinds, deriveBlinds } from './blinds';

describe('chooseBlinds', () => {
  it('targets roughly 100 big blinds deep', () => {
    // 2000 chips -> 10/20 lands exactly 100 BB.
    expect(chooseBlinds(2000, 1)).toEqual({ small: 10, big: 20 });
    // 1000 chips -> 5/10 lands exactly 100 BB.
    expect(chooseBlinds(1000, 1)).toEqual({ small: 5, big: 10 });
  });

  it('keeps big buy-ins from producing silly depths', () => {
    const { small, big } = chooseBlinds(2000, 1);
    const depth = 2000 / big;
    expect(depth).toBeLessThanOrEqual(150);
    expect(depth).toBeGreaterThanOrEqual(50);
    expect(big).toBe(2 * small);
  });

  it('scales the blind to the smallest chip so blinds stay postable', () => {
    const { small } = chooseBlinds(1000, 5);
    expect(small % 5).toBe(0);
  });

  it('never divides by zero', () => {
    expect(chooseBlinds(100, 0)).toEqual({ small: 1, big: 2 });
    expect(chooseBlinds(0, 5)).toEqual({ small: 5, big: 10 });
  });
});

describe('deriveBlinds', () => {
  it('computes big blind depth near the target', () => {
    const b = deriveBlinds(1000, 5);
    expect(b.big).toBe(2 * b.small);
    expect(b.startingBBDepth).toBeGreaterThan(40);
    expect(b.startingBBDepth).toBeLessThan(150);
  });

  it('produces a strictly increasing, postable schedule', () => {
    const b = deriveBlinds(1000, 5);
    expect(b.schedule.length).toBeGreaterThan(0);
    for (let i = 1; i < b.schedule.length; i++) {
      expect(b.schedule[i].big).toBeGreaterThan(b.schedule[i - 1].big);
    }
    for (const level of b.schedule) {
      expect(level.small % 5).toBe(0);
      expect(level.big % 5).toBe(0);
      expect(level.small).toBeGreaterThan(0);
    }
  });

  it('escalates roughly 1.5x per level', () => {
    const b = deriveBlinds(2000, 1);
    const ratio = b.schedule[1].big / b.schedule[0].big;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(2.1);
  });
});
