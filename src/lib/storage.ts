// What the app keeps on the device. No personal data: no reading place, no progress, no notes.
// Kept: three settings, the page colour (lib/scheme.ts), the style chosen in the menu, and
// whether the gesture hint was shown.

const PREFIX = 'ghostreader:';

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

export function getSetting(name: string): string | null {
  try {
    return localStorage.getItem(PREFIX + name);
  } catch {
    return null;
  }
}

export function setSetting(name: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + name, value);
  } catch {
    /* private mode or storage full: the default applies next time */
  }
}

/** The prefix of the app's old name (Ghostwriter). Its settings move to PREFIX. */
const OLD_PREFIX = 'ghostwriter:';

/**
 * Moves the settings kept under the app's old name to the new name, then deletes the reading
 * places that versions before 0.2 saved for each book.
 */
export function forgetOldData(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(OLD_PREFIX)) continue;
      const name = key.slice(OLD_PREFIX.length);
      const value = localStorage.getItem(key);
      if (value !== null && localStorage.getItem(PREFIX + name) === null) localStorage.setItem(PREFIX + name, value);
      localStorage.removeItem(key);
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${PREFIX}position:`)) localStorage.removeItem(key);
    }
  } catch {
    /* no storage: nothing to delete */
  }
}
