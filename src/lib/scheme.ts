// Page colour (scheme). The choice is kept on this device. "Auto" follows the device:
// Paper in light mode, Dusk in dark mode. index.html applies the saved choice before the
// first paint, with the same rules, so the page never flashes the wrong colour.

/** Ghostreader's own page colours, then the code editors' themes (styles/tokens.css): every theme
 * built into Atom, Sublime Text and Zed, with the editors' names, in light and dark groups. */
export type SchemeGroup = 'ghostreader' | 'light' | 'dark';

export const SCHEMES = [
  { id: 'auto', name: 'Auto', group: 'ghostreader' },
  { id: 'paper', name: 'Paper', group: 'ghostreader' },
  { id: 'quiet', name: 'Quiet', group: 'ghostreader' },
  { id: 'warm', name: 'Warm', group: 'ghostreader' },
  { id: 'dusk', name: 'Dusk', group: 'ghostreader' },
  { id: 'night', name: 'Night', group: 'ghostreader' },
  { id: 'atom-light', name: 'Atom Light', group: 'light' },
  { id: 'ayu-light', name: 'Ayu Light', group: 'light' },
  { id: 'base16-tomorrow-light', name: 'Base16 Tomorrow Light', group: 'light' },
  { id: 'breakers', name: 'Breakers', group: 'light' },
  { id: 'celeste', name: 'Celeste', group: 'light' },
  { id: 'dawn', name: 'Dawn', group: 'light' },
  { id: 'eiffel', name: 'Eiffel', group: 'light' },
  { id: 'gruvbox-light', name: 'Gruvbox Light', group: 'light' },
  { id: 'gruvbox-light-hard', name: 'Gruvbox Light Hard', group: 'light' },
  { id: 'gruvbox-light-soft', name: 'Gruvbox Light Soft', group: 'light' },
  { id: 'idle', name: 'IDLE', group: 'light' },
  { id: 'iplastic', name: 'iPlastic', group: 'light' },
  { id: 'lazy', name: 'LAZY', group: 'light' },
  { id: 'mac-classic', name: 'Mac Classic', group: 'light' },
  { id: 'magicwb-amiga', name: 'MagicWB (Amiga)', group: 'light' },
  { id: 'one-light', name: 'One Light', group: 'light' },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', group: 'light' },
  { id: 'sixteen', name: 'Sixteen', group: 'light' },
  { id: 'slush-and-poppies', name: 'Slush & Poppies', group: 'light' },
  { id: 'solarized-light', name: 'Solarized Light', group: 'light' },
  { id: 'all-hallows-eve', name: "All Hallow's Eve", group: 'dark' },
  { id: 'amy', name: 'Amy', group: 'dark' },
  { id: 'atom-dark', name: 'Atom Dark', group: 'dark' },
  { id: 'ayu-dark', name: 'Ayu Dark', group: 'dark' },
  { id: 'ayu-mirage', name: 'Ayu Mirage', group: 'dark' },
  { id: 'base16-tomorrow-dark', name: 'Base16 Tomorrow Dark', group: 'dark' },
  { id: 'blackboard', name: 'Blackboard', group: 'dark' },
  { id: 'cobalt', name: 'Cobalt', group: 'dark' },
  { id: 'espresso-libre', name: 'Espresso Libre', group: 'dark' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', group: 'dark' },
  { id: 'gruvbox-dark-hard', name: 'Gruvbox Dark Hard', group: 'dark' },
  { id: 'gruvbox-dark-soft', name: 'Gruvbox Dark Soft', group: 'dark' },
  { id: 'mariana', name: 'Mariana', group: 'dark' },
  { id: 'monokai', name: 'Monokai', group: 'dark' },
  { id: 'monokai-bright', name: 'Monokai Bright', group: 'dark' },
  { id: 'one-dark', name: 'One Dark', group: 'dark' },
  { id: 'pastels-on-dark', name: 'Pastels on Dark', group: 'dark' },
  { id: 'rose-pine', name: 'Rosé Pine', group: 'dark' },
  { id: 'solarized-dark', name: 'Solarized Dark', group: 'dark' },
  { id: 'spacecadet', name: 'SpaceCadet', group: 'dark' },
  { id: 'sunburst', name: 'Sunburst', group: 'dark' },
  { id: 'twilight', name: 'Twilight', group: 'dark' },
  { id: 'zenburnesque', name: 'Zenburnesque', group: 'dark' },
] as const satisfies readonly { id: string; name: string; group: SchemeGroup }[];

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
  // Browser and system bars take the page colour.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}

/** Applies the saved choice and follows the device's light or dark mode for "Auto". */
export function startScheme(): void {
  current = getSchemeChoice();
  applyScheme();
  darkQuery().addEventListener('change', applyScheme);
}
