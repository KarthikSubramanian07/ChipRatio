// Themes are pure CSS: each one is a set of custom-property values keyed off the
// data-theme attribute on <html> (see styles/main.css). This module only tracks which
// one is active, applies it, and remembers the choice.

export interface Theme {
  id: string;
  label: string;
}

// Felt is the signature look and the default. The rest give the room a different mood.
export const THEMES: Theme[] = [
  { id: 'felt', label: 'Felt' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'rose', label: 'Rose' },
  { id: 'neon', label: 'Neon' },
];

export function isTheme(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}

export function themeLabel(id: string): string {
  return THEMES.find((t) => t.id === id)?.label ?? THEMES[0].label;
}

export function applyTheme(id: string): void {
  const theme = isTheme(id) ? id : THEMES[0].id;
  document.documentElement.dataset.theme = theme;
}

/** The next theme in the ring, for a one-button cycler. */
export function nextTheme(id: string): string {
  const index = THEMES.findIndex((t) => t.id === id);
  return THEMES[(index + 1) % THEMES.length].id;
}

/** First-run default: honor the OS dark/light preference, otherwise Felt. */
export function initialTheme(): string {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) {
    return 'ivory';
  }
  return 'felt';
}
