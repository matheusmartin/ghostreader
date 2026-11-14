# Colour system

All colours are tokens in `src/styles/tokens.css`. `tests/colours.test.ts` reads that file and
checks every contrast rule below in every page colour, so `npm test` fails if an edit breaks one.

## Roles

Colour has a meaning. Use a colour only for its role.

| Role | Token | Used for |
|---|---|---|
| Accent | `--acc` | The one key element of a diagram, the focus bar of a data chart, numbers, the stripe, the progress strip |
| Accent text | `--acc-text`, `--acc-fg` | Labels and item titles; large numbers |
| Tint | `--tint` | Summary box, cover panel, entity boxes. The part colour mixed into the page colour |
| Ink | `--ink`, `--body` | Text; ink shapes (`--ink-box`) such as an opening question |
| Grey | `--muted`, `--mark` | Secondary text; ordinary data marks (bars, dots) |
| Faint | `--faint` | Borders of things not written yet or still to come. Never text |
| Negative | `--neg`, `--neg-line` | The negative side of a comparison |
| On accent | `--on-acc` | Text on accent and ink shapes: white on light pages, near-black on dark pages |

Rules:

- **One key element per diagram**, in the accent colour; everything else grey or ink. Colour shows
  focus, not decoration.
- **Colour is never the only cue.** Every part also has a name and a number on screen; every data
  mark has a label or a value.
- **Contrast** (WCAG 2): text 4.5:1 on the page, on cards and on tints; shapes and data marks 3:1.

## Page colours

| Scheme | Page | When |
|---|---|---|
| Paper | `#fafafa` | Default in light mode |
| Quiet | `#eeeff1` | Less glare than white |
| Warm | `#fdfcf9` | Light warm white; ochre cover colour |
| Dusk | `#16181d` | Default in dark mode |
| Night | `#000000` | Reading in bed; dimmed text |

"Auto" (the default choice) uses Paper, or Dusk when the device is in dark mode.

## Part colours

The hues of the book-infographic design system, at one lightness so no part looks heavier than
another: OKLCH L 0.53 on light pages, 0.64 on dark pages. Dark pages have their own lighter steps;
they are not the light colours inverted.

| Theme | Hue | Fill, light pages | Text, light pages | Fill, dark pages | Text, dark pages |
|---|---|---|---|---|---|
| front | slate (neutral frame) | `#3f5873` | `#2f445c` | `#6c8fb6` | `#a9bdd6` |
| p1 | terracotta | `#a54e3a` | `#76382a` | `#ca6f5a` | `#efb4a6` |
| p2 | teal | `#007e68` | `#005b4b` | `#05a388` | `#92d4c1` |
| p3 | indigo | `#685fad` | `#4a447b` | `#8780d1` | `#c0bef1` |
| p4 | olive | `#5a781e` | `#405618` | `#7a9943` | `#b8cd9b` |
| p5 | plum | `#9f4b72` | `#713652` | `#c36c93` | `#eab1c9` |

On Warm, front is ochre: fill `#95661a`, text `#7d5512`.

Checked with the data-viz skill's validator (p1–p5 in this order): lightness band, chroma floor
and 3:1 against the page pass in both modes. Colour-blind separation of neighbours: worst pair
p1–p2 (terracotta–teal), ΔE 7.5 under deuteranopia. That is in the 6–8 band, which is legal only
with a second cue; the part name and number are that cue. No order of these five hues reaches 8.
Front is a low-chroma neutral by design and is not part of the categorical set.

## Charts with several series (not used yet)

For future charts that show several things at once (story threads, factions):

- **Identity** (which thread): the part fills p1–p5 in this order, at most five series. Fold the
  rest into "Other". Always label series directly. In scatter-like charts, where any two marks can
  touch, use at most three.
- **Magnitude** (how much): one hue, light to dark: the part's tint, fill, then text step.
- **Polarity** (for and against): two poles, terracotta (p1) and slate (front), with grey in the
  middle.
