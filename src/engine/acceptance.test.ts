import { describe, it, expect } from 'vitest';
import { calculate, DEFAULT_CONFIG } from './index';
import { PRESETS } from './presets';
import { isNiceCents } from './nice';
import type { ChipSet, Config, Result } from './types';

// The Definition of Done, as an executable matrix. For every preset, every player count,
// both game types, and a spread of amounts, the result must keep the core promises:
// identical exact stacks, never over-dealing the case, blinds a person would recognize, and
// money amounts that are real money.

function cfg(over: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...over };
}

function assertCoreInvariants(set: ChipSet, players: number, r: Result): void {
  if (!r.ok) return; // infeasible cases are allowed to bow out, checked elsewhere
  const box = new Map(set.denominations.map((d) => [d.id, d.count]));

  // 1. The stack value is exactly the sum of its chips, in the game's unit.
  const worth = (p: Result['perPlayer'][number]): number =>
    r.game === 'cash' ? (p.cents as number) : p.value;
  expect(r.perPlayer.reduce((a, p) => a + worth(p) * p.count, 0)).toBe(r.stackValue);
  expect(r.perPlayer.reduce((a, p) => a + p.count, 0)).toBe(r.totalChipsPerPlayer);

  // 2. Never allocate chips the case does not have.
  for (const p of r.perPlayer) {
    expect(players * p.count).toBeLessThanOrEqual(box.get(p.denomId) ?? 0);
  }

  // 3. Leftovers are exactly what was not dealt, and rebuys fit in them.
  for (const [id, count] of box) {
    const dealt = players * (r.perPlayer.find((p) => p.denomId === id)?.count ?? 0);
    expect(r.leftover.find((l) => l.denomId === id)?.count ?? 0).toBe(count - dealt);
  }
  for (const p of r.perPlayer) {
    const left = r.leftover.find((l) => l.denomId === p.denomId)?.count ?? 0;
    expect(r.rebuys * p.count).toBeLessThanOrEqual(left);
  }

  // 4. Blinds are postable and well-formed.
  const b = r.blinds!;
  expect(b.small).toBeGreaterThan(0);
  expect(b.big).toBe(2 * b.small);
  const smallest = Math.min(...r.perPlayer.map(worth), ...r.leftover.map(worth));
  expect(b.small % smallest).toBe(0);

  // 5. Money is real money: whole cents, and nice amounts for every standard preset.
  if (r.game === 'cash') {
    for (const p of [...r.perPlayer, ...r.leftover])
      expect(isNiceCents(p.cents as number)).toBe(true);
    expect(isNiceCents(b.small)).toBe(true);
    expect(b.schedule).toEqual([]);
  } else {
    expect(b.schedule.length).toBe(8);
  }

  // 6. If nothing was adjusted, the exact requested amount was delivered.
  const adjusted = r.warnings.some((w) => w.code === 'amount-adjusted');
  if (r.requested !== null && !adjusted) expect(r.stackValue).toBe(r.requested);
}

describe('acceptance matrix', () => {
  for (const preset of PRESETS) {
    for (let players = 2; players <= 10; players++) {
      it(`${preset.label}, ${players} players, auto tournament stack`, () => {
        const r = calculate(preset.set, cfg({ game: 'tournament', players }));
        expect(r.ok).toBe(true);
        expect(r.autoPicked).toBe(true);
        assertCoreInvariants(preset.set, players, r);
        expect(r.blinds!.startingBBDepth).toBeGreaterThanOrEqual(20);
        expect(r.blinds!.startingBBDepth).toBeLessThanOrEqual(160);
      });

      for (const stack of [100, 500, 1000, 2500]) {
        it(`${preset.label}, ${players} players, ${stack} tournament stack`, () => {
          const r = calculate(
            preset.set,
            cfg({ game: 'tournament', players, startingStack: stack }),
          );
          assertCoreInvariants(preset.set, players, r);
        });
      }

      for (const cents of [500, 2000, 5000, 10000]) {
        it(`${preset.label}, ${players} players, cash buy-in ${cents / 100}`, () => {
          const r = calculate(preset.set, cfg({ game: 'cash', players, buyInCents: cents }));
          assertCoreInvariants(preset.set, players, r);
        });
      }
    }
  }

  it('hits a $20 buy-in exactly on every preset that can seat six', () => {
    for (const preset of PRESETS) {
      const r = calculate(preset.set, cfg({ players: 6, buyInCents: 2000 }));
      expect(r.ok).toBe(true);
      expect(r.stackValue).toBe(2000);
    }
  });

  it('is deterministic across the whole matrix', () => {
    for (const preset of PRESETS) {
      for (let players = 2; players <= 10; players++) {
        const c = cfg({ players, buyInCents: 2000 });
        expect(calculate(preset.set, c)).toEqual(calculate(preset.set, c));
      }
    }
  });
});
