// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { mountApp, readCents, readWhole } from './app';
import { Store, hydrate } from './state';
import { STANDARD_300 } from '../engine/presets';

// A headless smoke test of the whole UI wiring: mount the real app into a jsdom document
// and confirm it renders results, reacts to input, and never throws. Not a pixel test, a
// "does the machine turn over" test.

function mount(): HTMLElement {
  document.body.innerHTML = '<div id="calculator"></div>';
  const root = document.getElementById('calculator') as HTMLElement;
  mountApp(root, new Store());
  return root;
}

const total = (root: HTMLElement): string =>
  root.querySelector('.stack-total-value')?.textContent ?? '';

function pressed(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(`${selector}[aria-pressed="true"]`)].map(
    (b) => b.textContent ?? '',
  );
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('app smoke', () => {
  beforeEach(() => localStorage.clear());

  it('opens on a $20 cash game with an instant, human-readable answer', () => {
    const root = mount();
    expect(pressed(root, '.game-switch .seg')[0]).toContain('Cash game');
    expect(total(root)).toBe('$20');
    const faces = [...root.querySelectorAll('.stack-row .chip-value')].map((c) => c.textContent);
    expect(faces[0]).toBe('10¢');
    // Every price reads like real money: 10¢, $6, $2.50. Never 0.28 or $1.285.
    const prices = [...root.querySelectorAll('.stack-name small, .stack-sub')].map((n) =>
      (n.textContent ?? '').replace(' each', ''),
    );
    expect(prices.length).toBeGreaterThan(0);
    for (const p of prices) expect(p).toMatch(/^(\d{1,2}¢|\$[\d,]+(\.\d0)?)$/);
    expect(root.querySelector('.preset-select')).not.toBeNull();
    expect((root.querySelector('.preset-select') as HTMLSelectElement).value).toBe('standard-500');
    expect(pressed(root, '.pill')).toEqual(['$20']);
  });

  it('keeps editing tools collapsed on first load', () => {
    const root = mount();
    for (const d of root.querySelectorAll<HTMLDetailsElement>('.setup details')) {
      expect(d.open).toBe(false);
    }
  });

  it('recomputes as the buy-in is typed and highlights matching quick picks', () => {
    const root = mount();
    type(root.querySelector('.amount-input') as HTMLInputElement, '50');
    expect(total(root)).toBe('$50');
    expect(pressed(root, '.pill')).toEqual(['$50']);
    (root.querySelector('.pill[data-value="1000"]') as HTMLButtonElement).click();
    expect(total(root)).toBe('$10');
  });

  it('asks for a buy-in when the field is cleared', () => {
    const root = mount();
    type(root.querySelector('.amount-input') as HTMLInputElement, '');
    expect(root.querySelector('.warn.error')?.textContent).toMatch(/buys in/);
  });

  it('switches to a tournament with an auto stack and blind levels', () => {
    const root = mount();
    const tourney = [...root.querySelectorAll<HTMLButtonElement>('.game-switch .seg')].find((b) =>
      b.textContent?.includes('Tournament'),
    )!;
    tourney.click();
    expect(root.querySelector('.tag')?.textContent).toBe('Picked for you');
    expect(root.querySelector('.schedule')).not.toBeNull();
    expect(total(root)).not.toContain('$');
    type(root.querySelector('.amount-input') as HTMLInputElement, '500');
    expect(total(root)).toBe('500');
    expect(root.querySelector('.tag')).toBeNull();
  });

  it('marks the set as custom once it is hand-edited', () => {
    const root = mount();
    (root.querySelector('.add-denom') as HTMLButtonElement).click();
    expect((root.querySelector('.preset-select') as HTMLSelectElement).value).toBe('custom');
    expect(root.querySelectorAll('.denom-row').length).toBe(6);
    expect((root.querySelector('.edit-chips') as HTMLDetailsElement).open).toBe(true);
  });

  it('recomputes when the player count changes', () => {
    const root = mount();
    const before = root.querySelector('.results')!.textContent;
    const plus = root.querySelector('.field-players .btn.step:last-child') as HTMLButtonElement;
    plus.click();
    plus.click();
    expect(root.querySelector('.results')!.textContent).not.toBe(before);
    expect((root.querySelector('.counter-input') as HTMLInputElement).value).toBe('7');
  });

  it('only offers clean prices when pinning the smallest chip', () => {
    const root = mount();
    const options = [...root.querySelectorAll('.pin-select option')].map((o) => o.textContent);
    expect(options[0]).toBe('Pick for me');
    expect(options).toContain('10¢');
    expect(options).not.toContain('25¢');
  });

  it('keeps a phone answer bar in sync with the result', () => {
    const root = mount();
    const peek = root.querySelector('.peek') as HTMLButtonElement;
    expect(peek.textContent).toContain('$20 in 35 chips');
    type(root.querySelector('.amount-input') as HTMLInputElement, '');
    expect(peek.textContent).toContain('Needs a fix');
  });

  it('shows what is left in the case and whether it covers a rebuy', () => {
    const root = mount();
    expect(root.querySelector('.facts')!.textContent).toMatch(/Left in the case/);
  });
});

describe('input parsing', () => {
  it('reads money the way people type it', () => {
    expect(readCents('20')).toBe(2000);
    expect(readCents('$12.50')).toBe(1250);
    expect(readCents('')).toBeNull();
    expect(readCents('0')).toBeNull();
  });

  it('reads whole numbers with separators', () => {
    expect(readWhole('1,500')).toBe(1500);
    expect(readWhole('abc')).toBeNull();
  });
});

describe('hydrate', () => {
  it('keeps a first-release cash buy-in, set and currency', () => {
    const state = hydrate({
      set: { denominations: [{ id: 'w', color: 'white', value: 1, count: 50 }] },
      config: { players: 7, mode: 'suggest', buyIn: null, moneyBuyIn: 25, targetStackChips: 30 },
      theme: 'midnight',
      moneySymbol: '€',
    });
    expect(state.config.buyInCents).toBe(2500);
    expect(state.config.currency).toBe('€');
    expect(state.config.players).toBe(7);
    expect(state.theme).toBe('midnight');
    expect(state.set.denominations).toHaveLength(1);
  });

  it('moves an untouched old 300-set default to the five-color set', () => {
    const old = hydrate({ set: STANDARD_300, config: { players: 6 } });
    expect(old.set.denominations.map((d) => d.color)).toContain('blue');
    const chosen = hydrate({ set: STANDARD_300, config: { players: 6 }, version: 2 });
    expect(chosen.set.denominations.map((d) => d.color)).not.toContain('blue');
  });

  it('falls back to defaults for junk', () => {
    const state = hydrate({ config: { players: 'lots', game: 'poker', buyInCents: -5 } });
    expect(state.config.players).toBe(5);
    expect(state.config.game).toBe('cash');
    expect(state.config.buyInCents).toBe(2000);
    expect(hydrate(null).config.game).toBe('cash');
  });
});
