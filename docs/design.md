# Colour system

All colours are tokens in `src/styles/tokens.css`. `tests/colours.test.ts` reads that file and
checks every contrast rule below in every theme, so `npm test` fails if an edit breaks one.

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

## Themes

The menu shows every theme in one grid: Auto, then the light themes and the dark themes, each A to
Z. Paper, Quiet, Warm, Dusk and Night are Ghostreader's own. The others are every theme built into
Atom (its syntax themes), Sublime Text (Color Scheme - Default, and Color Scheme - Legacy, which
Sublime Text hides until `show_legacy_color_schemes` is on) and Zed (`assets/themes`), with the
editors' names. Rosé Pine and Rosé Pine Dawn were built into earlier Zed versions; Zed now has
them, and Solarized, in its Zed Legacy Themes extension. Each theme has its own page and accent.

| Theme | From | Page | Accent | When |
|---|---|---|---|---|
| Atom Light | Atom | `#ffffff` | `#008080` | |
| Ayu Light | Zed | `#fcfcfc` | `#b35b12` | |
| Base16 Tomorrow Light | Atom | `#ffffff` | `#886b91` | |
| Breakers | Sublime Text | `#fcfdfd` | `#3b77b2` | |
| Celeste | Sublime Text | `#ffffff` | `#b75c08` | |
| Dawn | Sublime Text | `#f9f9f9` | `#794938` | |
| Eiffel | Sublime Text | `#ffffff` | `#0100b6` | |
| Gruvbox Light | Zed | `#fbf1c7` | `#af3a03` | |
| Gruvbox Light Hard | Zed | `#f9f5d7` | `#af3a03` | |
| Gruvbox Light Soft | Zed | `#f2e5bc` | `#af3a03` | |
| IDLE | Sublime Text | `#ffffff` | `#d14502` | |
| iPlastic | Sublime Text | `#eeeeee` | `#027c28` | |
| LAZY | Sublime Text | `#ffffff` | `#3b5bb5` | |
| Mac Classic | Sublime Text | `#ffffff` | `#0000ff` | |
| MagicWB (Amiga) | Sublime Text | `#969696` | `#0004ef` | |
| One Light | Atom, Zed | `#fafafa` | `#2c6cf2` | |
| Paper | Ghostreader | `#fafafa` | `#a54e3a` | Default in light mode |
| Quiet | Ghostreader | `#eeeff1` | `#a54e3a` | Less glare than white |
| Rosé Pine Dawn | Zed Legacy Themes extension | `#faf4ed` | `#286983` | |
| Sixteen | Sublime Text | `#ffffff` | `#067bbb` | |
| Slush & Poppies | Sublime Text | `#f1f1f1` | `#c03030` | |
| Solarized Light | Atom, Sublime Text | `#fdf6e3` | `#2079ba` | |
| Warm | Ghostreader | `#fdfcf9` | `#95661a` | Light warm white; ochre accent |
| All Hallow's Eve | Sublime Text | `#000000` | `#cc7833` | |
| Amy | Sublime Text | `#200020` | `#a080ff` | |
| Atom Dark | Atom | `#1d1f21` | `#96cbfe` | |
| Ayu Dark | Zed | `#0d1016` | `#ffb353` | |
| Ayu Mirage | Zed | `#1f2430` | `#ffcc66` | |
| Base16 Tomorrow Dark | Atom | `#1d1f21` | `#b294bb` | |
| Blackboard | Sublime Text | `#0c1021` | `#fbde2d` | |
| Cobalt | Sublime Text | `#002240` | `#ff9d00` | |
| Dusk | Ghostreader | `#16181d` | `#ca6f5a` | Default in dark mode |
| Espresso Libre | Sublime Text | `#2a211c` | `#ff9358` | |
| Gruvbox Dark | Zed | `#282828` | `#fe8019` | |
| Gruvbox Dark Hard | Zed | `#1d2021` | `#fe8019` | |
| Gruvbox Dark Soft | Zed | `#32302f` | `#fe8019` | |
| Mariana | Sublime Text | `#303841` | `#f9ae58` | |
| Monokai | Sublime Text | `#272822` | `#a6e22e` | |
| Monokai Bright | Sublime Text | `#272822` | `#f92672` | |
| Night | Ghostreader | `#000000` | `#ca6f5a` | Reading in bed; dimmed text |
| One Dark | Atom, Zed | `#282c34` | `#61afef` | |
| Pastels on Dark | Sublime Text | `#211e1e` | `#a1a1ff` | |
| Rosé Pine | Zed Legacy Themes extension | `#191724` | `#c4a7e7` | |
| Solarized Dark | Atom, Sublime Text | `#002b36` | `#3294da` | |
| SpaceCadet | Sublime Text | `#0d0d0d` | `#a8885a` | |
| Sunburst | Sublime Text | `#000000` | `#e28964` | |
| Twilight | Sublime Text | `#141414` | `#cda869` | |
| Zenburnesque | Sublime Text | `#404040` | `#f09040` | |

In the editors' themes, page, text and accent are the editors' colours, moved only where a contrast rule needs it;
`tokens.css` notes each change (for example One Light's blue `#4078f2` → `#2c6cf2`, so white text
on it reaches 4.5:1). The greys and lines are mixed from the editor's text and page colours. Each
still has one accent for the whole book: a colour the editor uses for keywords, functions or its
interface accent.

"Auto" (the default choice) uses Paper, or Dusk when the device is in dark mode.

## Accent

One accent for the whole book. Every part and every chapter uses the same colours: a reader moves
from chapter to chapter without a change of colour. The only sign of a new chapter is the small
break between segments in the progress strip at the top.

| Theme | Fill, light pages | Text, light pages | Fill, dark pages | Text, dark pages |
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
The PDF always prints on Paper, on white, whatever theme the reader chose.
