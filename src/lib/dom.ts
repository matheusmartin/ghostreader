// Small DOM helpers. Text always goes in as text, never as HTML, except through `rich()`,
// which escapes first and then allows **bold** only.

export type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Content text with typographic quotes and **bold** marks. */
export function rich(text: string, tag: 'p' | 'span' | 'div' = 'span', className?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.innerHTML = escapeHtml(smartQuotes(text)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return el;
}

/**
 * Scene text: {when} in the accent colour and bold, [where] in bold, and **bold**.
 * "{That night} Maude waits in [the kitchen]." The marks are part of the sentence.
 */
export function sceneText(text: string, tag: 'p' | 'span' = 'p', className?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.innerHTML = escapeHtml(smartQuotes(text))
    .replace(/\{([^{}]+)\}/g, '<b class="when">$1</b>')
    .replace(/\[([^[\]]+)\]/g, '<b class="where">$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return el;
}

/** Scene text without its marks, for screen readers and word counts. */
export const plainScene = (text: string) => text.replace(/[{}[\]]|\*\*/g, '');

/** Typographic quotes and apostrophes, as The Economist style sets them. */
export function smartQuotes(s: string): string {
  return s
    .replace(/(^|[\s(\[{—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(\[{—–-])'/g, '$1‘')
    .replace(/'/g, '’');
}
