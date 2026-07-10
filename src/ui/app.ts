import {
  calculate,
  buildSummary,
  cloneSet,
  PALETTE,
  PRESETS,
  STANDARD_300,
  colorHex,
  formatMoney,
  unevenSmallNote,
  type Denom,
  type Result,
  type Warning,
  type WarningCode,
} from '../engine';
import { el, clear } from './dom';
import { chipEl, stackEl } from './chips';
import { Store, cryptoId, type AppState } from './state';

// Builds the whole calculator into a root node and wires it to the store. Editing an input
// mutates the store; the store notifies; only the results panel re-renders. The editor
// itself is rebuilt just on structural changes (add, remove, preset, reset), so typing
// never steals its own focus.

export function mountApp(root: HTMLElement, store: Store): void {
  const denomList = el('div', { class: 'denom-list' });
  const setSummary = el('p', { class: 'set-summary' });
  const buyInField = el('div', { class: 'field buyin-field' });
  const results = el('div', { class: 'results', attrs: { 'aria-live': 'polite' } });

  const recompute = (): void => {
    const state = store.get();
    renderResults(results, calculate(state.set, state.config), state, store);
  };

  const rebuildDenoms = (): void => {
    clear(denomList);
    const denoms = store.get().set.denominations;
    for (const d of denoms) {
      denomList.append(denomRow(store, d, rebuildDenoms, recompute));
    }
    setSummary.textContent = summarizeSet(denoms);
  };

  const editor = buildEditor(store, denomList, setSummary, rebuildDenoms, recompute);
  const game = buildGamePanel(store, buyInField, recompute);

  root.append(el('div', { class: 'calc' }, editor, game, results));

  rebuildDenoms();
  store.subscribe(recompute);
  recompute();
}

// --- Chip set editor ----------------------------------------------------------

function buildEditor(
  store: Store,
  denomList: HTMLElement,
  setSummary: HTMLElement,
  rebuildDenoms: () => void,
  recompute: () => void,
): HTMLElement {
  const preset = el('select', { class: 'preset-select', ariaLabel: 'Load a preset chip set' });
  preset.append(el('option', { value: 'custom' }, 'Presets'));
  for (const p of PRESETS)
    preset.append(el('option', { value: p.id }, `${p.label} (${p.description})`));
  preset.addEventListener('change', () => {
    const chosen = PRESETS.find((p) => p.id === preset.value);
    if (chosen) {
      store.update({ set: cloneSet(chosen.set) });
      rebuildDenoms();
    }
    preset.value = 'custom';
  });

  const addBtn = el(
    'button',
    {
      class: 'btn ghost add-denom',
      type: 'button',
      on: {
        click: () => {
          addDenom(store);
          rebuildDenoms();
          recompute();
        },
      },
    },
    '+ Add a color',
  );

  const resetBtn = el(
    'button',
    {
      class: 'btn ghost',
      type: 'button',
      title: 'Back to the Standard 300 set',
      on: {
        click: () => {
          store.update({ set: cloneSet(STANDARD_300) });
          rebuildDenoms();
          recompute();
        },
      },
    },
    'Reset set',
  );

  return el(
    'section',
    { class: 'panel editor' },
    el(
      'div',
      { class: 'panel-head' },
      el('h2', {}, 'Your chip set'),
      el('div', { class: 'panel-head-actions' }, preset, resetBtn),
    ),
    setSummary,
    el(
      'details',
      { class: 'editor-details' },
      el('summary', {}, 'Customize colors, values, and counts'),
      el(
        'div',
        { class: 'col-labels' },
        el('span', {}, 'Color'),
        el('span', {}, 'Value'),
        el('span', {}, 'In the box'),
        el('span', {}, ''),
      ),
      denomList,
      addBtn,
    ),
  );
}

function denomRow(
  store: Store,
  denom: Denom,
  rebuildDenoms: () => void,
  recompute: () => void,
): HTMLElement {
  // Tracked locally because patchDenom() replaces the store's denom object rather than
  // mutating this one, and this row is not rebuilt on a color change (only on add,
  // remove, preset, or reset), so `denom.color` itself would go stale after one pick.
  let currentColor = denom.color;
  const swatchLabel = (color: string): string => `Chip color, currently ${color}. Click to change.`;

  const swatch = el('button', {
    class: 'swatch',
    type: 'button',
    ariaLabel: swatchLabel(currentColor),
    attrs: { style: `--swatch:${colorHex(currentColor)}` },
  });
  swatch.addEventListener('click', () => {
    openPalette(swatch, currentColor, (color) => {
      currentColor = color;
      patchDenom(store, denom.id, { color });
      swatch.style.setProperty('--swatch', colorHex(color));
      swatch.setAttribute('aria-label', swatchLabel(color));
      recompute();
    });
  });

  const value = el('input', {
    class: 'num value-input',
    type: 'number',
    value: denom.value,
    min: 1,
    ariaLabel: 'Chip value',
    attrs: { inputmode: 'numeric' },
    on: {
      input: (e) => {
        const value = readIntOrNull((e.target as HTMLInputElement).value) ?? denom.value;
        patchDenom(store, denom.id, { value });
        recompute();
      },
    },
  });

  const removable = store.get().set.denominations.length > 1;
  const remove = el(
    'button',
    {
      class: 'btn icon danger',
      type: 'button',
      ariaLabel: `Remove the ${denom.color} chip`,
      disabled: !removable,
      on: {
        click: () => {
          removeDenom(store, denom.id);
          rebuildDenoms();
          recompute();
        },
      },
    },
    '×',
  );

  return el(
    'div',
    { class: 'denom-row' },
    swatch,
    value,
    counter(denom.count, 0, (n) => {
      patchDenom(store, denom.id, { count: n });
      recompute();
    }),
    remove,
  );
}

// --- Game inputs --------------------------------------------------------------

function buildGamePanel(store: Store, buyInField: HTMLElement, recompute: () => void): HTMLElement {
  const config = store.get().config;

  const players = counter(
    config.players,
    2,
    (n) => {
      store.updateConfig({ players: n });
      recompute();
    },
    10,
  );

  const buyInInput = el('input', {
    class: 'num',
    type: 'number',
    min: 1,
    value: config.buyIn ?? '',
    placeholder: 'e.g. 500',
    ariaLabel: 'Buy-in in chip value',
    attrs: { inputmode: 'numeric' },
    on: {
      input: (e) => {
        store.updateConfig({ buyIn: readIntOrNull((e.target as HTMLInputElement).value) });
        recompute();
      },
    },
  });
  clear(buyInField);
  buyInField.append(el('label', { class: 'field-label' }, 'Buy-in (in chips)'), buyInInput);

  const applyMode = (mode: 'solve' | 'suggest'): void => {
    store.updateConfig({ mode });
    solveBtn.classList.toggle('is-active', mode === 'solve');
    suggestBtn.classList.toggle('is-active', mode === 'suggest');
    buyInField.classList.toggle('is-hidden', mode === 'suggest');
    recompute();
  };

  const solveBtn = el(
    'button',
    { class: 'seg', type: 'button', on: { click: () => applyMode('solve') } },
    'I have a buy-in',
  );
  const suggestBtn = el(
    'button',
    { class: 'seg', type: 'button', on: { click: () => applyMode('suggest') } },
    'Suggest a good game',
  );
  const segmented = el(
    'div',
    { class: 'segmented', role: 'group', ariaLabel: 'Buy-in mode' },
    solveBtn,
    suggestBtn,
  );
  solveBtn.classList.toggle('is-active', config.mode === 'solve');
  suggestBtn.classList.toggle('is-active', config.mode === 'suggest');
  buyInField.classList.toggle('is-hidden', config.mode === 'suggest');

  // Optional cash mapping.
  const symbolInput = el('input', {
    class: 'num symbol-input',
    value: store.get().moneySymbol,
    ariaLabel: 'Currency symbol',
    attrs: { maxlength: '3' },
    on: {
      input: (e) => {
        store.update({ moneySymbol: (e.target as HTMLInputElement).value.slice(0, 3) || '$' });
        recompute();
      },
    },
  });
  const cashInput = el('input', {
    class: 'num',
    type: 'number',
    min: 0,
    value: config.moneyBuyIn ?? '',
    placeholder: 'optional',
    ariaLabel: 'Real cash buy-in per player',
    attrs: { inputmode: 'decimal' },
    on: {
      input: (e) => {
        store.updateConfig({ moneyBuyIn: readFloatOrNull((e.target as HTMLInputElement).value) });
        recompute();
      },
    },
  });

  const advanced = el(
    'details',
    { class: 'advanced' },
    el('summary', {}, 'Fine tuning'),
    el(
      'div',
      { class: 'advanced-body' },
      el(
        'label',
        { class: 'field-label' },
        'Cash per player',
        el('div', { class: 'cash-row' }, symbolInput, cashInput),
      ),
      el(
        'label',
        { class: 'field-label' },
        'Preferred stack size (chips)',
        counter(
          config.targetStackChips,
          8,
          (n) => {
            store.updateConfig({ targetStackChips: n });
            recompute();
          },
          80,
        ),
      ),
      toggle(
        'Let the smallest chip vary by one to hit the exact buy-in',
        config.allowUnevenSmallChips,
        (on) => {
          store.updateConfig({ allowUnevenSmallChips: on });
          recompute();
        },
      ),
    ),
  );

  return el(
    'section',
    { class: 'panel game' },
    el('h2', {}, 'The game'),
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Players'), players),
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Buy-in mode'), segmented),
    buyInField,
    advanced,
  );
}

// --- Results ------------------------------------------------------------------

function renderResults(container: HTMLElement, r: Result, state: AppState, store: Store): void {
  clear(container);

  if (!r.ok) {
    container.append(
      el(
        'div',
        { class: 'panel results-panel empty' },
        el('h2', {}, 'Not quite'),
        warningList(r.warnings),
      ),
    );
    return;
  }

  const panel = el('section', { class: 'panel results-panel' });

  if (r.suggestion) {
    panel.append(
      el(
        'div',
        { class: 'suggestion' },
        el('span', { class: 'suggestion-tag' }, 'Recommended'),
        el('span', {}, r.suggestion.rationale),
      ),
    );
  }

  panel.append(
    el(
      'div',
      { class: 'result-head' },
      el(
        'div',
        {},
        el('h2', {}, 'Every player gets'),
        el('p', { class: 'muted' }, `${r.totalChipsPerPlayer} chips per stack`),
      ),
      el(
        'div',
        { class: 'stack-total' },
        el('span', { class: 'stack-total-value' }, String(r.stackValue)),
        el('span', { class: 'stack-total-label' }, moneyLabel(r, state.moneySymbol) ?? 'in chips'),
      ),
    ),
  );

  const stacks = el('div', { class: 'stacks' });
  for (const p of r.perPlayer) {
    const cash = r.money
      ? el(
          'span',
          { class: 'chip-cash' },
          formatMoney(state.moneySymbol, p.value * r.money.perChipValue),
        )
      : null;
    stacks.append(
      el(
        'div',
        { class: 'stack-row' },
        stackEl(p.color, p.count),
        el('span', { class: 'stack-count' }, `${p.count}`),
        el('span', { class: 'stack-mult' }, '×'),
        chipEl(p.color, p.value),
        el('span', { class: 'stack-sub' }, `= ${p.count * p.value}`),
        cash,
      ),
    );
  }
  panel.append(stacks);

  if (r.unevenSmall) {
    panel.append(el('p', { class: 'uneven-note' }, unevenSmallNote(r.unevenSmall)));
  }

  if (r.blinds) panel.append(blindCard(r));
  if (r.leftover.length > 0) panel.append(leftoverCard(r));
  if (r.warnings.length > 0) panel.append(warningList(r.warnings));

  panel.append(copyBar(r, state, store));
  container.append(panel);
}

function blindCard(r: Result): HTMLElement {
  const b = r.blinds!;
  const schedule = el('table', { class: 'schedule' });
  schedule.append(
    el(
      'thead',
      {},
      el('tr', {}, el('th', {}, 'Level'), el('th', {}, 'Small'), el('th', {}, 'Big')),
    ),
  );
  const body = el('tbody', {});
  for (const level of b.schedule) {
    body.append(
      el(
        'tr',
        {},
        el('td', {}, `${level.level}`),
        el('td', {}, `${level.small}`),
        el('td', {}, `${level.big}`),
      ),
    );
  }
  schedule.append(body);

  return el(
    'div',
    { class: 'card blind-card' },
    el(
      'div',
      { class: 'blind-head' },
      el('h3', {}, 'Blinds'),
      el(
        'div',
        { class: 'blind-now' },
        el('span', { class: 'blind-big' }, `${b.small} / ${b.big}`),
        el('span', { class: 'muted' }, `${Math.round(b.startingBBDepth)} big blinds deep`),
      ),
    ),
    el('details', { class: 'schedule-wrap' }, el('summary', {}, 'Escalating schedule'), schedule),
  );
}

function leftoverCard(r: Result): HTMLElement {
  const row = el('div', { class: 'leftover-row' });
  for (const p of r.leftover) {
    row.append(
      el(
        'span',
        { class: 'leftover-chip' },
        chipEl(p.color, p.value),
        el('span', {}, `${p.count}`),
      ),
    );
  }
  return el(
    'div',
    { class: 'card leftover-card' },
    el('h3', {}, 'Left in the box'),
    el('p', { class: 'muted' }, 'For rebuys, late arrivals, and color-ups.'),
    row,
  );
}

function copyBar(r: Result, state: AppState, store: Store): HTMLElement {
  const btn = el('button', { class: 'btn primary', type: 'button' }, 'Copy summary');
  btn.addEventListener('click', () => {
    const text = buildSummary(r, {
      players: store.get().config.players,
      moneySymbol: state.moneySymbol,
    });
    void copyText(text, btn);
  });
  return el('div', { class: 'copy-bar' }, btn);
}

function warningList(warnings: Warning[]): HTMLElement {
  const list = el('ul', { class: 'warnings' });
  for (const w of warnings) {
    list.append(el('li', { class: `warn ${severity(w.code)}` }, w.message));
  }
  return list;
}

// --- Small building blocks ----------------------------------------------------

/** A touch-friendly integer counter: [-] value [+], clamped, editable. */
function counter(
  value: number,
  min: number,
  onChange: (n: number) => void,
  max = 100000,
): HTMLElement {
  const input = el('input', {
    class: 'num counter-input',
    type: 'number',
    value,
    min,
    max,
    attrs: { inputmode: 'numeric' },
  }) as HTMLInputElement;

  const commit = (n: number): void => {
    const clamped = Math.max(min, Math.min(max, Math.round(n)));
    input.value = String(clamped);
    onChange(clamped);
  };

  input.addEventListener('input', () =>
    onChange(Math.max(min, Math.min(max, readInt(input.value, min)))),
  );
  input.addEventListener('blur', () => commit(readInt(input.value, min)));

  const minus = el(
    'button',
    {
      class: 'btn step',
      type: 'button',
      ariaLabel: 'Decrease',
      on: { click: () => commit(readInt(input.value, min) - 1) },
    },
    '−',
  );
  const plus = el(
    'button',
    {
      class: 'btn step',
      type: 'button',
      ariaLabel: 'Increase',
      on: { click: () => commit(readInt(input.value, min) + 1) },
    },
    '+',
  );

  return el('div', { class: 'counter' }, minus, input, plus);
}

function toggle(label: string, on: boolean, onChange: (on: boolean) => void): HTMLElement {
  const input = el('input', {
    type: 'checkbox',
    checked: on,
    on: { change: (e) => onChange((e.target as HTMLInputElement).checked) },
  });
  return el('label', { class: 'toggle' }, input, el('span', {}, label));
}

// All state for the currently-open popover lives in one object, so a deferred setTimeout
// from a superseded popover can check "is this still the current one?" and no-op instead
// of binding listeners for a popover that closePalette() already tore down.
interface PaletteState {
  pop: HTMLElement;
  onOutside: (e: Event) => void;
  onEscape: (e: KeyboardEvent) => void;
}
let activePalette: PaletteState | null = null;

function openPalette(anchor: HTMLElement, current: string, onPick: (color: string) => void): void {
  closePalette();
  const pop = el('div', { class: 'palette-pop', role: 'menu' });
  for (const c of PALETTE) {
    pop.append(
      el('button', {
        class: `palette-swatch${c.key === current ? ' is-current' : ''}`,
        type: 'button',
        ariaLabel: c.label,
        title: c.label,
        attrs: { style: `background:${c.hex}` },
        on: {
          click: () => {
            onPick(c.key);
            closePalette();
          },
        },
      }),
    );
  }
  document.body.append(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.top = `${window.scrollY + rect.bottom + 6}px`;
  pop.style.left = `${window.scrollX + rect.left}px`;

  const onOutside = (e: Event): void => {
    if (e.target instanceof Node && pop.contains(e.target)) return;
    closePalette();
  };
  const onEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closePalette();
  };
  activePalette = { pop, onOutside, onEscape };

  // Defer so the click that opened the popover does not immediately close it. If a
  // newer popover has already replaced this one by the time this fires, do nothing.
  setTimeout(() => {
    if (activePalette?.pop !== pop) return;
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
  }, 0);
}

function closePalette(): void {
  if (!activePalette) return;
  const { pop, onOutside, onEscape } = activePalette;
  pop.remove();
  document.removeEventListener('pointerdown', onOutside);
  document.removeEventListener('keydown', onEscape);
  activePalette = null;
}

// --- Store mutations ----------------------------------------------------------

function patchDenom(store: Store, id: string, patch: Partial<Denom>): void {
  store.update({
    set: {
      denominations: store
        .get()
        .set.denominations.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    },
  });
}

function removeDenom(store: Store, id: string): void {
  const denoms = store.get().set.denominations.filter((d) => d.id !== id);
  if (denoms.length > 0) store.update({ set: { denominations: denoms } });
}

function addDenom(store: Store): void {
  const denoms = store.get().set.denominations;
  const usedColors = new Set(denoms.map((d) => d.color));
  const nextColor = PALETTE.find((c) => !usedColors.has(c.key))?.key ?? 'gray';
  const maxValue = denoms.reduce((m, d) => Math.max(m, d.value), 0);
  const nextValue = maxValue === 0 ? 1 : maxValue * 5;
  store.update({
    set: {
      denominations: [...denoms, { id: cryptoId(), color: nextColor, value: nextValue, count: 0 }],
    },
  });
}

// --- Formatting helpers -------------------------------------------------------

/** One-line recap shown above the collapsed editor, e.g. "100 white (1), 100 red (5)...". */
function summarizeSet(denoms: Denom[]): string {
  if (denoms.length === 0) return 'No chips yet.';
  const label = (color: string): string => PALETTE.find((c) => c.key === color)?.label ?? color;
  return [...denoms]
    .sort((a, b) => a.value - b.value)
    .map((d) => `${d.count} ${label(d.color)} (${d.value})`)
    .join(', ');
}

function severity(code: WarningCode): string {
  return code === 'infeasible' || code === 'not-enough-chips' || code === 'input'
    ? 'error'
    : 'notice';
}

function moneyLabel(r: Result, symbol: string): string | null {
  if (!r.money) return null;
  return `worth ${formatMoney(symbol, r.money.perChipValue * r.stackValue)}`;
}

function readInt(raw: string, fallback: number): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function readIntOrNull(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readFloatOrNull(raw: string): number | null {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function copyText(text: string, btn: HTMLButtonElement): Promise<void> {
  const done = (ok: boolean): void => {
    const original = 'Copy summary';
    btn.textContent = ok ? 'Copied' : 'Press Ctrl or Cmd C';
    setTimeout(() => (btn.textContent = original), 1600);
  };
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      done(true);
      return;
    }
  } catch {
    // fall through to the manual path
  }
  done(false);
}
