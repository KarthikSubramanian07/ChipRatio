// ChipRatio engine — public types.
//
// The engine speaks in abstract chip *values* (1, 5, 25, 100, ...). Real money is
// a thin display layer bolted on at the end (see money.ts). Nothing in here knows
// or cares about dollars, pots, or winnings. It distributes chips. That is the job.

/** A single chip denomination, as it sits in the physical box. */
export interface Denom {
  /** Stable id, unique within a set. Used to map results back to the UI. */
  id: string;
  /** Display color: a hex string or a key into the palette (see presets.ts). */
  color: string;
  /** Abstract chip value. Must be a positive integer. */
  value: number;
  /** How many of this chip exist in the box, total. Non-negative integer. */
  count: number;
}

/** The whole chip set. The engine sorts ascending by value internally, so order in is free. */
export interface ChipSet {
  denominations: Denom[];
}

export type Mode = 'solve' | 'suggest';

export interface Config {
  /** Number of players, 2..10 (the engine clamps and warns outside that). */
  players: number;
  /** 'solve' needs a buyIn. 'suggest' picks a good one for you. */
  mode: Mode;
  /** Chip-value buy-in per player. Required in 'solve' mode, ignored in 'suggest'. */
  buyIn: number | null;
  /** Optional real cash per player. Display only, never touched by the math. */
  moneyBuyIn: number | null;
  /** Preferred physical stack size (chip count). A soft target, not a hard rule. */
  targetStackChips: number;
  /**
   * Opt-in. When an exact identical stack for the buy-in is impossible, let the
   * SMALLEST denomination differ by at most one chip between players so the table
   * total lands on the exact buy-in. This is the only asymmetry ChipRatio allows.
   */
  allowUnevenSmallChips: boolean;
}

/** A count of one denomination in a stack (or in the leftover box). */
export interface PerPlayerChip {
  denomId: string;
  color: string;
  value: number;
  count: number;
}

export interface BlindLevel {
  level: number;
  small: number;
  big: number;
}

export interface Blinds {
  small: number;
  big: number;
  /** buyIn / bigBlind. The number of big blinds each player starts with. */
  startingBBDepth: number;
  /** Optional escalating schedule for tournament play. */
  schedule: BlindLevel[];
}

export interface MoneyBreakdown {
  /** Cash value of one chip-value unit: moneyBuyIn / buyIn. */
  perChipValue: number;
  denomCash: { denomId: string; value: number; cash: number }[];
}

export type WarningCode =
  | 'buyin-snapped'
  | 'shallow-stack'
  | 'deep-stack'
  | 'few-small-chips'
  | 'granularity-limited'
  | 'not-enough-chips'
  | 'infeasible'
  | 'uneven-small-chips'
  | 'input';

export interface Warning {
  code: WarningCode;
  message: string;
}

/** Describes the single permitted asymmetry when allowUnevenSmallChips kicks in. */
export interface UnevenSmall {
  denomId: string;
  /** This many players get one extra of the smallest chip; the rest get the base count. */
  extraPlayers: number;
  /** Base count of the smallest chip every player gets. */
  baseCount: number;
}

export interface Result {
  /** True when a usable stack was produced (even if the buy-in had to be snapped). */
  ok: boolean;
  /** What each player receives. Identical across players unless unevenSmall is set. */
  perPlayer: PerPlayerChip[];
  /** Value of one player's stack. Equals the (possibly snapped) buy-in. */
  stackValue: number;
  /** The buy-in the caller asked for, before any snapping. */
  requestedBuyIn: number | null;
  totalChipsPerPlayer: number;
  /** Chips still in the box after dealing every stack. For rebuys and color-ups. */
  leftover: PerPlayerChip[];
  unevenSmall: UnevenSmall | null;
  blinds: Blinds | null;
  money: MoneyBreakdown | null;
  /** Set in 'suggest' mode: the buy-in ChipRatio picked, with a one-line why. */
  suggestion: { buyIn: number; rationale: string } | null;
  warnings: Warning[];
  /** The internal quality score of the chosen stack. Higher is better. Debug/tuning aid. */
  quality: number;
}
