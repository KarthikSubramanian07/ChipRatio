import { describe, it, expect } from 'vitest';
import { buildSummary } from './summary';
import { calculate, DEFAULT_CONFIG } from './index';
import { STANDARD_300 } from './presets';

describe('buildSummary', () => {
  it('renders a readable share block', () => {
    const r = calculate(STANDARD_300, { ...DEFAULT_CONFIG, mode: 'solve', players: 6, buyIn: 500 });
    const text = buildSummary(r, { players: 6 });
    expect(text).toContain('ChipRatio');
    expect(text).toContain('Buy-in: 500');
    expect(text).toContain('Blinds:');
    expect(text).toContain('chipratio.pages.dev');
  });

  it('includes cash values when money is set', () => {
    const r = calculate(STANDARD_300, {
      ...DEFAULT_CONFIG,
      mode: 'solve',
      players: 6,
      buyIn: 1000,
      moneyBuyIn: 20,
    });
    const text = buildSummary(r, { players: 6, moneySymbol: '$' });
    expect(text).toContain('$20.00');
  });

  it('never uses an em dash (house style)', () => {
    const r = calculate(STANDARD_300, { ...DEFAULT_CONFIG, mode: 'suggest', players: 5 });
    const text = buildSummary(r, { players: 5 });
    expect(text).not.toContain('—');
  });

  it('notes the uneven-small-chips asymmetry when it applies', () => {
    const coarseSet = {
      denominations: [
        { id: 'a', color: 'red', value: 2, count: 68 },
        { id: 'b', color: 'green', value: 10, count: 60 },
        { id: 'c', color: 'black', value: 50, count: 28 },
      ],
    };
    const r = calculate(coarseSet, {
      ...DEFAULT_CONFIG,
      mode: 'solve',
      players: 4,
      buyIn: 245,
      allowUnevenSmallChips: true,
    });
    expect(r.unevenSmall).not.toBeNull();
    const text = buildSummary(r, { players: 4 });
    expect(text).toMatch(/get (an extra|one fewer) of the smallest chip/);
  });
});
