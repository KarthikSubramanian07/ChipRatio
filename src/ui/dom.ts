// The entire "framework". A tiny element builder so the rest of the UI reads like markup
// without shipping a dependency. Everything sets text or attributes, never innerHTML from
// data, so user input can never become markup.

type Child = Node | string | number | null | undefined | false;
type Handler = (e: Event) => void;

interface Attrs {
  class?: string;
  id?: string;
  type?: string;
  for?: string;
  href?: string;
  title?: string;
  value?: string | number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  ariaLabel?: string;
  role?: string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  on?: Record<string, Handler>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (attrs.class) node.className = attrs.class;
  if (attrs.id) node.id = attrs.id;
  if (attrs.title) node.title = attrs.title;
  if (attrs.role) node.setAttribute('role', attrs.role);
  if (attrs.ariaLabel) node.setAttribute('aria-label', attrs.ariaLabel);
  if (attrs.href && node instanceof HTMLAnchorElement) node.href = attrs.href;
  if (attrs.for && node instanceof HTMLLabelElement) node.htmlFor = attrs.for;
  if (attrs.placeholder && 'placeholder' in node)
    (node as HTMLInputElement).placeholder = attrs.placeholder;
  if (attrs.type && 'type' in node) (node as HTMLInputElement).type = attrs.type;
  if (attrs.value !== undefined && 'value' in node)
    (node as HTMLInputElement).value = String(attrs.value);
  if (attrs.min !== undefined) node.setAttribute('min', String(attrs.min));
  if (attrs.max !== undefined) node.setAttribute('max', String(attrs.max));
  if (attrs.step !== undefined) node.setAttribute('step', String(attrs.step));
  if (attrs.disabled) (node as HTMLButtonElement).disabled = true;
  if (attrs.checked && 'checked' in node) (node as HTMLInputElement).checked = true;

  if (attrs.dataset) {
    for (const [k, v] of Object.entries(attrs.dataset)) node.dataset[k] = v;
  }
  if (attrs.attrs) {
    for (const [k, v] of Object.entries(attrs.attrs)) node.setAttribute(k, v);
  }
  if (attrs.on) {
    for (const [event, handler] of Object.entries(attrs.on)) node.addEventListener(event, handler);
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? String(child) : child);
  }

  return node;
}

/** Remove every child of a node. */
export function clear(node: Element): void {
  node.replaceChildren();
}

/** Query a required element, throwing a clear error if the markup drifts. */
export function mustFind<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`ChipRatio: expected element "${selector}" was not found`);
  return node;
}
