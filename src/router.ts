// Hash routes, so the app works from any folder and offline:
//   #/                          library
//   #/read/<book>               a book, at the saved place
//   #/read/<book>/<chapter>/<n> a book, at screen n of a chapter (n starts at 1)

export type Route =
  | { name: 'library' }
  | { name: 'read'; bookId: string; chapterId?: string; n?: number };

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
  return { name: 'library' };
}

export function readHash(bookId: string, chapterId?: string, n?: number): string {
  const base = `#/read/${encodeURIComponent(bookId)}`;
  if (chapterId === undefined) return base;
  return `${base}/${encodeURIComponent(chapterId)}/${(n ?? 0) + 1}`;
}
