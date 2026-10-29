import {
  calculate,
  buildSummary,
  chipFace,
  cloneSet,
  colorHex,
  colorName,
  formatAmount,
  formatCents,
  formatNumber,
  matchingPresetId,
  plural,
  smallestChipOptions,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PALETTE,
  PRESETS,
  DEFAULT_SET,
  type Denom,
  type GameType,
  type Result,
  type StackChip,
  type Warning,
  type WarningCode,
} from '../engine';
import { el, clear } from './dom';
import { chipEl } from './chips';
import { CURRENCIES, Store, cryptoId } from './state';

// Builds the calculator into a root node and wires it to the store.
//
// Three questions, in the order a host thinks about them: what are we playing, how many
// people, and how much. The answer appears underneath immediately and updates as you type.
// Everything else (editing the chip case, stack size, pinning a chip's price, currency)
// sits behind two collapsed disclosures.
//
// Rendering: the setup panel is rebuilt only on structural changes (switching game type,
// adding or removing a color), so typing never loses focus. Small "sync" callbacks keep the
// persistent controls honest on every other change, and the results panel re-renders on
// every store update.

const CASH_PICKS = [500, 1000, 2000, 5000, 10000];
const STACK_PICKS = [500, 1000, 1500, 2500, 5000];
const STACK_SIZES = [
  { label: 'Fewer', chips: 20 },
  { label: 'Standard', chips: 30 },
  { label: 'More', chips: 45 },
];

interface UiState {
  editOpen: boolean;
  moreOpen: boolean;
}

type Sync = () => void;

export function mountApp(root: HTMLElement, store: Store): void {
  const setup = el('section', { class: 'panel setup', ariaLabel: 'Your game' });
  const results = el('section', { class: 'results', attrs: { 'aria-live': 'polite' } });
  const ui: UiState = { editOpen: false, moreOpen: false };
  let syncs: Sync[] = [];

  const renderSetup = (): void => {
    syncs = [];
    clear(setup);
    setup.append(...buildSetup(store, ui, renderSetup, (fn) => syncs.push(fn)));
    for (const fn of syncs) fn();
  };

  // Phones stack the answer under the form, so a slim bar pinned to the bottom of the
  // screen keeps the headline in view and jumps to the full split. It hides itself whenever
  // the answer is already on screen, and CSS hides it outright on wider layouts.
  const peekText = el('span', { class: 'peek-text' });
  const peek = el(
    'button',
    {
      class: 'peek',
      type: 'button',
      on: { click: () => results.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    },
    peekText,
    el('span', { class: 'peek-cta' }, 'See the split'),
  );

  root.append(el('div', { class: 'calc' }, setup, results), peek);

  const refresh = (): void => {
    const r = renderResults(results, store);
    const { config } = store.get();
    peekText.textContent = r.ok
      ? `${formatAmount(r.stackValue, r.game, config.currency)} in ${plural(r.totalChipsPerPlayer, 'chip')}`
      : 'Needs a fix';
  };

  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(
      ([entry]) => peek.classList.toggle('is-hidden', entry.isIntersecting),
      { threshold: 0.15 },
    ).observe(results);
  }

  store.subscribe(() => {
    for (const fn of syncs) fn();
    refresh();
  });
  renderSetup();
  refresh();
}

// --- Setup ----------------------------------------------------------------------

function buildSetup(
  store: Store,
  ui: UiState,
  rebuild: () => void,
  onSync: (fn: Sync) => void,
): HTMLElement[] {
  const { config } = store.get();
  const game = config.game;

  const gameSwitch = segmented(
    'What are you playing?',
    [
      { value: 'cash', label: 'Cash game', hint: 'Chips are money' },
      { value: 'tournament', label: 'Tournament', hint: 'Chips are points' },
    ],
    game,
    (value) => {
      store.updateConfig({ game: value as GameType });
      rebuild();
    },
    'game-switch',
  );

  const players = field(
    'Players',
    counter(config.players, MIN_PLAYERS, MAX_PLAYERS, 'Players', (n) =>
      store.updateConfig({ players: n }),
    ),
    'field-players',
  );

  const amount = game === 'cash' ? cashField(store, onSync) : stackField(store, onSync);

  return [
    gameSwitch,
    el('div', { class: 'setup-row' }, players, amount),
    chipSetField(store, ui, rebuild, onSync),
    moreOptions(store, ui, onSync),
  ];
}

function cashField(store: Store, onSync: (fn: Sync) => void): HTMLElement {
  const { config } = store.get();
  const symbol = el('span', { class: 'affix' }, config.currency);
  const input = el('input', {
    class: 'num amount-input',
    type: 'text',
    value: config.buyInCents !== null ? centsToInput(config.buyInCents) : '',
    placeholder: '20',
    ariaLabel: 'Buy-in per player',
    attrs: { inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done' },
    on: {
      input: (e) =>
        store.updateConfig({ buyInCents: readCents((e.target as HTMLInputElement).value) }),
    },
  });

  const picks = pills(
    CASH_PICKS.map((c) => ({ value: c, label: formatCents(c, config.currency) })),
    (c) => {
      input.value = centsToInput(c);
      store.updateConfig({ buyInCents: c });
    },
  );

  onSync(() => {
    const { buyInCents, currency } = store.get().config;
    symbol.textContent = currency;
    picks.sync(buyInCents, (c) => formatCents(c, currency));
  });

  return field(
    'Buy-in per player',
    el('div', { class: 'amount' }, el('div', { class: 'affix-wrap' }, symbol, input), picks.node),
    'field-amount',
  );
}

function stackField(store: Store, onSync: (fn: Sync) => void): HTMLElement {
  const { config } = store.get();
  const input = el('input', {
    class: 'num amount-input',
    type: 'text',
    value: config.startingStack ?? '',
    placeholder: 'Auto',
    ariaLabel: 'Starting stack per player',
    attrs: { inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'done' },
    on: {
      input: (e) =>
        store.updateConfig({ startingStack: readWhole((e.target as HTMLInputElement).value) }),
    },
  });

  const picks = pills(
    [
      { value: 0, label: 'Auto' },
      ...STACK_PICKS.map((s) => ({ value: s, label: formatNumber(s) })),
    ],
    (s) => {
      input.value = s === 0 ? '' : String(s);
      store.updateConfig({ startingStack: s === 0 ? null : s });
    },
  );

  onSync(() => picks.sync(store.get().config.startingStack ?? 0));

  return field(
    'Starting stack',
    el('div', { class: 'amount' }, el('div', { class: 'affix-wrap' }, input), picks.node),
    'field-amount',
  );
}

function chipSetField(
  store: Store,
  ui: UiState,
  rebuild: () => void,
  onSync: (fn: Sync) => void,
): HTMLElement {
  const preset = el('select', { class: 'select preset-select', ariaLabel: 'Chip set' });
  for (const p of PRESETS) preset.append(el('option', { value: p.id }, `${p.label} piece set`));
  preset.append(el('option', { value: 'custom' }, 'My own set'));
  preset.addEventListener('change', () => {
    const chosen = PRESETS.find((p) => p.id === preset.value);
    if (chosen) {
      store.update({ set: cloneSet(chosen.set) });
      rebuild();
    } else {
      ui.editOpen = true;
      rebuild();
    }
  });

  const summary = el('p', { class: 'set-summary' });

  const denomList = el('div', { class: 'denom-list' });
  for (const d of store.get().set.denominations) denomList.append(denomRow(store, d, rebuild));

  const editor = el(
    'details',
    { class: 'disclosure edit-chips' },
    el('summary', {}, 'Edit colors, values and counts'),
    el(
      'div',
      { class: 'disclosure-body' },
      el(
        'p',
        { class: 'hint' },
        'Count what is in your case. The value is the number printed on the chip, or how many of your smallest chip it stands for.',
      ),
      el(
        'div',
        { class: 'col-labels', attrs: { 'aria-hidden': 'true' } },
        el('span', {}, 'Color'),
        el('span', {}, 'Value'),
        el('span', {}, 'How many'),
        el('span', {}, ''),
      ),
      denomList,
      el(
        'div',
        { class: 'editor-actions' },
        el(
          'button',
          {
            class: 'btn ghost add-denom',
            type: 'button',
            on: {
              click: () => {
                addDenom(store);
                ui.editOpen = true;
                rebuild();
              },
            },
          },
          '+ Add a color',
        ),
        el(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            on: {
              click: () => {
                store.update({ set: cloneSet(DEFAULT_SET) });
                rebuild();
              },
            },
          },
          'Reset to standard set',
        ),
      ),
    ),
  );
  editor.open = ui.editOpen;
  editor.addEventListener('toggle', () => (ui.editOpen = editor.open));

  onSync(() => {
    const { set } = store.get();
    preset.value = matchingPresetId(set);
    summary.replaceChildren(...setSummary(set.denominations));
  });

  return el('div', { class: 'field field-set' }, field('Chip set', preset), summary, editor);
}

function moreOptions(store: Store, ui: UiState, onSync: (fn: Sync) => void): HTMLElement {
  const { config } = store.get();

  const size = segmented(
    'Chips per player',
    STACK_SIZES.map((s) => ({ value: String(s.chips), label: s.label, hint: `about ${s.chips}` })),
    String(nearestSize(config.targetStackChips)),
    (value) => store.updateConfig({ targetStackChips: Number(value) }),
    'size-switch',
  );

  const currency = el('select', { class: 'select', ariaLabel: 'Currency' });
  for (const c of CURRENCIES) currency.append(el('option', { value: c }, c));
  currency.value = config.currency;
  currency.addEventListener('change', () => store.updateConfig({ currency: currency.value }));

  const body = el('div', { class: 'disclosure-body' }, size);

  if (config.game === 'cash') {
    const pin = el('select', { class: 'select pin-select', ariaLabel: 'Smallest chip is worth' });
    pin.addEventListener('change', () =>
      store.updateConfig({ smallestChipCents: pin.value === 'auto' ? null : Number(pin.value) }),
    );
    let lastKey = '';
    onSync(() => {
      const { set, config: c } = store.get();
      const options = smallestChipOptions(set.denominations.map((d) => d.value));
      const key = `${options.join(',')}|${c.currency}`;
      if (key !== lastKey) {
        lastKey = key;
        pin.replaceChildren(el('option', { value: 'auto' }, 'Pick for me'));
        for (const cents of options) {
          pin.append(el('option', { value: String(cents) }, formatCents(cents, c.currency)));
        }
      }
      pin.value =
        c.smallestChipCents !== null && options.includes(c.smallestChipCents)
          ? String(c.smallestChipCents)
          : 'auto';
    });
    body.append(
      el(
        'div',
        { class: 'option-row' },
        field('Smallest chip is worth', pin),
        field('Currency', currency),
      ),
    );
  }

  const details = el(
    'details',
    { class: 'disclosure more-options' },
    el('summary', {}, 'More options'),
    body,
  );
  details.open = ui.moreOpen;
  details.addEventListener('toggle', () => (ui.moreOpen = details.open));
  return details;
}

function denomRow(store: Store, denom: Denom, rebuild: () => void): HTMLElement {
  // Tracked locally: patchDenom() replaces the store's denom object and this row is not
  // rebuilt on a color change, so `denom.color` itself would go stale after one pick.
  let currentColor = denom.color;
  const swatchLabel = (color: string): string => `${colorName(color)} chip. Change color.`;

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
    });
  });

  const value = el('input', {
    class: 'num value-input',
    type: 'text',
    value: denom.value,
    ariaLabel: 'Chip value',
    attrs: { inputmode: 'numeric', autocomplete: 'off' },
    on: {
      input: (e) => {
        const v = readWhole((e.target as HTMLInputElement).value);
        if (v !== null) patchDenom(store, denom.id, { value: v });
      },
    },
  });

  const removable = store.get().set.denominations.length > 1;
  const remove = el(
    'button',
    {
      class: 'btn icon danger',
      type: 'button',
      ariaLabel: `Remove this color`,
      disabled: !removable,
      on: {
        click: () => {
          removeDenom(store, denom.id);
          rebuild();
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
    counter(denom.count, 0, 10000, 'How many', (n) => patchDenom(store, denom.id, { count: n })),
    remove,
  );
}

// --- Results --------------------------------------------------------------------

function renderResults(container: HTMLElement, store: Store): Result {
  const { set, config } = store.get();
  const r = calculate(set, config);
  clear(container);

  if (!r.ok) {
    container.append(el('div', { class: 'panel results-panel empty' }, warningList(r.warnings)));
    return r;
  }

  const sym = config.currency;
  const fmt = (n: number): string => formatAmount(n, r.game, sym);
  const worth = (p: StackChip): number => (r.game === 'cash' ? (p.cents as number) : p.value);
  const panel = el('div', { class: 'panel results-panel' });

  panel.append(
    el('p', { class: 'kicker' }, 'Each player gets'),
    el(
      'div',
      { class: 'result-head' },
      el('span', { class: 'stack-total-value' }, fmt(r.stackValue)),
      el('span', { class: 'stack-total-label' }, `in ${plural(r.totalChipsPerPlayer, 'chip')}`),
      r.autoPicked ? el('span', { class: 'tag' }, 'Picked for you') : null,
    ),
  );

  const rows = el('ul', { class: 'stacks' });
  for (const p of r.perPlayer) {
    const each = worth(p);
    rows.append(
      el(
        'li',
        { class: 'stack-row' },
        chipEl(p.color, chipFace(each, r.game, sym)),
        el('span', { class: 'stack-count' }, String(p.count)),
        el(
          'span',
          { class: 'stack-name' },
          colorName(p.color),
          r.game === 'cash' ? el('small', {}, `${fmt(each)} each`) : null,
        ),
        el('span', { class: 'stack-sub' }, fmt(each * p.count)),
      ),
    );
  }
  panel.append(rows);

  const facts = el('div', { class: 'facts' });
  if (r.blinds) {
    const b = r.blinds;
    facts.append(
      fact(
        r.game === 'cash' ? 'Blinds' : 'Blinds start at',
        `${fmt(b.small)} / ${fmt(b.big)}`,
        r.game === 'cash' ? 'Small blind / big blind' : 'Go up every 15 to 20 minutes',
      ),
    );
  }
  facts.append(
    fact(
      'Left in the case',
      r.rebuys > 0 ? `Enough for ${plural(r.rebuys, 'rebuy')}` : 'No full rebuy',
      null,
      r.leftover.length > 0 ? leftoverChips(r, sym) : null,
    ),
  );
  panel.append(facts);

  if (r.game === 'tournament' && r.blinds) panel.append(scheduleDetails(r, sym));
  if (r.warnings.length > 0) panel.append(warningList(r.warnings));

  panel.append(copyBar(r, store));
  container.append(panel);
  return r;
}

function fact(
  label: string,
  value: string,
  hint: string | null,
  extra: HTMLElement | null = null,
): HTMLElement {
  return el(
    'div',
    { class: 'fact' },
    el('span', { class: 'fact-label' }, label),
    el('strong', { class: 'fact-value' }, value),
    hint ? el('span', { class: 'fact-hint' }, hint) : null,
    extra,
  );
}

function leftoverChips(r: Result, sym: string): HTMLElement {
  const list = el('span', { class: 'leftover' });
  for (const p of r.leftover) {
    const each = r.game === 'cash' ? (p.cents as number) : p.value;
    list.append(
      el(
        'span',
        { class: 'leftover-item', title: `${p.count} ${colorName(p.color)}` },
        chipEl(p.color, chipFace(each, r.game, sym), 'sm'),
        el('span', {}, formatNumber(p.count)),
      ),
    );
  }
  return list;
}

function scheduleDetails(r: Result, sym: string): HTMLElement {
  const fmt = (n: number): string => formatAmount(n, r.game, sym);
  const table = el('table', { class: 'schedule' });
  table.append(
    el(
      'thead',
      {},
      el('tr', {}, el('th', {}, 'Level'), el('th', {}, 'Small'), el('th', {}, 'Big')),
    ),
  );
  const body = el('tbody', {});
  for (const level of r.blinds!.schedule) {
    body.append(
      el(
        'tr',
        {},
        el('td', {}, String(level.level)),
        el('td', {}, fmt(level.small)),
        el('td', {}, fmt(level.big)),
      ),
    );
  }
  table.append(body);
  return el(
    'details',
    { class: 'disclosure schedule-details' },
    el('summary', {}, 'Blind levels'),
    table,
  );
}

function copyBar(r: Result, store: Store): HTMLElement {
  const label = 'Copy for the group chat';
  const btn = el('button', { class: 'btn primary', type: 'button' }, label);
  btn.addEventListener('click', () => {
    void copyText(buildSummary(r, store.get().config), btn, label);
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

// --- Small building blocks ------------------------------------------------------

let fieldIds = 0;

/** A labelled field. The label points at the first input or select inside the control. */
function field(label: string, control: HTMLElement, cls = ''): HTMLElement {
  const target = control.matches('input, select')
    ? control
    : control.querySelector<HTMLElement>('input, select');
  const labelEl = el('label', { class: 'field-label' }, label);
  if (target) {
    if (!target.id) target.id = `f${++fieldIds}`;
    (labelEl as HTMLLabelElement).htmlFor = target.id;
    target.removeAttribute('aria-label');
  }
  return el('div', { class: `field ${cls}`.trim() }, labelEl, control);
}

interface SegOption {
  value: string;
  label: string;
  hint?: string;
}

function segmented(
  label: string,
  options: SegOption[],
  current: string,
  onPick: (value: string) => void,
  cls: string,
): HTMLElement {
  const buttons = options.map((o) => {
    const btn = el(
      'button',
      {
        class: 'seg',
        type: 'button',
        attrs: { 'aria-pressed': String(o.value === current) },
        dataset: { value: o.value },
      },
      el('span', { class: 'seg-label' }, o.label),
      o.hint ? el('span', { class: 'seg-hint' }, o.hint) : null,
    );
    btn.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
      onPick(o.value);
    });
    return btn;
  });
  return el(
    'div',
    { class: `segmented-field ${cls}` },
    el('span', { class: 'field-label' }, label),
    el('div', { class: 'segmented', role: 'group', ariaLabel: label }, ...buttons),
  );
}

interface Pills {
  node: HTMLElement;
  sync: (current: number | null, relabel?: (value: number) => string) => void;
}

function pills(
  options: { value: number; label: string }[],
  onPick: (value: number) => void,
): Pills {
  const node = el('div', { class: 'pills', role: 'group', ariaLabel: 'Quick picks' });
  const buttons = options.map((o) =>
    el(
      'button',
      {
        class: 'pill',
        type: 'button',
        dataset: { value: String(o.value) },
        on: { click: () => onPick(o.value) },
      },
      o.label,
    ),
  );
  node.append(...buttons);
  return {
    node,
    sync: (current, relabel) => {
      buttons.forEach((b, i) => {
        b.setAttribute('aria-pressed', String(options[i].value === current));
        if (relabel) b.textContent = relabel(options[i].value);
      });
    },
  };
}

/** A touch-friendly integer counter: [-] value [+], clamped, editable. */
function counter(
  value: number,
  min: number,
  max: number,
  label: string,
  onChange: (n: number) => void,
): HTMLElement {
  const input = el('input', {
    class: 'num counter-input',
    type: 'text',
    value,
    ariaLabel: label,
    attrs: { inputmode: 'numeric', autocomplete: 'off' },
  });

  const clampTo = (n: number): number => Math.max(min, Math.min(max, Math.round(n)));
  const commit = (n: number): void => {
    const clamped = clampTo(n);
    input.value = String(clamped);
    onChange(clamped);
  };

  input.addEventListener('input', () => {
    const n = readWhole(input.value) ?? (input.value.trim() === '0' ? 0 : null);
    if (n !== null) onChange(clampTo(n));
  });
  input.addEventListener('blur', () => commit(readWhole(input.value) ?? min));

  const step = (delta: number, text: string, aria: string): HTMLElement =>
    el(
      'button',
      {
        class: 'btn step',
        type: 'button',
        ariaLabel: `${aria} ${label.toLowerCase()}`,
        on: { click: () => commit((readWhole(input.value) ?? min) + delta) },
      },
      text,
    );

  return el('div', { class: 'counter' }, step(-1, '−', 'Fewer'), input, step(1, '+', 'More'));
}

// All state for the open color popover lives in one object, so a deferred setTimeout from a
// superseded popover can check "is this still the current one?" and no-op.
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
        attrs: { style: `background:${c.hex}`, role: 'menuitem' },
        on: {
          click: () => {
            onPick(c.key);
            closePalette();
            anchor.focus();
          },
        },
      }),
    );
  }
  document.body.append(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.top = `${window.scrollY + rect.bottom + 6}px`;
  pop.style.left = `${window.scrollX + rect.left}px`;
  (pop.firstElementChild as HTMLElement | null)?.focus();

  const onOutside = (e: Event): void => {
    if (e.target instanceof Node && pop.contains(e.target)) return;
    closePalette();
  };
  const onEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      closePalette();
      anchor.focus();
    }
  };
  activePalette = { pop, onOutside, onEscape };

  // Defer so the click that opened the popover does not immediately close it.
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

// --- Store mutations --------------------------------------------------------------

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
      denominations: [...denoms, { id: cryptoId(), color: nextColor, value: nextValue, count: 20 }],
    },
  });
}

// --- Formatting and parsing helpers ------------------------------------------------

/** One-line recap under the preset picker: a dot per color and its count. */
function setSummary(denoms: Denom[]): Node[] {
  if (denoms.length === 0) return [document.createTextNode('No chips yet.')];
  return [...denoms]
    .sort((a, b) => a.value - b.value)
    .map((d) =>
      el(
        'span',
        { class: 'set-item' },
        el('span', { class: 'dot', attrs: { style: `--dot:${colorHex(d.color)}` } }),
        `${formatNumber(d.count)} ${colorName(d.color).toLowerCase()}`,
      ),
    );
}

function nearestSize(chips: number): number {
  return STACK_SIZES.reduce((best, s) =>
    Math.abs(s.chips - chips) < Math.abs(best.chips - chips) ? s : best,
  ).chips;
}

function severity(code: WarningCode): string {
  return code === 'not-enough-chips' || code === 'input' ? 'error' : 'notice';
}

/** "20", "12.50", "$20" -> cents. Empty or junk -> null. */
export function readCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** "1,500" -> 1500. Empty, zero or junk -> null. */
export function readWhole(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (cleaned === '') return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

async function copyText(text: string, btn: HTMLButtonElement, label: string): Promise<void> {
  const done = (ok: boolean): void => {
    btn.textContent = ok ? 'Copied' : 'Copy failed. Select and copy manually.';
    setTimeout(() => (btn.textContent = label), 1800);
  };
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      done(true);
      return;
    }
  } catch {
    // fall through
  }
  done(false);
}
