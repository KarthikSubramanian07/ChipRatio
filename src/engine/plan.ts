import type { Blinds } from './types';
import { TARGET_START_BB } from './blinds';

// What a game planner (cash.ts, tournament.ts) hands back to calculate(). Every amount is in
// the game's own unit: cents for a cash game, chip value for a tournament.

export interface Plan {
  /** Per-player counts, aligned with the ascending denominations. */
  x: number[];
  /** What one chip of each denomination is worth, in the game's unit. */
  worth: number[];
  stackValue: number;
  /** The richest identical stack this box can deal, in the game's unit. */
  capValue: number;
  blinds: Blinds;
  quality: number;
  /** True when the host's own amount could not be built exactly. */
  adjusted: boolean;
}

/** Depths within this many big blinds of the target cost nothing. */
const DEPTH_DEADBAND = 25;

/** Score cost of starting a game too shallow or too deep. */
export function depthPenalty(depth: number, weight: number): number {
  return weight * Math.max(0, Math.abs(depth - TARGET_START_BB) - DEPTH_DEADBAND);
}
