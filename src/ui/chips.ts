import { colorHex, colorEdge, colorName } from '../engine';
import { el } from './dom';

// Original chip visuals, drawn entirely in CSS from the palette: a disc with a contrasting
// rim and the classic edge spots. No images, no external assets.

function faceTextColor(color: string): string {
  // Light chips need dark text; everything else reads well in white.
  return color === 'white' || color === 'yellow' ? '#1a1a1a' : '#ffffff';
}

/** A single chip token with a short label (its price or printed value) on the face. */
export function chipEl(color: string, label: string, size: 'md' | 'sm' = 'md'): HTMLElement {
  const chip = el('span', {
    class: `chip chip-${size}`,
    dataset: { len: String(Math.min(label.length, 5)) },
    attrs: {
      style: `--chip-face:${colorHex(color)};--chip-edge:${colorEdge(color)};--chip-ink:${faceTextColor(color)}`,
      role: 'img',
    },
    ariaLabel: `${colorName(color)} chip, ${label}`,
  });
  chip.append(el('span', { class: 'chip-value', attrs: { 'aria-hidden': 'true' } }, label));
  return chip;
}
