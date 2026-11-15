// Page colour (scheme). The choice is kept on this device. "Auto" follows the device:
// Paper in light mode, Dusk in dark mode. index.html applies the saved choice before the
// first paint, with the same rules, so the page never flashes the wrong colour.

export type Scheme =
  | 'paper' | 'quiet' | 'warm' | 'dusk' | 'night'
  // From code editors (styles/tokens.css): Atom, Zed and Sublime Text themes.
  | 'one-light' | 'solarized-light' | 'gruvbox-light' | 'rose-pine-dawn' | 'one-dark' | 'mariana' | 'monokai' | 'solarized-dark' | 'gruvbox-dark' | 'ayu-mirage' | 'rose-pine';
export type SchemeChoice = 'auto' | Scheme;

export const SCHEMES: { id: SchemeChoice; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'paper', name: 'Paper' },
  { id: 'quiet', name: 'Quiet' },
  { id: 'warm', name: 'Warm' },
  { id: 'dusk', name: 'Dusk' },
  { id: 'night', name: 'Night' },
  { id: 'one-light', name: 'One Light' },
  { id: 'solarized-light', name: 'Solarized Light' },
  { id: 'gruvbox-light', name: 'Gruvbox Light' },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn' },
  { id: 'one-dark', name: 'One Dark' },
  { id: 'mariana', name: 'Mariana' },
  { id: 'monokai', name: 'Monokai' },
  { id: 'solarized-dark', name: 'Solarized Dark' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark' },
  { id: 'ayu-mirage', name: 'Ayu Mirage' },
  { id: 'rose-pine', name: 'Rosé Pine' },
];

const KEY = 'ghostreader:scheme';
const IDS = SCHEMES.map((s) => s.id);
const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

export function resolveScheme(choice: SchemeChoice, deviceDark: boolean): Scheme {
  if (choice === 'auto') return deviceDark ? 'dusk' : 'paper';
  return choice;
}

export function getSchemeChoice(): SchemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v && (IDS as string[]).includes(v) ? (v as SchemeChoice) : 'auto';
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
