// Hash routes, so the app works from any folder and offline:
//   #/                          library
//   #/read/<book>               a book, at its cover
//   #/read/<book>/<chapter>/<n> a book, at screen n of a chapter (n starts at 1)
//   #/print/<book>              the book on A4 pages: the PDF
//   #/check/<book>              every screen of a book, fitted at this window's size (scripts/check-screens.mjs)

export type Route =
  | { name: 'library' }
  | { name: 'read'; bookId: string; chapterId?: string; n?: number }
  | { name: 'print'; bookId: string }
  | { name: 'check'; bookId: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'read' && parts[1]) {
    const n = parts[3] !== undefined ? Number.parseInt(parts[3], 10) : NaN;
    return {
      name: 'read',
      bookId: parts[1],
      chapterId: parts[2],
      n: Number.isFinite(n) && n >= 1 ? n - 1 : undefined,
    };
  }
  if ((parts[0] === 'print' || parts[0] === 'check') && parts[1]) return { name: parts[0], bookId: parts[1] };
  return { name: 'library' };
}

export const printHash = (bookId: string) => `#/print/${encodeURIComponent(bookId)}`;

export function readHash(bookId: string, chapterId?: string, n?: number): string {
  const base = `#/read/${encodeURIComponent(bookId)}`;
  if (chapterId === undefined) return base;
  return `${base}/${encodeURIComponent(chapterId)}/${(n ?? 0) + 1}`;
}
