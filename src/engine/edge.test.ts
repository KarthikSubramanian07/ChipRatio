import { describe, it, expect } from 'vitest';
import { allocate } from './allocate';
import { nearestReachable, reachableSums } from './math';
import { calculate, DEFAULT_CONFIG } from './index';
import { buildSummary } from './summary';
import type { ChipSet, Config } from './types';

// Edge cases and the warning branches, exercised directly so the less-travelled paths of
// the engine stay covered and honest.

function cfg(over: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...over };
}

const coarse: ChipSet = {
  denominations: [
    { id: 'a', color: 'red', value: 2, count: 68 },
    { id: 'b', color: 'green', value: 10, count: 60 },
    { id: 'c', color: 'black', value: 50, count: 28 },
  ],
};

const noOnes: ChipSet = {
  denominations: [
    { id: 'r', color: 'red', value: 5, count: 80 },
    { id: 'g', color: 'green', value: 25, count: 60 },
    { id: 'b', color: 'black', value: 100, count: 40 },
  ],
};

describe('uneven small chips', () => {
  it('hits the exact table total by varying the smallest chip', () => {
    const a = allocate([2, 10, 50], [68, 60, 28], 4, 245, {
      targetStackChips: 30,
      allowUnevenSmallChips: true,
    });
    expect(a.unevenSmall).not.toBeNull();
    expect(a.tableValue).toBe(4 * 245); // 980 exactly, even though 245 is odd
    const used = a.x.map(
      (c, i) =>
        4 * c + (a.unevenSmall && i === a.unevenSmall.index ? a.unevenSmall.extraPlayers : 0),
    );
    used.forEach((u, i) => {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual([68, 60, 28][i]);
    });
  });

  it('keeps every stack identical when the option is off', () => {
    const a = allocate([2, 10, 50], [68, 60, 28], 4, 245, {
      targetStackChips: 30,
      allowUnevenSmallChips: false,
    });
    expect(a.unevenSmall).toBeNull();
    expect(a.snapped).toBe(true); // 245 is odd, unreachable with even-only chips
  });

  it('surfaces the uneven warning through calculate', () => {
    const r = calculate(
      coarse,
      cfg({ mode: 'solve', players: 4, buyIn: 245, allowUnevenSmallChips: true }),
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === 'uneven-small-chips')).toBe(true);
    expect(r.unevenSmall).not.toBeNull();
  });
});

describe('warning branches', () => {
  it('flags granularity when no chip splits the buy-in finely', () => {
    const r = calculate(noOnes, cfg({ mode: 'solve', players: 4, buyIn: 342 }));
    expect(r.warnings.some((w) => w.code === 'buyin-snapped')).toBe(true);
    expect(r.warnings.some((w) => w.code === 'granularity-limited')).toBe(true);
  });

  it('flags a shallow stack for a tiny buy-in', () => {
    const r = calculate(noOnes, cfg({ mode: 'solve', players: 4, buyIn: 40 }));
    expect(r.warnings.some((w) => w.code === 'shallow-stack')).toBe(true);
  });

  it('flags too few small chips', () => {
    const lumpy: ChipSet = {
      denominations: [
        { id: 'w', color: 'white', value: 1, count: 200 },
        { id: 'r', color: 'red', value: 5, count: 20 },
        { id: 'b', color: 'black', value: 100, count: 60 },
      ],
    };
    const r = calculate(lumpy, cfg({ mode: 'solve', players: 4, buyIn: 500 }));
    expect(r.warnings.some((w) => w.code === 'few-small-chips')).toBe(true);
  });

  it('reports not-enough-chips in suggest mode for a starved box', () => {
    const starved: ChipSet = { denominations: [{ id: 'a', color: 'white', value: 1, count: 1 }] };
    const r = calculate(starved, cfg({ mode: 'suggest', players: 6 }));
    expect(r.ok).toBe(false);
    expect(r.warnings.some((w) => w.code === 'not-enough-chips')).toBe(true);
  });

  it('falls back to Smart Suggest when solve mode has no buy-in', () => {
    const r = calculate(noOnes, cfg({ mode: 'solve', players: 4, buyIn: null }));
    expect(r.suggestion).not.toBeNull();
    expect(r.warnings.some((w) => w.code === 'input')).toBe(true);
  });
});

describe('nearestReachable never snaps a positive target down to 0', () => {
  it('picks the smallest positive reachable value over the degenerate 0', () => {
    // Only 5s and 25s in the box: 1 is not reachable, and 0 is trivially "reachable"
    // but is not a real stack. The nearest real stack is 5, not 0.
    const reachable = reachableSums([5, 25], [4, 4], 120);
    expect(nearestReachable(reachable, 1, 120)).toBe(5);
    expect(nearestReachable(reachable, 3, 120)).toBe(5);
  });

  it('still returns 0 when 0 is genuinely what was asked for', () => {
    const reachable = reachableSums([5, 25], [4, 4], 120);
    expect(nearestReachable(reachable, 0, 120)).toBe(0);
  });
});

describe('fractional or non-positive buy-ins fall back to Smart Suggest', () => {
  it('treats a buy-in that floors to 0 as no buy-in, instead of dealing an empty stack', () => {
    const r = calculate(coarse, cfg({ mode: 'solve', players: 4, buyIn: 0.5 }));
    expect(r.ok).toBe(true);
    expect(r.stackValue).toBeGreaterThan(0);
    expect(r.suggestion).not.toBeNull();
    expect(r.warnings.some((w) => w.code === 'input')).toBe(true);
  });

  it('treats a negative buy-in the same way', () => {
    const r = calculate(coarse, cfg({ mode: 'solve', players: 4, buyIn: -50 }));
    expect(r.ok).toBe(true);
    expect(r.suggestion).not.toBeNull();
  });
});

describe('summary of a failed result', () => {
  it('renders warnings without a stack and never crashes', () => {
    const r = calculate({ denominations: [] }, cfg({ mode: 'solve', players: 4, buyIn: 100 }));
    const text = buildSummary(r, { players: 4 });
    expect(text).toContain('ChipRatio');
    expect(text).toContain('chipratio.pages.dev');
    expect(text).not.toContain('Each player gets');
  });
});
