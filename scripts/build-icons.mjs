#!/usr/bin/env node
// Draws the app icon and writes every icon file from that one drawing (public/icons/):
//
//   icon.svg                 tab icon and the source for the rest: rounded corners, transparent outside
//   icon-192.png, -512.png   installed app ("any"): the same, as PNG
//   icon-maskable-512.png    Android: full square, picture inside the 40 % safe circle
//   apple-touch-icon.png     iPhone and iPad home screen: 180 px full square (iOS rounds the corners)
//   icon-monochrome-512.png  themed icons: one colour on transparent; only the alpha counts
//
// The picture is the book map from the cover screen: one row per part, one chip per chapter.
// Part 1 is read (teal), part 2 is being read (amber, then the current chapter in orange), part 3
// is still to come (navy). Run after a change to the drawing:
//
//   npm run build:icons

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'public/icons');

const TILE = ['#2a3a66', '#0d1324']; // gradient, top left to bottom right
const READ = ['#19c2b0', '#ffb020']; // part 1 teal, part 2 amber
const CURRENT = '#ff6a3d';
const TO_COME = '#34446e';

// Chip widths per row (part); 12 px between chips, 34 px between rows. The grid is 320 x 248,
// centred on the 512 grid, so its corners stay inside Android's safe circle (radius 205).
const ROWS = [[92, 60, 144], [132, 76, 88], [70, 110, 116]];
const CURRENT_CHIP = [1, 1];

function chipColour(r, c) {
  if (r === CURRENT_CHIP[0] && c === CURRENT_CHIP[1]) return CURRENT;
  if (r < CURRENT_CHIP[0] || (r === CURRENT_CHIP[0] && c < CURRENT_CHIP[1])) return READ[r];
  return TO_COME;
}

/** The chips. mono: one colour, with chapters to come at lower alpha. scale: around the centre. */
function chips({ mono = false, scale = 1 } = {}) {
  const t = scale === 1 ? '' : ` transform="translate(256 256) scale(${scale}) translate(-256 -256)"`;
  let s = `<g${t}>`;
  let y = 132;
  ROWS.forEach((row, r) => {
    let x = 96;
    row.forEach((w, c) => {
      const colour = chipColour(r, c);
      const fill = mono ? `#ffffff" fill-opacity="${colour === TO_COME ? 0.4 : 1}` : colour;
      s += `<rect x="${x}" y="${y}" width="${w}" height="60" rx="16" fill="${fill}"/>`;
      x += w + 12;
    });
    y += 94;
  });
  return s + '</g>';
}

const tile = (rx) =>
  `<defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${TILE[0]}"/>` +
  `<stop offset="1" stop-color="${TILE[1]}"/></linearGradient></defs>` +
  `<rect width="512" height="512"${rx ? ` rx="${rx}"` : ''} fill="url(#tile)"/>`;

const svg = (body, comment = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n${comment}  ${body}\n</svg>\n`;

const ICON = svg(tile(112) + chips(),
  '  <!-- A book map: one row per part, one chip per chapter. Made by scripts/build-icons.mjs. -->\n');
const FULL = svg(tile(0) + chips());
const MASKABLE = svg(tile(0) + chips({ scale: 0.9 }));
const MONO = svg(chips({ mono: true, scale: 0.9 }));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('build-icons: Playwright is not installed. Run `npm install`.');
  process.exit(2);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'icon.svg'), ICON);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(source, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">` +
    source.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `) + `</body></html>`,
  );
  await page.screenshot({ path: join(out, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`build-icons: ${file}  ${size} px`);
}
await png(ICON, 192, 'icon-192.png');
await png(ICON, 512, 'icon-512.png');
await png(MASKABLE, 512, 'icon-maskable-512.png');
await png(FULL, 180, 'apple-touch-icon.png');
await png(MONO, 512, 'icon-monochrome-512.png');
await browser.close();
console.log('build-icons: icon.svg');
