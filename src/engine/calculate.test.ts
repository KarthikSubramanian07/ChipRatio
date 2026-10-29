import { describe, it, expect } from 'vitest';
import { calculate, DEFAULT_CONFIG } from './index';
import { DEFAULT_SET, STANDARD_300, STANDARD_500, STARTER_100 } from './presets';
import type { ChipSet, Config } from './types';

function cfg(over: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...over };
}

describe('calculate: cash games', () => {
  it('defaults to a $20 game with real-money chip prices', () => {
    const r = calculate(STANDARD_300, DEFAULT_CONFIG);
    expect(r.ok).toBe(true);
    expect(r.game).toBe('cash');
    expect(r.stackValue).toBe(2000);
    expect(r.perPlayer.map((p) => p.cents)).toEqual(
      [10, 50, 250, 1000].slice(0, r.perPlayer.length),
    );
    expect(r.blinds).toMatchObject({ small: 10, big: 20 });
  });

  it('asks for a buy-in instead of guessing one', () => {
    const r = calculate(STANDARD_300, cfg({ buyInCents: null }));
    expect(r.ok).toBe(false);
    expect(r.warnings[0].message).toMatch(/buys in/);
  });

  it('warns in plain words when the case is too small for the buy-in', () => {
    // $10 million each is beyond even $1,000 chips for ten players.
    const r = calculate(STANDARD_300, cfg({ players: 10, buyInCents: 1_000_000_000 }));
    expect(r.ok).toBe(true);
    const w = r.warnings.find((x) => x.code === 'amount-adjusted');
    expect(w?.message).toMatch(/Not enough chips/);
  });

  it('warns when a pinned chip price does not fit the set', () => {
    const set: ChipSet = {
      denominations: [
        { id: 'a', color: 'white', value: 2, count: 100 },
        { id: 'b', color: 'red', value: 5, count: 100 },
      ],
    };
    const r = calculate(set, cfg({ players: 4, smallestChipCents: 1 }));
    expect(r.warnings.some((w) => w.code === 'chip-value-ignored')).toBe(true);
  });

  it('uses the currency symbol in its wording', () => {
    const r = calculate(STARTER_100, cfg({ players: 10, buyInCents: 2003, currency: '€' }));
    const adjusted = r.warnings.find((w) => w.code === 'amount-adjusted');
    expect(adjusted?.message).toContain('€');
  });
});

describe('calculate: tournaments', () => {
  it('picks a round stack and a rising schedule', () => {
    const r = calculate(STANDARD_500, cfg({ game: 'tournament', players: 6 }));
    expect(r.ok).toBe(true);
    expect(r.autoPicked).toBe(true);
    expect(r.requested).toBeNull();
    expect(r.stackValue % 50).toBe(0);
    expect(r.perPlayer.every((p) => p.cents === null)).toBe(true);
    expect(r.blinds!.schedule.length).toBe(8);
  });

  it('explains when a host-picked stack had to change', () => {
    const r = calculate(STANDARD_300, cfg({ game: 'tournament', players: 6, startingStack: 1500 }));
    expect(r.stackValue).toBe(1000);
    const w = r.warnings.find((x) => x.code === 'amount-adjusted');
    expect(w?.message).toContain('1,500');
    expect(w?.message).toContain('1,000');
  });
});

describe('calculate: shared behavior', () => {
  it('never deals more chips than the case holds and counts rebuys honestly', () => {
    const players = 8;
    const r = calculate(STANDARD_300, cfg({ players, buyInCents: 1000 }));
    const box = new Map(STANDARD_300.denominations.map((d) => [d.id, d.count]));
    for (const p of r.perPlayer) expect(players * p.count).toBeLessThanOrEqual(box.get(p.denomId)!);
    for (const p of r.perPlayer) {
      const left = r.leftover.find((l) => l.denomId === p.denomId)?.count ?? 0;
      expect(Math.floor(left / p.count)).toBeGreaterThanOrEqual(r.rebuys);
    }
  });

  it('rejects an empty chip set', () => {
    const r = calculate({ denominations: [] }, DEFAULT_CONFIG);
    expect(r.ok).toBe(false);
    expect(r.warnings.some((w) => w.code === 'input')).toBe(true);
  });

  it('clamps player counts and says so', () => {
    const r = calculate(STANDARD_300, cfg({ players: 25 }));
    expect(r.warnings.some((w) => w.code === 'input')).toBe(true);
  });

  it('reports not-enough-chips for a starved case', () => {
    const starved: ChipSet = { denominations: [{ id: 'a', color: 'white', value: 1, count: 1 }] };
    const r = calculate(starved, cfg({ game: 'tournament', players: 6 }));
    expect(r.ok).toBe(false);
    expect(r.warnings.some((w) => w.code === 'not-enough-chips')).toBe(true);
  });

  it('flags a thin stack from a small case', () => {
    const r = calculate(STARTER_100, cfg({ players: 6 }));
    expect(r.warnings.some((w) => w.code === 'thin-stack' || w.code === 'few-small-chips')).toBe(
      true,
    );
  });

  it('flags a short game', () => {
    const tiny: ChipSet = {
      denominations: [
        { id: 'w', color: 'white', value: 1, count: 40 },
        { id: 'r', color: 'red', value: 5, count: 20 },
      ],
    };
    const r = calculate(tiny, cfg({ game: 'tournament', players: 6 }));
    expect(r.warnings.some((w) => w.code === 'short-stack')).toBe(true);
  });

  it('ignores junk denominations', () => {
    const junk: ChipSet = {
      denominations: [
        { id: 'a', color: 'white', value: 0, count: 100 },
        { id: 'b', color: 'red', value: 5, count: 1.5 },
        { id: 'c', color: 'green', value: 25, count: 100 },
      ],
    };
    const r = calculate(junk, cfg({ game: 'tournament', players: 4 }));
    expect(r.perPlayer.every((p) => p.denomId === 'c')).toBe(true);
  });

  it('never uses an em dash in any message (house style)', () => {
    for (const game of ['cash', 'tournament'] as const) {
      const r = calculate(STARTER_100, cfg({ game, players: 10, startingStack: 99999 }));
      for (const w of r.warnings) expect(w.message).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe('calculate: the first-open default', () => {
  it('deals a $20 stack from five colors with no chip over $2', () => {
    const r = calculate(DEFAULT_SET, DEFAULT_CONFIG);
    expect(DEFAULT_SET.denominations.map((d) => d.color)).toContain('blue');
    expect(DEFAULT_SET.denominations).toHaveLength(5);
    expect(r.stackValue).toBe(2000);
    expect(r.perPlayer.map((p) => [p.color, p.count, p.cents])).toEqual([
      ['white', 15, 10],
      ['red', 5, 20],
      ['blue', 5, 50],
      ['green', 5, 100],
      ['black', 5, 200],
    ]);
    expect(r.blinds).toMatchObject({ small: 10, big: 20 });
    expect(r.warnings).toEqual([]);
  });
});
