// Dev-only. Prints real allocations across a spread of sets, player counts, and buy-ins so
// a human can eyeball whether the stacks are fair, round, and playable. Run: npm run feel

import { calculate, DEFAULT_CONFIG, formatAmount } from '../src/engine/index';
import { PRESETS, STANDARD_300, STANDARD_500 } from '../src/engine/presets';
import type { ChipSet, Config } from '../src/engine/types';

function report(label: string, set: ChipSet, over: Partial<Config>): void {
  const config: Config = { ...DEFAULT_CONFIG, ...over };
  const r = calculate(set, config);
  const fmt = (n: number): string => formatAmount(n, r.game, '$');
  if (!r.ok) {
    console.log(`${label.padEnd(18)} P${config.players}  (none) ${r.warnings.map((w) => w.code)}`);
    return;
  }
  const chips = r.perPlayer
    .map((p) => `${p.count}x${fmt(r.game === 'cash' ? (p.cents as number) : p.value)}`)
    .join(' ');
  const b = r.blinds!;
  const flags = r.warnings.map((w) => w.code).join(',');
  console.log(
    `${label.padEnd(18)} P${String(config.players).padEnd(3)} stack=${fmt(r.stackValue).padEnd(7)} ` +
      `chips=${String(r.totalChipsPerPlayer).padEnd(3)} bb=${String(Math.round(b.startingBBDepth)).padEnd(4)} ` +
      `blinds=${`${fmt(b.small)}/${fmt(b.big)}`.padEnd(10)} rebuys=${r.rebuys} | ${chips.padEnd(40)} ${flags ? `[${flags}]` : ''}`,
  );
}

console.log('\n=== Cash games on the 300 set ===\n');
for (const cents of [500, 1000, 2000, 2500, 5000, 10000]) {
  for (const players of [4, 6, 8]) report('300 cash', STANDARD_300, { players, buyInCents: cents });
}

console.log('\n=== Cash games, every preset, 6 players, $20 ===\n');
for (const p of PRESETS) report(p.label, p.set, { players: 6, buyInCents: 2000 });

console.log('\n=== Tournaments, auto stack ===\n');
for (const p of PRESETS) {
  for (const players of [4, 6, 9]) report(p.label, p.set, { game: 'tournament', players });
}

console.log('\n=== Tournaments, host-picked stacks on the 500 set (8 players) ===\n');
for (const stack of [500, 1000, 1234, 1500, 2000, 5000]) {
  report('500 tourney', STANDARD_500, { game: 'tournament', players: 8, startingStack: stack });
}

console.log('\n=== Awkward custom sets ===\n');
const noOnes: ChipSet = {
  denominations: [
    { id: 'r', color: 'red', value: 5, count: 80 },
    { id: 'g', color: 'green', value: 25, count: 60 },
    { id: 'b', color: 'black', value: 100, count: 40 },
  ],
};
report('no-ones cash', noOnes, { players: 5, buyInCents: 2000 });
report('no-ones tourney', noOnes, { game: 'tournament', players: 5 });
const tiny: ChipSet = {
  denominations: [
    { id: 'w', color: 'white', value: 1, count: 40 },
    { id: 'r', color: 'red', value: 5, count: 20 },
  ],
};
for (const players of [2, 4, 6]) report('tiny tourney', tiny, { game: 'tournament', players });
report('tiny cash', tiny, { players: 4, buyInCents: 1000 });
const odd: ChipSet = {
  denominations: [
    { id: 'a', color: 'white', value: 1, count: 100 },
    { id: 'b', color: 'red', value: 3, count: 100 },
    { id: 'c', color: 'blue', value: 7, count: 60 },
  ],
};
report('odd ratios cash', odd, { players: 6, buyInCents: 2000 });
report('odd pinned 25c', STANDARD_300, { players: 6, buyInCents: 2000, smallestChipCents: 25 });
report('pinned 5c', STANDARD_300, { players: 6, buyInCents: 2000, smallestChipCents: 5 });
console.log('');
