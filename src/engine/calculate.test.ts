import { describe, it, expect } from 'vitest';
import { calculate, DEFAULT_CONFIG } from './index';
import { STANDARD_300, STANDARD_500 } from './presets';
import type { Config } from './types';

function cfg(over: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...over };
}

describe('calculate (integration)', () => {
  it('solves a standard buy-in into an identical stack', () => {
    const r = calculate(STANDARD_300, cfg({ mode: 'solve', players: 6, buyIn: 500 }));
    expect(r.ok).toBe(true);
    expect(r.stackValue).toBe(500);
    const value = r.perPlayer.reduce((a, p) => a + p.value * p.count, 0);
    expect(value).toBe(500);
    expect(r.blinds).not.toBeNull();
    expect(r.blinds!.big).toBe(2 * r.blinds!.small);
  });

  it('never deals more chips than the box holds', () => {
    const players = 8;
    const r = calculate(STANDARD_300, cfg({ mode: 'solve', players, buyIn: 400 }));
    const box = new Map(STANDARD_300.denominations.map((d) => [d.id, d.count]));
    for (const p of r.perPlayer) {
      expect(players * p.count).toBeLessThanOrEqual(box.get(p.denomId)!);
    }
    for (const l of r.leftover) {
      expect(l.count).toBeGreaterThan(0);
      expect(l.count).toBeLessThanOrEqual(box.get(l.denomId)!);
    }
  });

  it('suggests a buy-in when none is given', () => {
    const r = calculate(STANDARD_500, cfg({ mode: 'suggest', players: 6 }));
    expect(r.ok).toBe(true);
    expect(r.suggestion).not.toBeNull();
    expect(r.requestedBuyIn).toBeNull();
    expect(r.stackValue).toBe(r.suggestion!.buyIn);
  });

  it('maps money when a cash buy-in is set', () => {
    const r = calculate(
      STANDARD_300,
      cfg({ mode: 'solve', players: 6, buyIn: 1000, moneyBuyIn: 20 }),
    );
    expect(r.money).not.toBeNull();
    expect(r.money!.perChipValue).toBeCloseTo(0.02);
  });

  it('warns and snaps when the buy-in is richer than the box allows', () => {
    const r = calculate(STANDARD_300, cfg({ mode: 'solve', players: 10, buyIn: 100000 }));
    expect(r.warnings.some((w) => w.code === 'infeasible')).toBe(true);
    expect(r.stackValue).toBeLessThan(100000);
  });

  it('rejects an empty chip set', () => {
    const r = calculate({ denominations: [] }, cfg({ mode: 'solve', players: 6, buyIn: 100 }));
    expect(r.ok).toBe(false);
    expect(r.warnings.some((w) => w.code === 'input')).toBe(true);
  });

  it('clamps player counts outside 2 to 10', () => {
    const r = calculate(STANDARD_300, cfg({ mode: 'suggest', players: 25 }));
    expect(r.warnings.some((w) => w.code === 'input')).toBe(true);
  });

  it('is deterministic end to end', () => {
    const a = calculate(STANDARD_500, cfg({ mode: 'solve', players: 7, buyIn: 1500 }));
    const b = calculate(STANDARD_500, cfg({ mode: 'solve', players: 7, buyIn: 1500 }));
    expect(a).toEqual(b);
  });
});
