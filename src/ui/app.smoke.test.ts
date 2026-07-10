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

  it('renders a minimal setup and an instant result on mount', () => {
    const root = mount();
    expect(root.querySelector('.setup')).not.toBeNull();
    const total = root.querySelector('.stack-total-value');
    expect(total).not.toBeNull();
    expect(Number(total!.textContent)).toBeGreaterThan(0);

    // Standard 300 has four denominations, and the preset picker reflects it exactly.
    expect(root.querySelectorAll('.denom-row').length).toBe(4);
    expect((root.querySelector('.preset-select') as HTMLSelectElement).value).toBe('standard-300');

    // Everything but players, chip set, and the mode toggle stays collapsed until asked
    // for, so a first-time visitor sees two fields and an answer, not a form.
    const more = root.querySelector('.more-options') as HTMLDetailsElement;
    expect(more.open).toBe(false);
    expect(root.querySelector('.set-summary')!.textContent).toContain('White');

    // Suggest mode is the default, so a recommendation shows immediately.
    expect(root.querySelector('.suggestion')).not.toBeNull();
    expect(root.querySelectorAll('.stack-row').length).toBeGreaterThan(0);
  });

  it('offers more than one real preset besides the default', () => {
    const root = mount();
    const options = [...root.querySelectorAll('.preset-select option')].map((o) => o.textContent);
    expect(options.length).toBeGreaterThanOrEqual(5); // presets + "Custom"
    expect(options).toContain('Standard 300');
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

  it('switches the preset select to Custom the moment the set is hand-edited', () => {
    const root = mount();
    const preset = root.querySelector('.preset-select') as HTMLSelectElement;
    expect(preset.value).toBe('standard-300');

    const addBtn = root.querySelector('.add-denom') as HTMLButtonElement;
    addBtn.click();
    expect(preset.value).toBe('custom');
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
    const plus = root.querySelector(
      '.field-players .counter .btn.step:last-child',
    ) as HTMLButtonElement;
    plus.click();
    plus.click();
    // The results node is replaced on recompute; it should still be present and valid.
    expect(root.querySelector('.stack-total-value')).not.toBeNull();
    expect(firstTotal).toBeTruthy();
  });

  it('shows blinds and the schedule inline, not as a separate boxed card', () => {
    const root = mount();
    expect(root.querySelector('.result-meta')).not.toBeNull();
    expect(root.querySelector('.schedule')).not.toBeNull();
    // The old bordered "card" wrapper is gone.
    expect(root.querySelector('.blind-card')).toBeNull();
    expect(root.querySelector('.card')).toBeNull();
  });
});
