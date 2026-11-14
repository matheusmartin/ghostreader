#!/usr/bin/env node
// Builds one A4 PDF per book: dist/pdf/<book>.pdf. Run after `vite build` (npm run build does).
// It serves dist/, opens #/print/<book> in Chromium (Playwright) and saves each page as a PDF.
//
//   node scripts/build-pdfs.mjs            every book in src/books
//   node scripts/build-pdfs.mjs nexus-summary pride-and-prejudice-story
//   SKIP_PDF=1 npm run build               build the app without PDFs (no Chromium needed)
//
// Exit codes: 0 = done, 1 = a book failed, 2 = setup error (no dist/, no Chromium).

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { preview } from 'vite';

if (process.env.SKIP_PDF) {
  console.log('build-pdfs: SKIP_PDF is set, no PDFs built');
  process.exit(0);
}

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('build-pdfs: dist/ is missing. Run `vite build` first.');
  process.exit(2);
}

const all = readdirSync(join(root, 'src/books')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('build-pdfs: Playwright is not installed. Run `npm install`, or set SKIP_PDF=1.');
  process.exit(2);
}

const server = await preview({ root, logLevel: 'silent', preview: { port: 4317, strictPort: false, host: '127.0.0.1', open: false } });
const base = server.resolvedUrls?.local[0];
let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error(`build-pdfs: cannot start Chromium (${e.message.split('\n')[0]}). Run \`npx playwright install chromium\`, or set SKIP_PDF=1.`);
  await server.close();
  process.exit(2);
}

mkdirSync(join(dist, 'pdf'), { recursive: true });
let failed = 0;
for (const id of ids) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${base}#/print/${encodeURIComponent(id)}`);
    await page.waitForFunction(() => document.documentElement.dataset.printReady === '1', null, { timeout: 30_000 });
    if (errors.length) throw new Error(errors.join('; '));
    const title = await page.$eval('.pg-cover .cover-title', (el) => el.textContent ?? '');
    const out = join(dist, 'pdf', `${id}.pdf`);
    await page.pdf({
      path: out,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      outline: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 15mm;font:7pt Helvetica,Arial,sans-serif;color:#8a8c91;display:flex;justify-content:space-between">
        <span>${escape(title)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    const pages = await countPages(out);
    console.log(`build-pdfs: ${id}.pdf  ${pages} pages  ${(statSync(out).size / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed++;
    console.error(`build-pdfs: ${id} failed: ${e.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);

function escape(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

async function countPages(file) {
  const { readFile } = await import('node:fs/promises');
  const text = (await readFile(file)).toString('latin1');
  return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
