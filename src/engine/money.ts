import type { Denom, MoneyBreakdown } from './types';

// Optional, display-only. Given a real cash buy-in, what is each chip worth in money?
// This is pure arithmetic. ChipRatio never touches, holds, or moves real money.

export function mapMoney(
  buyIn: number,
  moneyBuyIn: number | null,
  denoms: Denom[],
): MoneyBreakdown | null {
  if (moneyBuyIn === null || !Number.isFinite(moneyBuyIn) || moneyBuyIn <= 0) return null;
  if (!Number.isFinite(buyIn) || buyIn <= 0) return null;

  const perChipValue = moneyBuyIn / buyIn;
  return {
    perChipValue,
    denomCash: denoms.map((d) => ({
      denomId: d.id,
      value: d.value,
      cash: d.value * perChipValue,
    })),
  };
}
