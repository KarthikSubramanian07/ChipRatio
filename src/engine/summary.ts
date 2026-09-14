import type { Config, Result } from './types';
import { colorName, formatAmount, formatNumber, plural } from './format';

// Builds the plain-text "Copy for the group chat" block. Deliberately low-tech: no tables,
// no unicode art, just lines that read fine in any messaging app. No em dashes.

export function buildSummary(result: Result, config: Pick<Config, 'players' | 'currency'>): string {
  const sym = config.currency || '$';
  const game = result.game;
  const amount = (n: number): string => formatAmount(n, game, sym);
  const lines: string[] = [];

  lines.push(
    `Poker night: ${config.players} players, ${game === 'cash' ? 'cash game' : 'tournament'}`,
  );

  if (!result.ok) {
    lines.push('');
    for (const w of result.warnings) lines.push(`! ${w.message}`);
    lines.push('');
    lines.push('chipratio.pages.dev');
    return lines.join('\n');
  }

  lines.push(
    game === 'cash'
      ? `Buy-in: ${amount(result.stackValue)} each`
      : `Starting stack: ${amount(result.stackValue)}`,
  );

  lines.push('');
  lines.push(`Everyone gets ${plural(result.totalChipsPerPlayer, 'chip')}:`);
  for (const p of result.perPlayer) {
    const worth = game === 'cash' ? (p.cents as number) : p.value;
    const each = game === 'cash' ? ` (${amount(worth)} each)` : ` (${formatNumber(worth)})`;
    lines.push(`  ${p.count} ${colorName(p.color)}${each} = ${amount(worth * p.count)}`);
  }

  if (result.blinds) {
    const b = result.blinds;
    lines.push('');
    if (game === 'cash') {
      lines.push(`Blinds: ${amount(b.small)} / ${amount(b.big)}`);
    } else {
      lines.push(`Blinds start at ${amount(b.small)} / ${amount(b.big)}, then go up:`);
      lines.push(`  ${b.schedule.map((l) => `${amount(l.small)}/${amount(l.big)}`).join(', ')}`);
    }
  }

  if (result.leftover.length > 0) {
    lines.push('');
    const left = result.leftover.map((p) => `${p.count} ${colorName(p.color)}`).join(', ');
    const rebuys =
      result.rebuys > 0
        ? ` (enough for ${plural(result.rebuys, 'rebuy')})`
        : ' (not enough for a rebuy)';
    lines.push(`Left in the case: ${left}${rebuys}`);
  }

  const notes = result.warnings.filter((w) => w.code !== 'input');
  if (notes.length > 0) {
    lines.push('');
    for (const w of notes) lines.push(`! ${w.message}`);
  }

  lines.push('');
  lines.push('Split with ChipRatio: chipratio.pages.dev');
  return lines.join('\n');
}
