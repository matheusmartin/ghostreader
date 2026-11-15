# Colour system

All colours are tokens in `src/styles/tokens.css`. `tests/colours.test.ts` reads that file and
checks every contrast rule below in every page colour, so `npm test` fails if an edit breaks one.

## Roles

Colour has a meaning. Use a colour only for its role.

| Role | Token | Used for |
|---|---|---|
| Accent | `--acc` | The one key element of a diagram, the focus bar of a data chart, numbers, the progress strip |
| Accent text | `--acc-text`, `--acc-fg` | Labels and item titles; large numbers |
| Tint | `--tint` | Summary box, cover panel, entity boxes. The accent mixed into the page colour |
| Ink | `--ink`, `--body` | Text; ink shapes (`--ink-box`) such as an opening question |
| Grey | `--muted`, `--mark` | Secondary text; ordinary data marks (bars, dots) |
| Faint | `--faint` | Borders of things not written yet or still to come. Never text |
| Negative | `--neg`, `--neg-line` | The negative side of a comparison |
| On accent | `--on-acc` | Text on accent and ink shapes: white on light pages, near-black on dark pages |

Rules:

- **One key element per diagram**, in the accent colour; everything else grey or ink. Colour shows
  focus, not decoration.
- **Colour is never the only cue.** Every data mark has a label or a value.
- **Contrast** (WCAG 2): text 4.5:1 on the page, on cards and on tints; shapes and data marks 3:1.

## Page colours

| Scheme | Page | When |
|---|---|---|
| Paper | `#fafafa` | Default in light mode |
| Quiet | `#eeeff1` | Less glare than white |
| Warm | `#fdfcf9` | Light warm white; ochre accent |
| Dusk | `#16181d` | Default in dark mode |
| Night | `#000000` | Reading in bed; dimmed text |

"Auto" (the default choice) uses Paper, or Dusk when the device is in dark mode.

## Accent

One accent for the whole book. Every part and every chapter uses the same colours: a reader moves
from chapter to chapter without a change of colour. The only sign of a new chapter is the small
break between segments in the progress strip at the top.

| Page colour | Fill, light pages | Text, light pages | Fill, dark pages | Text, dark pages |
|---|---|---|---|---|
| Paper, Quiet, Dusk, Night | `#a54e3a` (terracotta) | `#76382a` | `#ca6f5a` | `#efb4a6` |
| Warm | `#95661a` (ochre) | `#7d5512` | – | – |

The terracotta of the original book-infographic print design, at OKLCH L 0.53 on light pages and
0.64 on dark pages. Dark pages have their own lighter steps; they are not the light colours inverted.
A book file has no colour field: `npm run validate` reports a `theme` left in an old file.

## Charts with several series (not used yet)

For future charts that show several things at once, use one hue: the accent for the one series in
focus, grey for the others, and labels on every series. Magnitude: one hue, light to dark (tint,
fill, text step).

## Charts and the PDF

Charts follow the same roles: the one key element (the centre of a cast map, the turning-point
scene, the conclusion) in the accent colour, everything else in ink and grey, names on tint pills.
Data charts (bars, story threads) have no key element; their caption says what the marks mean.
The PDF always prints on Paper, on white, whatever page colour the reader chose.
