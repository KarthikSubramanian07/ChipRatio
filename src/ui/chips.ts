import { colorHex, colorEdge } from '../engine';
import { el } from './dom';

// Original chip visuals, drawn entirely in CSS from the palette. A chip is a disc with a
// contrasting rim and the classic edge spots; a stack is a few of them fanned upward. No
// images, no external assets, so it stays a few kilobytes and themes cleanly.

function faceTextColor(color: string): string {
  // White and yellow chips need dark text; everything else reads well in white.
  return color === 'white' || color === 'yellow' ? '#1a1a1a' : '#ffffff';
}

/** A single chip token with its value printed on the face. */
export function chipEl(color: string, value: number): HTMLElement {
  const chip = el('span', {
    class: 'chip',
    attrs: {
      style: `--chip-face:${colorHex(color)};--chip-edge:${colorEdge(color)};--chip-ink:${faceTextColor(color)}`,
    },
    ariaLabel: `${color} chip, value ${value}`,
  });
  chip.append(el('span', { class: 'chip-value' }, formatChipValue(value)));
  return chip;
}

/** A small decorative fanned stack, height hinting at the count (capped so it stays tidy). */
export function stackEl(color: string, count: number): HTMLElement {
  const visible = Math.max(1, Math.min(6, count));
  const stack = el('span', { class: 'chip-stack', ariaLabel: `${count} ${color} chips` });
  for (let i = 0; i < visible; i++) {
    const disc = el('span', {
      class: 'chip-disc',
      attrs: {
        style: `--chip-face:${colorHex(color)};--chip-edge:${colorEdge(color)};bottom:${i * 4}px`,
      },
    });
    stack.append(disc);
  }
  return stack;
}

/** 1200 -> 1.2k so big-value faces do not overflow the disc. */
export function formatChipValue(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}
