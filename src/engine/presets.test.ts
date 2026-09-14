import { describe, it, expect } from 'vitest';
import { PRESETS, STANDARD_300, matchingPresetId, cloneSet } from './presets';

describe('matchingPresetId', () => {
  it('recognizes every preset as itself', () => {
    for (const p of PRESETS) {
      expect(matchingPresetId(p.set)).toBe(p.id);
    }
  });

  it('recognizes a clone regardless of denomination order or ids', () => {
    const cloned = cloneSet(STANDARD_300);
    cloned.denominations.reverse();
    cloned.denominations.forEach((d) => (d.id = `shuffled-${d.color}`));
    expect(matchingPresetId(cloned)).toBe('standard-300');
  });

  it('falls back to custom once a value has been edited', () => {
    const edited = cloneSet(STANDARD_300);
    edited.denominations[0].count += 1;
    expect(matchingPresetId(edited)).toBe('custom');
  });

  it('has at least one preset covering common set sizes', () => {
    const labels = PRESETS.map((p) => p.label);
    expect(labels).toContain('Standard 300');
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});
