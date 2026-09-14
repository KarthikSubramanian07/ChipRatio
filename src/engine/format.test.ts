import { describe, it, expect } from 'vitest';
import { chipFace, colorName, formatAmount, formatCents, formatNumber, plural } from './format';

describe('formatCents', () => {
  it('writes money the way people say it', () => {
    expect(formatCents(10)).toBe('10¢');
    expect(formatCents(100)).toBe('$1');
    expect(formatCents(250)).toBe('$2.50');
    expect(formatCents(2000)).toBe('$20');
    expect(formatCents(123456)).toBe('$1,234.56');
  });

  it('uses decimals for other currencies', () => {
    expect(formatCents(10, '€')).toBe('€0.10');
    expect(formatCents(500, '£')).toBe('£5');
  });
});

describe('chipFace', () => {
  it('fits on a chip', () => {
    expect(chipFace(25, 'cash')).toBe('25¢');
    expect(chipFace(250, 'cash')).toBe('$2.5');
    expect(chipFace(500000, 'cash')).toBe('$5k');
    expect(chipFace(1000, 'tournament')).toBe('1k');
    expect(chipFace(1500, 'tournament')).toBe('1.5k');
    expect(chipFace(25, 'tournament')).toBe('25');
  });
});

describe('small helpers', () => {
  it('formats numbers, amounts, names and plurals', () => {
    expect(formatNumber(1500)).toBe('1,500');
    expect(formatAmount(1500, 'tournament')).toBe('1,500');
    expect(formatAmount(1500, 'cash')).toBe('$15');
    expect(colorName('white')).toBe('White');
    expect(colorName('mystery')).toBe('mystery');
    expect(plural(1, 'rebuy')).toBe('1 rebuy');
    expect(plural(3, 'rebuy')).toBe('3 rebuys');
  });
});
