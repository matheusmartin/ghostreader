#!/usr/bin/env node
// Checks that every screen of a book fits a phone: opens #/check/<book> on a Vite dev server at
// three window sizes and prints one FIX line per problem.
//
//   node scripts/check-screens.mjs                   every book in src/books
//   node scripts/check-screens.mjs nexus-summary
//
// FIX  too full          the screen still overflows after its type was made 28 % smaller: split it
// FIX  chart too small   an SVG chart had to shrink below 80 %: fewer rows or nodes, or split it
// FIX  chart overlap     the chart layout could not keep labels or nodes apart
// FIX  clipped text      text in an HTML chart part is wider than its box (cut off or spilling out)
// NOTE smaller type      the type was made smaller to fit (fine, but the screen is full)
//
// Exit codes: 0 = no FIX lines, 1 = FIX lines, 2 = setup error.

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const SIZES = [
  { name: 'small phone 360×640', width: 360, height: 640 },
  { name: 'phone 390×844', width: 390, height: 844 },
  { name: 'tablet 820×1180', width: 820, height: 1180 },
];

const root = resolve(import.meta.dirname, '..');
const all = readdirSync(join(root, 'src/books')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('check-screens: Playwright is not installed. Run `npm install`.');
  process.exit(2);
}

const server = await createServer({ root, logLevel: 'silent', server: { port: 5317, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls?.local[0];
const browser = await chromium.launch();
let fixes = 0;

for (const id of ids) {
  const problems = new Map();
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}#/check/${encodeURIComponent(id)}`);
    try {
      await page.waitForFunction(() => document.documentElement.dataset.checkReady === '1', null, { timeout: 30_000 });
    } catch {
      console.log(`FIX ${id}: the book did not open${errors.length ? ` (${errors[0]})` : ''}. Run npm run validate.`);
      fixes++;
      await page.close();
      continue;
    }
    const results = await page.evaluate(() => window.__check ?? []);
    for (const r of results) {
      const add = (level, msg) => {
        const k = `${level}|${r.where}|${msg}`;
        const entry = problems.get(k) ?? { level, where: r.where, type: r.type, msg, sizes: [] };
        entry.sizes.push(size.name.split(' ')[0] === 'small' ? '360' : String(size.width));
        problems.set(k, entry);
      };
      if (r.overfull) add('FIX', 'too full: split it into two screens or shorten the text');
      if (r.chartScale < 0.8) add('FIX', `chart too small (drawn at ${Math.round(r.chartScale * 100)}%): fewer rows or nodes, or split it`);
      if (r.overlap > 0) add('FIX', 'chart overlap: reorder the nodes (linked nodes next to each other), shorten labels, or use fewer links');
      for (const text of r.clipped ?? []) add('FIX', `clipped chart text ${text}: use shorter words, or fewer columns`);
      if (!r.overfull && r.fit < 0.86) add('NOTE', `smaller type (${Math.round(r.fit * 100)}%)`);
    }
    await page.close();
  }
  const list = [...problems.values()];
  const fixList = list.filter((p) => p.level === 'FIX');
  fixes += fixList.length;
  console.log(`${id}: ${fixList.length ? `${fixList.length} to fix` : 'every screen fits'}`);
  for (const p of list) console.log(`  ${p.level} ${p.where} [${p.type}] ${p.msg} — at ${p.sizes.join(', ')} px wide`);
}

await browser.close();
await server.close();
process.exit(fixes ? 1 : 0);
