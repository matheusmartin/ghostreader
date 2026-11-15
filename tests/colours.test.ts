// Reads src/styles/tokens.css and checks the contrast rules of the colour system in every page
// colour, so an edit to a token cannot quietly break them. WCAG 2 ratios: 4.5:1 for text,
// 3:1 for shapes and data marks.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMES as PICKER } from '../src/lib/scheme.ts';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
  selectors: sel.split(',').map((s) => s.trim()),
  decls: Object.fromEntries([...body.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])),
}));

/** Tokens set by blocks that list one of these selectors on their own. */
function tokens(...selectors: string[]): Record<string, string> {
  return Object.assign({}, ...blocks.filter((b) => b.selectors.some((s) => selectors.includes(s))).map((b) => b.decls));
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h: string) => {
  const [r, g, b] = hex(h).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** color-mix(in srgb, a p%, b) */
const mix = (a: string, b: string, p: number) =>
  '#' + hex(a).map((v, i) => Math.round(v * p + hex(b)[i] * (1 - p)).toString(16).padStart(2, '0')).join('');

// Every theme the picker offers (Auto is Paper or Dusk).
const SCHEMES = PICKER.map((s) => s.id).filter((id) => id !== 'auto');

it('index.html applies every theme before the first paint', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ok = html.match(/var ok = \[([^\]]*)\]/)?.[1].match(/'[\w-]+'/g)?.map((s) => s.slice(1, -1));
  expect(ok?.slice().sort()).toEqual([...SCHEMES].sort());
});

for (const id of SCHEMES) {
  const sel = `[data-scheme="${id}"]`;
  const t = { ...tokens(':root'), ...(id === 'paper' ? tokens(':root') : {}), ...tokens(sel) };
  const dark = t['color-scheme'] === 'dark';

  describe(`theme ${id}`, () => {
    it('text colours reach 4.5:1 on the page and on cards', () => {
      for (const k of ['--ink', '--body', '--muted']) {
        expect(ratio(t[k], t['--paper']), `${k} on paper`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(t[k], t['--card']), `${k} on card`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('grey data marks reach 3:1', () => {
      expect(ratio(t['--mark'], t['--paper'])).toBeGreaterThanOrEqual(3);
    });

    it('text on accent and ink shapes reaches 4.5:1', () => {
      expect(ratio(t['--on-acc'], t['--ink-box'])).toBeGreaterThanOrEqual(4.5);
    });

    it('accent: shape 3:1, accent text 4.5:1 on page and tint, text on fill 4.5:1', () => {
      const raw = { ...tokens(':root'), ...tokens(sel) };
      const fill = dark ? raw['--fill-d'] : raw['--fill-l'];
      const text = dark ? raw['--text-d'] : raw['--text-l'];
      const tint = mix(fill, t['--paper'], parseFloat(t['--tint-mix']) / 100);
      expect(ratio(fill, t['--paper']), 'shape on page').toBeGreaterThanOrEqual(3);
      expect(ratio(text, t['--paper']), 'accent text on page').toBeGreaterThanOrEqual(4.5);
      expect(ratio(text, tint), 'accent text on tint').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t['--body'], tint), 'body text on tint').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t['--on-acc'], fill), 'text on accent fill').toBeGreaterThanOrEqual(4.5);
    });
  });
}
