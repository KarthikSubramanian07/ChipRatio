import { describe, it, expect } from 'vitest';
import { blindLadder, chooseBlinds, deriveBlinds } from './blinds';
import { isNiceCents } from './nice';

describe('chooseBlinds', () => {
  it('targets roughly 100 big blinds deep', () => {
    expect(chooseBlinds(2000, 1)).toEqual({ small: 10, big: 20 });
    expect(chooseBlinds(1000, 1)).toEqual({ small: 5, big: 10 });
    expect(chooseBlinds(10000, 25)).toEqual({ small: 50, big: 100 });
  });

  it('only picks blinds postable with the smallest chip', () => {
    expect(chooseBlinds(1000, 5).small % 5).toBe(0);
    expect(chooseBlinds(3000, 25).small % 25).toBe(0);
  });

  it('prices cash blinds in real money', () => {
    expect(chooseBlinds(2000, 10, true)).toEqual({ small: 10, big: 20 }); // $20 -> 10¢/20¢
    expect(chooseBlinds(10000, 25, true)).toEqual({ small: 50, big: 100 }); // $100 -> 50¢/$1
    const { small, big } = chooseBlinds(5000, 5, true);
    expect(isNiceCents(small) && isNiceCents(big)).toBe(true);
  });

  it('never divides by zero', () => {
    expect(chooseBlinds(100, 0)).toEqual({ small: 1, big: 2 });
    expect(chooseBlinds(0, 5)).toEqual({ small: 5, big: 10 });
  });
});

describe('blindLadder', () => {
  it('falls back to multiples of an odd smallest chip', () => {
    const ladder = blindLadder(7, false);
    expect(ladder.length).toBeGreaterThan(0);
    for (const sb of ladder) expect(sb % 7).toBe(0);
  });
});

describe('deriveBlinds', () => {
  it('builds a tournament schedule from real, rising levels', () => {
    const b = deriveBlinds(1000, 1, { cash: false });
    expect(b.schedule.map((l) => `${l.small}/${l.big}`)).toEqual([
      '5/10',
      '10/20',
      '15/30',
      '25/50',
      '40/80',
      '75/150',
      '150/300',
      '250/500',
    ]);
  });

  it('keeps every level a multiple of the smallest chip', () => {
    const b = deriveBlinds(5000, 25, { cash: false });
    for (let i = 1; i < b.schedule.length; i++) {
      expect(b.schedule[i].big).toBeGreaterThan(b.schedule[i - 1].big);
    }
    for (const level of b.schedule) expect(level.small % 25).toBe(0);
  });

  it('never produces the old off-ladder levels like 2/3 or 14/27', () => {
    const b = deriveBlinds(200, 1, { cash: false });
    for (const level of b.schedule) {
      expect(level.big).toBe(2 * level.small);
      expect([1, 2, 5].includes(level.small) || level.small % 5 === 0).toBe(true);
    }
  });

  it('holds cash blinds still', () => {
    const b = deriveBlinds(2000, 10, { cash: true });
    expect(b.schedule).toEqual([]);
    expect(b.startingBBDepth).toBe(100);
  });
});
