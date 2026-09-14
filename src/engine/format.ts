import type { GameType } from './types';
import { PALETTE } from './presets';

// Text formatting shared by the on-screen results and the plain-text summary, so the
// wording and number formatting can never drift between the two.

/** 1234 -> "1,234". */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Whole cents as money a person would write: 10¢, $1, $2.50, $1,000. Only the dollar sign
 * gets the cent symbol; every other currency shows a decimal (€0.10).
 */
export function formatCents(cents: number, symbol = '$'): string {
  if (symbol === '$' && cents > 0 && cents < 100) return `${cents}¢`;
  const amount = cents / 100;
  const digits = cents % 100 === 0 ? 0 : 2;
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** An amount in the game's own unit: money for a cash game, chips for a tournament. */
export function formatAmount(amount: number, game: GameType, symbol = '$'): string {
  return game === 'cash' ? formatCents(amount, symbol) : formatNumber(amount);
}

/** Short label that fits on a chip face: 25¢, $5, $2.5, 1k, 25. */
export function chipFace(amount: number, game: GameType, symbol = '$'): string {
  if (game === 'cash') {
    if (symbol === '$' && amount < 100) return `${amount}¢`;
    const dollars = amount / 100;
    if (dollars >= 1000 && dollars % 1000 === 0) return `${symbol}${dollars / 1000}k`;
    return `${symbol}${Number.isInteger(dollars) ? dollars : Number(dollars.toFixed(2))}`;
  }
  if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000}k`;
  if (amount >= 1000) return `${Number((amount / 1000).toFixed(1))}k`;
  return String(amount);
}

/** "White", or the raw key for a color outside the palette. */
export function colorName(color: string): string {
  return PALETTE.find((c) => c.key === color)?.label ?? color;
}

export function plural(n: number, word: string): string {
  return `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
}
