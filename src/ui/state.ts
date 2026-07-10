import type { ChipSet, Config, Mode } from '../engine';
import { DEFAULT_CONFIG, STANDARD_300, PALETTE, cloneSet } from '../engine';
import { isTheme, initialTheme } from './themes';

// The whole app state, persisted to localStorage so a host's set is there next game night.
// No server, no account, nothing leaves the browser.

export interface AppState {
  set: ChipSet;
  config: Config;
  theme: string;
  moneySymbol: string;
}

const STORAGE_KEY = 'chipratio.v1';

function freshState(): AppState {
  return {
    set: cloneSet(STANDARD_300),
    config: { ...DEFAULT_CONFIG },
    theme: initialTheme(),
    moneySymbol: '$',
  };
}

// Defensive hydration: anything the stored blob gets wrong falls back to a sane default,
// so a stale or hand-edited localStorage can never crash the app.
function hydrate(raw: unknown): AppState {
  const base = freshState();
  if (typeof raw !== 'object' || raw === null) return base;
  const data = raw as Record<string, unknown>;

  const set = validateSet(data.set);
  if (set) base.set = set;

  if (typeof data.config === 'object' && data.config !== null) {
    const c = data.config as Record<string, unknown>;
    base.config = {
      players: numberInRange(c.players, DEFAULT_CONFIG.players, 2, 10),
      mode: (c.mode === 'solve' || c.mode === 'suggest' ? c.mode : DEFAULT_CONFIG.mode) as Mode,
      // Mirrors the live inputs: a buy-in is either explicitly absent or a positive
      // number. A stale or hand-edited 0/negative buy-in is treated as absent, not
      // loaded verbatim (calculate() would otherwise deal an empty stack silently).
      buyIn: c.buyIn === null ? null : positiveNumberOrNull(c.buyIn),
      moneyBuyIn: c.moneyBuyIn === null ? null : positiveNumberOrNull(c.moneyBuyIn),
      targetStackChips: numberInRange(c.targetStackChips, DEFAULT_CONFIG.targetStackChips, 8, 80),
      allowUnevenSmallChips: c.allowUnevenSmallChips === true,
    };
  }

  if (typeof data.theme === 'string' && isTheme(data.theme)) base.theme = data.theme;
  if (
    typeof data.moneySymbol === 'string' &&
    data.moneySymbol.length >= 1 &&
    data.moneySymbol.length <= 3
  ) {
    base.moneySymbol = data.moneySymbol;
  }
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
      // Restricted to the known palette: colorHex/colorEdge already fall back safely
      // for an unrecognized key, but a stored color should never be anything other
      // than a real palette choice in the first place.
      color: PALETTE.some((c) => c.key === d.color) ? (d.color as string) : 'white',
      value: numberOr(d.value, 1),
      count: numberOr(d.count, 0),
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

/** A stored number is only valid here if it is a positive, finite number; else null. */
function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
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
      // Private-mode or storage-full: the app still works, it just will not remember.
    }
  }

  get(): AppState {
    return this.state;
  }

  /** Merge a shallow patch, persist, and notify. Structural changes replace whole slices. */
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
