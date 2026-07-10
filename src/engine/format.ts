import type { UnevenSmall } from './types';

// Small text-formatting helpers shared by the plain-text summary and the on-screen
// results, so the wording and number formatting can't drift between the two.

export function formatMoney(symbol: string, amount: number): string {
  return `${symbol}${amount.toFixed(2)}`;
}

/** The one-line explanation of the opt-in uneven-small-chips asymmetry. */
export function unevenSmallNote(u: UnevenSmall): string {
  const n = Math.abs(u.extraPlayers);
  const direction = u.extraPlayers > 0 ? 'an extra' : 'one fewer';
  return `${n} player${n === 1 ? '' : 's'} get ${direction} of the smallest chip so the table lands on the exact buy-in.`;
}
