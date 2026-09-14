// ChipRatio engine, public types.
//
// Two games, two units. A cash game is priced in real money, so every amount in the
// result is whole cents. A tournament is priced in chip value, so every amount is chip
// value. Nothing in here holds, moves, or touches real money: it divides a chip case.

/** A single chip denomination, as it sits in the physical box. */
export interface Denom {
  /** Stable id, unique within a set. Used to map results back to the UI. */
  id: string;
  /** Display color: a key into the palette (see presets.ts). */
  color: string;
  /** The value printed on the chip (or the ratio you treat it as). Positive integer. */
  value: number;
  /** How many of this chip exist in the box, total. Non-negative integer. */
  count: number;
}

/** The whole chip set. The engine sorts ascending by value internally, so order in is free. */
export interface ChipSet {
  denominations: Denom[];
}

/**
 * Cash game: chips stand for money, everyone buys in for the same amount, blinds stay put.
 * Tournament: chips are points, everyone starts with the same stack, blinds go up.
 */
export type GameType = 'cash' | 'tournament';

export interface Config {
  /** Number of players, 2..12 (the engine clamps and says so). */
  players: number;
  game: GameType;
  /** Cash game: what each player pays, in whole cents. */
  buyInCents: number | null;
  /**
   * Cash game: pin what the smallest chip is worth, in cents. Null lets ChipRatio pick the
   * value that makes the tidiest stack.
   */
  smallestChipCents: number | null;
  /** Tournament: starting stack in chip value. Null lets ChipRatio pick a round one. */
  startingStack: number | null;
  /** Preferred number of chips per player. A soft target, not a hard rule. */
  targetStackChips: number;
  /** Currency symbol used in cash-game wording. Display only. */
  currency: string;
}

/** One denomination's worth of chips, in a stack or in what is left in the box. */
export interface StackChip {
  denomId: string;
  color: string;
  /** The value printed on the chip. */
  value: number;
  count: number;
  /** Cash game only: what one of these chips is worth, in cents. Null in a tournament. */
  cents: number | null;
}

export interface BlindLevel {
  level: number;
  small: number;
  big: number;
}

/** Blinds in the result's unit: cents for a cash game, chip value for a tournament. */
export interface Blinds {
  small: number;
  big: number;
  /** stack / bigBlind. How many big blinds each player starts with. */
  startingBBDepth: number;
  /** Escalating levels. Empty for a cash game, where blinds never move. */
  schedule: BlindLevel[];
}

export type WarningCode =
  | 'amount-adjusted'
  | 'short-stack'
  | 'deep-stack'
  | 'few-small-chips'
  | 'thin-stack'
  | 'not-enough-chips'
  | 'chip-value-ignored'
  | 'input';

export interface Warning {
  code: WarningCode;
  message: string;
}

export interface Result {
  /** True when a usable stack was produced (even if the amount had to be adjusted). */
  ok: boolean;
  game: GameType;
  /** What each player receives. Identical for every player, always. */
  perPlayer: StackChip[];
  /** One stack's worth: cents in a cash game, chip value in a tournament. */
  stackValue: number;
  /** What the caller asked for, same unit. Null when ChipRatio picked the amount. */
  requested: number | null;
  /** True when ChipRatio chose the amount instead of the host. */
  autoPicked: boolean;
  totalChipsPerPlayer: number;
  /** Chips still in the box after dealing every stack. For rebuys and late arrivals. */
  leftover: StackChip[];
  /** How many more identical stacks the leftover chips can build. */
  rebuys: number;
  blinds: Blinds | null;
  warnings: Warning[];
  /** The internal quality score of the chosen stack. Higher is better. Tuning aid. */
  quality: number;
}
