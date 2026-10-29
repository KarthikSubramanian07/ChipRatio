import type { ChipSet, Config } from '../engine';
import {
  DEFAULT_CONFIG,
  MAX_PLAYERS,
  MIN_PLAYERS,
  DEFAULT_SET,
  PALETTE,
  cloneSet,
  matchingPresetId,
} from '../engine';
import { isTheme, initialTheme } from './themes';

// The whole app state, persisted to localStorage so a host's set is there next game night.
// No server, no account, nothing leaves the browser.

export interface AppState {
  set: ChipSet;
  config: Config;
  theme: string;
  /** Saved-state format. 2 introduced the five-color default set. */
  version?: number;
}

const STATE_VERSION = 2;

const STORAGE_KEY = 'chipratio.v1';

/** Currency symbols offered in the picker. Cash math is whole cents for all of them. */
export const CURRENCIES = ['$', '€', '£', '₹'];

function freshState(): AppState {
  return {
    set: cloneSet(DEFAULT_SET),
    config: { ...DEFAULT_CONFIG },
    theme: initialTheme(),
    version: STATE_VERSION,
  };
}

// Defensive hydration: anything the stored blob gets wrong falls back to a sane default,
// so a stale or hand-edited localStorage can never crash the app. Also reads the shape the
// first release saved (mode, buyIn, moneyBuyIn, moneySymbol) so returning hosts keep their
// set and their cash buy-in.
export function hydrate(raw: unknown): AppState {
  const base = freshState();
  if (typeof raw !== 'object' || raw === null) return base;
  const data = raw as Record<string, unknown>;

  const set = validateSet(data.set);
  // Before version 2 the default was the four-color 300 set. A visitor who never touched it
  // gets the new five-color default; anyone who picked or edited a set keeps theirs.
  const untouchedOldDefault =
    set !== null &&
    (typeof data.version !== 'number' || data.version < STATE_VERSION) &&
    matchingPresetId(set) === 'standard-300';
  if (set && !untouchedOldDefault) base.set = set;

  if (typeof data.config === 'object' && data.config !== null) {
    const c = data.config as Record<string, unknown>;
    const legacyCash = positiveNumberOrNull(c.moneyBuyIn);
    base.config = {
      players: numberInRange(c.players, DEFAULT_CONFIG.players, MIN_PLAYERS, MAX_PLAYERS),
      game: c.game === 'tournament' ? 'tournament' : 'cash',
      buyInCents:
        c.buyInCents === null
          ? null
          : (wholeOrNull(c.buyInCents) ??
            (legacyCash !== null ? Math.round(legacyCash * 100) : DEFAULT_CONFIG.buyInCents)),
      smallestChipCents: wholeOrNull(c.smallestChipCents),
      startingStack: wholeOrNull(c.startingStack),
      targetStackChips: numberInRange(c.targetStackChips, DEFAULT_CONFIG.targetStackChips, 8, 80),
      currency: CURRENCIES.includes(c.currency as string)
        ? (c.currency as string)
        : CURRENCIES.includes(data.moneySymbol as string)
          ? (data.moneySymbol as string)
          : DEFAULT_CONFIG.currency,
    };
  }

  if (typeof data.theme === 'string' && isTheme(data.theme)) base.theme = data.theme;
  return base;
}

function validateSet(raw: unknown): ChipSet | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const denoms = (raw as { denominations?: unknown }).denominations;
  if (!Array.isArray(denoms) || denoms.length === 0) return null;
  const cleaned = denoms
    .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
    .map((d) => ({
      id: typeof d.id === 'string' ? d.id : cryptoId(),
      // Restricted to the known palette, since the color lands in an inline style.
      color: PALETTE.some((c) => c.key === d.color) ? (d.color as string) : 'white',
      value: Math.floor(numberOr(d.value, 1)),
      count: Math.floor(numberOr(d.count, 0)),
    }))
    .filter((d) => d.value > 0 && d.count >= 0);
  return cleaned.length > 0 ? { denominations: cleaned } : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp a stored number into [min, max], falling back when it is missing or not finite. */
function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** A stored whole number is only valid here if it is a positive integer; else null. */
function wholeOrNull(value: unknown): number | null {
  const n = positiveNumberOrNull(value);
  return n !== null && Number.isInteger(n) ? n : null;
}

export function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID().slice(0, 8);
  return Math.abs((Date.now() ^ (performance.now() * 1000)) | 0).toString(36);
}

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = this.load();
  }

  private load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? hydrate(JSON.parse(raw)) : freshState();
    } catch {
      return freshState();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Private mode or storage full: the app still works, it just will not remember.
    }
  }

  get(): AppState {
    return this.state;
  }

  /** Merge a shallow patch, persist, and notify. */
  update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    for (const listener of this.listeners) listener(this.state);
  }

  updateConfig(patch: Partial<Config>): void {
    this.update({ config: { ...this.state.config, ...patch } });
  }

  subscribe(listener: Listener): void {
    this.listeners.add(listener);
  }
}
