import { describe, it, expect } from 'vitest';
import { suggestBuyIn } from './suggest';
import { chooseBlinds } from './blinds';
import type { AllocationOptions } from './allocate';

const OPTS: AllocationOptions = { targetStackChips: 30, allowUnevenSmallChips: false };

describe('suggestBuyIn', () => {
  it('recommends a buy-in near the target depth for a standard set', () => {
    const values = [1, 5, 25, 100];
    const counts = [100, 100, 50, 50];
    const s = suggestBuyIn(values, counts, 6, OPTS);
    expect(s).not.toBeNull();
    const { big } = chooseBlinds(s!.buyIn, values[0]);
    const depth = s!.buyIn / big;
    expect(depth).toBeGreaterThanOrEqual(40);
    expect(depth).toBeLessThanOrEqual(150);
    expect(s!.rationale).toMatch(/BB deep/i);
  });

  it('is deterministic', () => {
    const values = [1, 5, 25, 100];
    const counts = [150, 150, 100, 75];
    const a = suggestBuyIn(values, counts, 8, OPTS);
    const b = suggestBuyIn(values, counts, 8, OPTS);
    expect(a).toEqual(b);
  });

  it('returns null when the box cannot seat the players', () => {
    expect(suggestBuyIn([1, 5], [1, 1], 2, OPTS)).toBeNull();
  });

  it('falls back to the richest stack for a tiny set', () => {
    const s = suggestBuyIn([25], [8], 2, OPTS);
    expect(s).not.toBeNull();
    expect(s!.buyIn).toBeGreaterThan(0);
  });

  it('never builds a reachability table past REACHABLE_LIMIT', () => {
    // A chip value large enough that a naive reachability table would need
    // hundreds of millions of booleans. This must return quickly, not OOM.
    const s = suggestBuyIn([100_000_000], [4], 2, OPTS);
    expect(s).not.toBeNull();
    expect(s!.reachable).toBeNull();
    expect(s!.buyIn).toBeGreaterThan(0);
  });

  it('returns the reachability table it computed so callers can reuse it', () => {
    const s = suggestBuyIn([1, 5, 25, 100], [100, 100, 50, 50], 6, OPTS);
    expect(s).not.toBeNull();
    expect(s!.reachable).not.toBeNull();
    expect(s!.reachable![s!.buyIn]).toBe(true);
  });
});
