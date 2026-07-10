import { describe, it, expect } from 'vitest';
import { calculate, DEFAULT_CONFIG } from './index';
import { PRESETS } from './presets';
import type { ChipSet, Config, Result } from './types';

// The Definition of Done, as an executable matrix. For every preset, every player count
// 2..10, and a spread of buy-ins (including Smart Suggest), the result must obey the
// core promises: identical exact stacks, never over-dealing the box, sane blinds.

function cfg(over: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...over };
}

function assertCoreInvariants(set: ChipSet, players: number, r: Result): void {
  if (!r.ok) return; // infeasible cases are allowed to bow out, checked elsewhere
  const box = new Map(set.denominations.map((d) => [d.id, d.count]));

  // 1. The stack value is exactly the sum of its chips.
  const value = r.perPlayer.reduce((a, p) => a + p.value * p.count, 0);
  expect(value).toBe(r.stackValue);

  // 2. Never allocate chips the box does not have.
  for (const p of r.perPlayer) {
    expect(players * p.count).toBeLessThanOrEqual(box.get(p.denomId) ?? 0);
  }

  // 3. Leftovers are non-negative and consistent with what was dealt.
  const dealt = new Map<string, number>();
  for (const p of r.perPlayer) dealt.set(p.denomId, players * p.count);
  for (const [id, count] of box) {
    const left = count - (dealt.get(id) ?? 0);
    expect(left).toBeGreaterThanOrEqual(0);
    const reported = r.leftover.find((l) => l.denomId === id)?.count ?? 0;
    expect(reported).toBe(left);
  }

  // 4. Blinds are postable and well-formed.
  expect(r.blinds).not.toBeNull();
  expect(r.blinds!.small).toBeGreaterThan(0);
  expect(r.blinds!.big).toBe(2 * r.blinds!.small);
  expect(r.blinds!.startingBBDepth).toBeGreaterThan(0);

  // 5. If nothing was snapped, the exact requested buy-in was delivered.
  const snapped = r.warnings.some(
    (w) => w.code === 'buyin-snapped' || w.code === 'infeasible' || w.code === 'uneven-small-chips',
  );
  if (r.requestedBuyIn !== null && !snapped) {
    expect(r.stackValue).toBe(r.requestedBuyIn);
  }
}

describe('acceptance matrix', () => {
  for (const preset of PRESETS) {
    for (let players = 2; players <= 10; players++) {
      it(`${preset.label}, ${players} players, Smart Suggest`, () => {
        const r = calculate(preset.set, cfg({ mode: 'suggest', players }));
        expect(r.ok).toBe(true);
        expect(r.suggestion).not.toBeNull();
        assertCoreInvariants(preset.set, players, r);
        // Suggested games play in a reasonable depth band.
        expect(r.blinds!.startingBBDepth).toBeGreaterThanOrEqual(30);
        expect(r.blinds!.startingBBDepth).toBeLessThanOrEqual(160);
      });

      for (const buyIn of [100, 300, 500, 1000]) {
        it(`${preset.label}, ${players} players, buy-in ${buyIn}`, () => {
          const r = calculate(preset.set, cfg({ mode: 'solve', players, buyIn }));
          assertCoreInvariants(preset.set, players, r);
        });
      }
    }
  }

  it('is deterministic across the whole matrix', () => {
    for (const preset of PRESETS) {
      for (let players = 2; players <= 10; players++) {
        const a = calculate(preset.set, cfg({ mode: 'solve', players, buyIn: 500 }));
        const b = calculate(preset.set, cfg({ mode: 'solve', players, buyIn: 500 }));
        expect(a).toEqual(b);
      }
    }
  });
});
