// Where the reader stopped in each book, kept on this device only.
// Stored by chapter id and screen number, so a saved place survives most edits to a book.

export interface SavedPosition {
  chapter: string;
  n: number;
  /** 0–1, for the library's progress bar. */
  progress: number;
  /** Chapter label for the library card: "05 Decisions". */
  where: string;
  at: number;
}

const key = (bookId: string) => `ghostwriter:position:${bookId}`;

export function loadPosition(bookId: string): SavedPosition | null {
  try {
    const raw = localStorage.getItem(key(bookId));
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedPosition;
    return typeof p.chapter === 'string' && typeof p.n === 'number' ? p : null;
  } catch {
    return null;
  }
}

export function savePosition(bookId: string, p: SavedPosition): void {
  try {
    localStorage.setItem(key(bookId), JSON.stringify(p));
  } catch {
    /* private mode or storage full: reading still works, the place is not kept */
  }
}

export function getFlag(name: string): boolean {
  try {
    return localStorage.getItem(`ghostwriter:${name}`) === '1';
  } catch {
    return false;
  }
}

export function setFlag(name: string): void {
  try {
    localStorage.setItem(`ghostwriter:${name}`, '1');
  } catch {
    /* ignore */
  }
}
