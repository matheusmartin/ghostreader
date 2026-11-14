// What the app keeps on the device. No personal data: no reading place, no progress, no notes.
// Kept: two settings, the page colour (lib/scheme.ts) and whether the gesture hint was shown.

const PREFIX = 'ghostwriter:';

export function getFlag(name: string): boolean {
  try {
    return localStorage.getItem(PREFIX + name) === '1';
  } catch {
    return false;
  }
}

export function setFlag(name: string): void {
  try {
    localStorage.setItem(PREFIX + name, '1');
  } catch {
    /* private mode or storage full: the hint shows again next time */
  }
}

/** Deletes the reading places that versions before 0.2 saved for each book. */
export function forgetOldData(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${PREFIX}position:`)) localStorage.removeItem(key);
    }
  } catch {
    /* no storage: nothing to delete */
  }
}
