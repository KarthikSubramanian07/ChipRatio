// Dev-only. Prints real allocations across a spread of sets, player counts, and buy-ins
// so a human can eyeball whether the stacks are fair, exact, and playable. Run: npm run feel

import { calculate, DEFAULT_CONFIG } from '../src/engine/index';
import { STANDARD_300, STANDARD_500 } from '../src/engine/presets';
import type { ChipSet, Config, Result } from '../src/engine/types';

function cfg(over: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...over };
}

function stackLine(r: Result): string {
  if (!r.ok) return '(infeasible) ' + r.warnings.map((w) => w.code).join(', ');
  const chips = r.perPlayer.map((p) => `${p.count}x${p.value}`).join('  ');
  return chips.padEnd(40);
}

function report(label: string, set: ChipSet, players: number, config: Config): void {
  const r = calculate(set, config);
  const depth = r.blinds ? Math.round(r.blinds.startingBBDepth) : 0;
  const total = r.totalChipsPerPlayer;
  const blinds = r.blinds ? `${r.blinds.small}/${r.blinds.big}` : '-';
  const flags = r.warnings.map((w) => w.code).join(',');
  console.log(
    `${label.padEnd(16)} P${players}  buy=${String(r.stackValue).padEnd(6)} ` +
      `chips=${String(total).padEnd(3)} bb=${String(depth).padEnd(4)} blinds=${blinds.padEnd(9)} q=${r.quality.toFixed(0).padEnd(4)} | ${stackLine(r)} ${flags ? '[' + flags + ']' : ''}`,
  );
}

console.log('\n=== Smart Suggest across player counts ===\n');
for (let p = 2; p <= 10; p++)
  report('300 suggest', STANDARD_300, p, cfg({ mode: 'suggest', players: p }));
console.log('');
for (let p = 2; p <= 10; p++)
  report('500 suggest', STANDARD_500, p, cfg({ mode: 'suggest', players: p }));

console.log('\n=== Fixed buy-ins on the 300 set (6 players) ===\n');
for (const buyIn of [100, 200, 300, 500, 750, 1000, 1500]) {
  report('300 solve', STANDARD_300, 6, cfg({ mode: 'solve', players: 6, buyIn }));
}

console.log('\n=== Fixed buy-ins on the 500 set (8 players) ===\n');
for (const buyIn of [500, 1000, 2000, 3000, 5000]) {
  report('500 solve', STANDARD_500, 8, cfg({ mode: 'solve', players: 8, buyIn }));
}

console.log('\n=== Awkward custom sets ===\n');
const noOnes: ChipSet = {
  denominations: [
    { id: 'r', color: 'red', value: 5, count: 80 },
    { id: 'g', color: 'green', value: 25, count: 60 },
    { id: 'b', color: 'black', value: 100, count: 40 },
  ],
};
for (const buyIn of [205, 340, 500]) {
  report('no-ones', noOnes, 5, cfg({ mode: 'solve', players: 5, buyIn }));
}

const tiny: ChipSet = {
  denominations: [
    { id: 'w', color: 'white', value: 1, count: 40 },
    { id: 'r', color: 'red', value: 5, count: 20 },
  ],
};
for (const p of [2, 4, 6]) report('tiny', tiny, p, cfg({ mode: 'suggest', players: p }));

const lumpy: ChipSet = {
  denominations: [
    { id: 'w', color: 'white', value: 1, count: 200 },
    { id: 'r', color: 'red', value: 5, count: 20 },
    { id: 'b', color: 'black', value: 100, count: 60 },
  ],
};
for (const buyIn of [137, 250, 500])
  report('lumpy', lumpy, 4, cfg({ mode: 'solve', players: 4, buyIn }));

console.log('');
