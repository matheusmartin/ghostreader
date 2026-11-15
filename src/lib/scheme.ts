// Theme (called "scheme" in the code). The choice is kept on this device. "Auto" follows the device:
// Paper in light mode, Dusk in dark mode. index.html applies the saved choice before the
// first paint, with the same rules, so the page never flashes the wrong colour.

/** The themes (styles/tokens.css): Auto, then the light themes and the dark themes, each A to Z.
 * Paper, Quiet, Warm, Dusk and Night are Ghostreader's; the others are every theme built into
 * Atom, Sublime Text and Zed, with the editors' names. */
export const SCHEMES = [
  { id: 'auto', name: 'Auto' },
  { id: 'atom-light', name: 'Atom Light' },
  { id: 'ayu-light', name: 'Ayu Light' },
  { id: 'base16-tomorrow-light', name: 'Base16 Tomorrow Light' },
  { id: 'breakers', name: 'Breakers' },
  { id: 'celeste', name: 'Celeste' },
  { id: 'dawn', name: 'Dawn' },
  { id: 'eiffel', name: 'Eiffel' },
  { id: 'gruvbox-light', name: 'Gruvbox Light' },
  { id: 'gruvbox-light-hard', name: 'Gruvbox Light Hard' },
  { id: 'gruvbox-light-soft', name: 'Gruvbox Light Soft' },
  { id: 'idle', name: 'IDLE' },
  { id: 'iplastic', name: 'iPlastic' },
  { id: 'lazy', name: 'LAZY' },
  { id: 'mac-classic', name: 'Mac Classic' },
  { id: 'magicwb-amiga', name: 'MagicWB (Amiga)' },
  { id: 'one-light', name: 'One Light' },
  { id: 'paper', name: 'Paper' },
  { id: 'quiet', name: 'Quiet' },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn' },
  { id: 'sixteen', name: 'Sixteen' },
  { id: 'slush-and-poppies', name: 'Slush & Poppies' },
  { id: 'solarized-light', name: 'Solarized Light' },
  { id: 'warm', name: 'Warm' },
  { id: 'all-hallows-eve', name: "All Hallow's Eve" },
  { id: 'amy', name: 'Amy' },
  { id: 'atom-dark', name: 'Atom Dark' },
  { id: 'ayu-dark', name: 'Ayu Dark' },
  { id: 'ayu-mirage', name: 'Ayu Mirage' },
  { id: 'base16-tomorrow-dark', name: 'Base16 Tomorrow Dark' },
  { id: 'blackboard', name: 'Blackboard' },
  { id: 'cobalt', name: 'Cobalt' },
  { id: 'dusk', name: 'Dusk' },
  { id: 'espresso-libre', name: 'Espresso Libre' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark' },
  { id: 'gruvbox-dark-hard', name: 'Gruvbox Dark Hard' },
  { id: 'gruvbox-dark-soft', name: 'Gruvbox Dark Soft' },
  { id: 'mariana', name: 'Mariana' },
  { id: 'monokai', name: 'Monokai' },
  { id: 'monokai-bright', name: 'Monokai Bright' },
  { id: 'night', name: 'Night' },
  { id: 'one-dark', name: 'One Dark' },
  { id: 'pastels-on-dark', name: 'Pastels on Dark' },
  { id: 'rose-pine', name: 'Rosé Pine' },
  { id: 'solarized-dark', name: 'Solarized Dark' },
  { id: 'spacecadet', name: 'SpaceCadet' },
  { id: 'sunburst', name: 'Sunburst' },
  { id: 'twilight', name: 'Twilight' },
  { id: 'zenburnesque', name: 'Zenburnesque' },
] as const satisfies readonly { id: string; name: string }[];

export type SchemeChoice = (typeof SCHEMES)[number]['id'];
export type Scheme = Exclude<SchemeChoice, 'auto'>;

const KEY = 'ghostreader:scheme';
const IDS: readonly string[] = SCHEMES.map((s) => s.id);
const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

export function resolveScheme(choice: SchemeChoice, deviceDark: boolean): Scheme {
  if (choice === 'auto') return deviceDark ? 'dusk' : 'paper';
  return choice;
}

export function getSchemeChoice(): SchemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v && IDS.includes(v) ? (v as SchemeChoice) : 'auto';
  } catch {
    return 'auto';
  }
}

export function setSchemeChoice(choice: SchemeChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* not kept, but still applied for this visit */
  }
  current = choice;
  applyScheme();
}

let current: SchemeChoice = 'auto';

export function applyScheme(): void {
  const root = document.documentElement;
  root.dataset.scheme = resolveScheme(current, darkQuery().matches);
  // Browser and system bars take the theme's page colour.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}

/** Applies the saved choice and follows the device's light or dark mode for "Auto". */
export function startScheme(): void {
  current = getSchemeChoice();
  applyScheme();
  darkQuery().addEventListener('change', applyScheme);
}
