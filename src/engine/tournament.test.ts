import { describe, it, expect } from 'vitest';
import { planTournament } from './tournament';
import { roundness } from './nice';

const VALUES = [1, 5, 25, 100];
const COUNTS = [100, 100, 50, 50];

describe('planTournament', () => {
  it('picks a round starting stack on its own', () => {
    const plan = planTournament(VALUES, COUNTS, 6, null, 30)!;
    expect(roundness(plan.stackValue)).toBeGreaterThanOrEqual(50);
    expect(plan.blinds.schedule.length).toBe(8);
  });

  it('uses a host-picked stack when the case can build it', () => {
    const plan = planTournament(VALUES, COUNTS, 6, 500, 30)!;
    expect(plan.stackValue).toBe(500);
    expect(plan.adjusted).toBe(false);
  });

  it('turns an impossible stack into a round one, not the raw maximum', () => {
    // Six players can get at most 1,096 each from this case.
    const plan = planTournament(VALUES, COUNTS, 6, 1500, 30)!;
    expect(plan.stackValue).toBe(1000);
    expect(plan.adjusted).toBe(true);
    expect(plan.capValue).toBe(1096);
  });

  it('is deterministic', () => {
    expect(planTournament(VALUES, COUNTS, 8, null, 30)).toEqual(
      planTournament(VALUES, COUNTS, 8, null, 30),
    );
  });

  it('still deals a game from a tiny case', () => {
    const plan = planTournament([25], [8], 2, null, 30)!;
    expect(plan.stackValue).toBeGreaterThan(0);
  });

  it('returns null when the case cannot seat everyone', () => {
    expect(planTournament([1, 5], [1, 1], 2, null, 30)).toBeNull();
  });

  it('never builds a reachability table for absurd chip values', () => {
    const plan = planTournament([100_000_000], [4], 2, null, 30);
    expect(plan).not.toBeNull();
  });
});
