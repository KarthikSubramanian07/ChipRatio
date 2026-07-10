import type { ChipSet, Denom } from './types';

// The traditional poker chip colors. Values follow the widely used casino convention
// (white 1, red 5, green 25, black 100, purple 500). These are only defaults; the UI
// lets you recolor and revalue anything. Colors are original hex, not lifted from any
// brand's chips.
export interface PaletteColor {
  key: string;
  label: string;
  hex: string;
  /** A darker edge tone for the chip's rim, so the visual reads as a real chip. */
  edge: string;
}

export const PALETTE: PaletteColor[] = [
  { key: 'white', label: 'White', hex: '#f4f4f5', edge: '#cbd5e1' },
  { key: 'red', label: 'Red', hex: '#e11d48', edge: '#9f1239' },
  { key: 'blue', label: 'Blue', hex: '#2563eb', edge: '#1e3a8a' },
  { key: 'green', label: 'Green', hex: '#16a34a', edge: '#14532d' },
  { key: 'black', label: 'Black', hex: '#27272a', edge: '#09090b' },
  { key: 'purple', label: 'Purple', hex: '#7c3aed', edge: '#4c1d95' },
  { key: 'orange', label: 'Orange', hex: '#ea580c', edge: '#9a3412' },
  { key: 'pink', label: 'Pink', hex: '#ec4899', edge: '#9d174d' },
  { key: 'yellow', label: 'Yellow', hex: '#eab308', edge: '#854d0e' },
  { key: 'gray', label: 'Gray', hex: '#71717a', edge: '#3f3f46' },
];

// These land straight in an inline CSS custom property (see src/ui/chips.ts and
// src/ui/app.ts), so an unrecognized key always falls back to a fixed, known-safe color
// rather than ever passing an arbitrary string through to a style attribute.
const FALLBACK_COLOR = PALETTE[0];

export function colorHex(key: string): string {
  return PALETTE.find((c) => c.key === key)?.hex ?? FALLBACK_COLOR.hex;
}

export function colorEdge(key: string): string {
  return PALETTE.find((c) => c.key === key)?.edge ?? FALLBACK_COLOR.edge;
}

function denom(id: string, color: string, value: number, count: number): Denom {
  return { id, color, value, count };
}

// Representative counts for common retail sets. Real sets vary by manufacturer, so
// these are sensible starting points, all editable in the UI.

/** Standard 300-piece set: 100 white (1), 100 red (5), 50 green (25), 50 black (100). */
export const STANDARD_300: ChipSet = {
  denominations: [
    denom('w', 'white', 1, 100),
    denom('r', 'red', 5, 100),
    denom('g', 'green', 25, 50),
    denom('b', 'black', 100, 50),
  ],
};

/** Standard 500-piece set: 150 white (1), 150 red (5), 100 green (25), 75 black (100), 25 purple (500). */
export const STANDARD_500: ChipSet = {
  denominations: [
    denom('w', 'white', 1, 150),
    denom('r', 'red', 5, 150),
    denom('g', 'green', 25, 100),
    denom('b', 'black', 100, 75),
    denom('p', 'purple', 500, 25),
  ],
};

/** Starter 100-piece set: 20 each of white (1), red (5), green (25), black (100), yellow (500). */
export const STARTER_100: ChipSet = {
  denominations: [
    denom('w', 'white', 1, 20),
    denom('r', 'red', 5, 20),
    denom('g', 'green', 25, 20),
    denom('b', 'black', 100, 20),
    denom('y', 'yellow', 500, 20),
  ],
};

/** Party 200-piece set: 50 each of white (1), red (5), green (25), black (100). */
export const PARTY_200: ChipSet = {
  denominations: [
    denom('w', 'white', 1, 50),
    denom('r', 'red', 5, 50),
    denom('g', 'green', 25, 50),
    denom('b', 'black', 100, 50),
  ],
};

/** Deluxe 500-piece set: 100 white (1), 100 red (5), 100 green (25), 50 blue (50), 50 black (100), 50 purple (500), 50 yellow (1000). */
export const DELUXE_500: ChipSet = {
  denominations: [
    denom('w', 'white', 1, 100),
    denom('r', 'red', 5, 100),
    denom('g', 'green', 25, 100),
    denom('u', 'blue', 50, 50),
    denom('b', 'black', 100, 50),
    denom('p', 'purple', 500, 50),
    denom('y', 'yellow', 1000, 50),
  ],
};

/** Tournament 1000-piece set: 300 white (1), 300 red (5), 200 blue (10), 100 green (25), 100 black (100). */
export const TOURNAMENT_1000: ChipSet = {
  denominations: [
    denom('w', 'white', 1, 300),
    denom('r', 'red', 5, 300),
    denom('u', 'blue', 10, 200),
    denom('g', 'green', 25, 100),
    denom('b', 'black', 100, 100),
  ],
};

export interface Preset {
  id: string;
  label: string;
  description: string;
  set: ChipSet;
}

export const PRESETS: Preset[] = [
  {
    id: 'starter-100',
    label: 'Starter 100',
    description: '20 each of white, red, green, black, yellow',
    set: STARTER_100,
  },
  {
    id: 'party-200',
    label: 'Party 200',
    description: '50 each of white, red, green, black',
    set: PARTY_200,
  },
  {
    id: 'standard-300',
    label: 'Standard 300',
    description: '100 white, 100 red, 50 green, 50 black',
    set: STANDARD_300,
  },
  {
    id: 'standard-500',
    label: 'Standard 500',
    description: '150 white, 150 red, 100 green, 75 black, 25 purple',
    set: STANDARD_500,
  },
  {
    id: 'deluxe-500',
    label: 'Deluxe 500',
    description: '100 white, 100 red, 100 green, 50 blue, 50 black, 50 purple, 50 yellow',
    set: DELUXE_500,
  },
  {
    id: 'tournament-1000',
    label: 'Tournament 1000',
    description: '300 white, 300 red, 200 blue, 100 green, 100 black',
    set: TOURNAMENT_1000,
  },
];

/** Deep-clone a chip set so callers can edit freely without mutating the presets. */
export function cloneSet(set: ChipSet): ChipSet {
  return { denominations: set.denominations.map((d) => ({ ...d })) };
}

function sameShape(a: ChipSet, b: ChipSet): boolean {
  const norm = (s: ChipSet) =>
    s.denominations
      .map((d) => `${d.color}:${d.value}:${d.count}`)
      .sort()
      .join('|');
  return norm(a) === norm(b);
}

/**
 * Which preset (if any) the given set is identical to, ignoring denomination ids and
 * order. Used to keep the preset picker honest: it should say "Custom" the moment a set
 * no longer matches what it claims to be, not just whatever was last selected.
 */
export function matchingPresetId(set: ChipSet): string {
  return PRESETS.find((p) => sameShape(p.set, set))?.id ?? 'custom';
}
