import { describe, it, expect } from 'vitest';
import { pyramidFraction, minSmallChips, scoreStack, type QualityContext } from './quality';

describe('pyramidFraction', () => {
  it('rewards non-increasing counts as value rises', () => {
    expect(pyramidFraction([10, 5, 2, 1])).toBe(1); // perfect pyramid
    expect(pyramidFraction([1, 2, 3, 4])).toBe(0); // inverted
    expect(pyramidFraction([5, 5, 5])).toBe(1); // flat counts still count as non-increasing
  });

  it('handles trivial stacks', () => {
    expect(pyramidFraction([])).toBe(1);
    expect(pyramidFraction([7])).toBe(1);
  });
});

describe('minSmallChips', () => {
  it('scales with blind size but stays in a sane band', () => {
    expect(minSmallChips(2, 1)).toBeGreaterThanOrEqual(4);
    expect(minSmallChips(2, 1)).toBeLessThanOrEqual(12);
    expect(minSmallChips(1000, 1)).toBe(12); // capped
    expect(minSmallChips(0, 0)).toBe(0);
  });
});

describe('scoreStack', () => {
  const ctx: QualityContext = { values: [1, 5, 25, 100], targetStackChips: 30, bigBlind: 2 };

  it('prefers a pyramid over an inverted stack of the same value', () => {
    const pyramid = [20, 6, 2, 0]; // value 20 + 30 + 50 = 100
    const inverted = [0, 0, 0, 1]; // value 100, no small chips, no change
    expect(scoreStack(pyramid, ctx)).toBeGreaterThan(scoreStack(inverted, ctx));
  });

  it('is deterministic', () => {
    const x = [12, 4, 2, 1];
    expect(scoreStack(x, ctx)).toBe(scoreStack(x, ctx));
  });
});
