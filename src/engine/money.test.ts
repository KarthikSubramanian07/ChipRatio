import { describe, it, expect } from 'vitest';
import { mapMoney } from './money';
import type { Denom } from './types';

const denoms: Denom[] = [
  { id: 'w', color: 'white', value: 1, count: 100 },
  { id: 'r', color: 'red', value: 5, count: 100 },
  { id: 'g', color: 'green', value: 25, count: 50 },
];

describe('mapMoney', () => {
  it('maps chip value to cash by ratio', () => {
    const m = mapMoney(1000, 20, denoms);
    expect(m).not.toBeNull();
    expect(m!.perChipValue).toBeCloseTo(0.02); // $20 buys 1000 chips
    expect(m!.denomCash.find((d) => d.denomId === 'g')!.cash).toBeCloseTo(0.5); // 25 chips = $0.50
  });

  it('returns null without a cash buy-in', () => {
    expect(mapMoney(1000, null, denoms)).toBeNull();
    expect(mapMoney(1000, 0, denoms)).toBeNull();
    expect(mapMoney(0, 20, denoms)).toBeNull();
  });
});
