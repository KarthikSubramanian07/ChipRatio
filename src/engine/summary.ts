import type { Result } from './types';
import { PALETTE } from './presets';
import { formatMoney, unevenSmallNote } from './format';

// Builds the plain-text "Copy summary" a host can paste into a group chat. Deliberately
// low-tech: no tables, no unicode art, just lines that read fine anywhere. No em dashes.

export interface SummaryOptions {
  players: number;
  /** Currency symbol for the money line, when a cash buy-in was set. Defaults to '$'. */
  moneySymbol?: string;
}

function chipLabel(color: string, value: number): string {
  const known = PALETTE.find((c) => c.key === color);
  const name = known ? known.label : color;
  return `${name} (${value})`;
}

export function buildSummary(result: Result, opts: SummaryOptions): string {
  const sym = opts.moneySymbol ?? '$';
  const lines: string[] = [];

  lines.push(`ChipRatio: ${opts.players}-handed game`);

  if (!result.ok) {
    lines.push('');
    for (const w of result.warnings) lines.push(`! ${w.message}`);
    lines.push('');
    lines.push('chipratio.pages.dev');
    return lines.join('\n');
  }

  const buyInLine =
    result.money !== null
      ? `Buy-in: ${result.stackValue} in chips (${formatMoney(sym, result.money.perChipValue * result.stackValue)})`
      : `Buy-in: ${result.stackValue} in chips`;
  lines.push(buyInLine);

  if (result.suggestion) lines.push(`Suggested: ${result.suggestion.rationale}`);

  lines.push('');
  lines.push(`Each player gets (${result.totalChipsPerPlayer} chips):`);
  for (const p of result.perPlayer) {
    const cash = result.money
      ? `  (${formatMoney(sym, p.value * result.money.perChipValue)} each)`
      : '';
    lines.push(`  ${p.count} x ${chipLabel(p.color, p.value)} = ${p.count * p.value}${cash}`);
  }

  if (result.unevenSmall) {
    lines.push(`  (${unevenSmallNote(result.unevenSmall)})`);
  }

  if (result.blinds) {
    lines.push('');
    lines.push(
      `Blinds: ${result.blinds.small} / ${result.blinds.big} (about ${Math.round(result.blinds.startingBBDepth)} big blinds deep)`,
    );
  }

  if (result.leftover.length > 0) {
    lines.push('');
    lines.push('Left in the box:');
    for (const p of result.leftover) {
      lines.push(`  ${p.count} x ${chipLabel(p.color, p.value)}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    for (const w of result.warnings) lines.push(`! ${w.message}`);
  }

  lines.push('');
  lines.push('Built with ChipRatio, chipratio.pages.dev');
  return lines.join('\n');
}
