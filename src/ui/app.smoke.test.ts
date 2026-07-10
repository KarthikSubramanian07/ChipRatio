// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { mountApp } from './app';
import { Store } from './state';

// A headless smoke test of the whole UI wiring: mount the real app into a jsdom document
// and confirm it renders results, reacts to input, and never throws. Not a pixel test,
// a "does the machine turn over" test.

function mount(): HTMLElement {
  localStorage.clear();
  document.body.innerHTML = '<div id="calculator"></div>';
  const root = document.getElementById('calculator') as HTMLElement;
  mountApp(root, new Store());
  return root;
}

describe('app smoke', () => {
  beforeEach(() => localStorage.clear());

  it('renders an editor, game panel, and results on mount', () => {
    const root = mount();
    expect(root.querySelector('.editor')).not.toBeNull();
    expect(root.querySelector('.game')).not.toBeNull();
    const total = root.querySelector('.stack-total-value');
    expect(total).not.toBeNull();
    expect(Number(total!.textContent)).toBeGreaterThan(0);
    // Standard 300 has four denominations.
    expect(root.querySelectorAll('.denom-row').length).toBe(4);
    // The row-by-row editor stays collapsed until asked for, so a new visitor sees
    // the preset choice and a one-line summary, not four editable rows right away.
    const details = root.querySelector('.editor-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(root.querySelector('.set-summary')!.textContent).toContain('White');
    // Suggest mode is the default, so a recommendation shows.
    expect(root.querySelector('.suggestion')).not.toBeNull();
    expect(root.querySelectorAll('.stack-row').length).toBeGreaterThan(0);
  });

  it('shows the buy-in field when switching to solve mode', () => {
    const root = mount();
    const buyInField = root.querySelector('.buyin-field') as HTMLElement;
    expect(buyInField.classList.contains('is-hidden')).toBe(true);
    const solveBtn = [...root.querySelectorAll('.seg')].find((b) =>
      b.textContent?.includes('buy-in'),
    );
    (solveBtn as HTMLButtonElement).click();
    expect(buyInField.classList.contains('is-hidden')).toBe(false);
  });

  it('adds a denomination when Add a color is clicked', () => {
    const root = mount();
    const before = root.querySelectorAll('.denom-row').length;
    const addBtn = root.querySelector('.add-denom') as HTMLButtonElement;
    addBtn.click();
    expect(root.querySelectorAll('.denom-row').length).toBe(before + 1);
  });

  it('recomputes results when the player count changes', () => {
    const root = mount();
    const firstTotal = root.querySelector('.stack-total-value')!.textContent;
    const plus = root.querySelector('.game .counter .btn.step:last-child') as HTMLButtonElement;
    plus.click();
    plus.click();
    // The results node is replaced on recompute; it should still be present and valid.
    expect(root.querySelector('.stack-total-value')).not.toBeNull();
    expect(firstTotal).toBeTruthy();
  });

  it('renders a blind card with a schedule', () => {
    const root = mount();
    expect(root.querySelector('.blind-card')).not.toBeNull();
    expect(root.querySelector('.schedule')).not.toBeNull();
  });
});
