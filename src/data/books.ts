// The library: every src/books/<id>.json file is a book. Drop a file in that folder and it
// appears in the library after the next build. Each file loads only when needed.
// A story or reading guide comes in four styles, one file each ("<guide>-<style>"); the library
// groups them. A book summary is one file, with no styles.

import { validateBook } from '../model/validate.ts';
import { STYLES, type Book, type Style } from '../model/types.ts';

const files = import.meta.glob<unknown>('../books/*.json', { import: 'default' });

const idOf = (path: string) => path.replace(/^.*\/|\.json$/g, '');
const loaders = new Map(Object.entries(files).map(([path, load]) => [idOf(path), load]));

export type LoadedBook = { id: string; book: Book; errors: [] } | { id: string; book: null; errors: string[] };

const cache = new Map<string, Promise<LoadedBook>>();

export function bookIds(): string[] {
  return [...loaders.keys()].sort();
}

export function loadBook(id: string): Promise<LoadedBook | null> {
  const load = loaders.get(id);
  if (!load) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    p = load().then((raw): LoadedBook => {
      const { book, errors } = validateBook(raw);
      if (book && book.id !== id) return { id, book: null, errors: [`"id" is "${book.id}" but the file is ${id}.json`] };
      if (!book) {
        console.warn(`Book ${id}.json has errors:\n${errors.join('\n')}`);
        return { id, book: null, errors };
      }
      return { id, book, errors: [] };
    });
    cache.set(id, p);
  }
  return p;
}

export async function loadAllBooks(): Promise<LoadedBook[]> {
  const all = await Promise.all(bookIds().map(loadBook));
  return all.filter((b): b is LoadedBook => b !== null);
}

/** One tile of the library: a guide and its files by style, or one file without a guide. */
export interface GuideEntry {
  id: string;
  styles: Partial<Record<Style, Book>>;
  /** A file that did not validate: shown as its own broken tile. */
  broken?: LoadedBook;
}

export function groupGuides(books: LoadedBook[]): GuideEntry[] {
  const entries = new Map<string, GuideEntry>();
  for (const b of books) {
    if (!b.book) {
      entries.set(b.id, { id: b.id, styles: {}, broken: b });
      continue;
    }
    const key = b.book.guide ?? b.book.id;
    const entry = entries.get(key) ?? { id: key, styles: {} };
    entry.styles[b.book.style ?? 'map'] = b.book;
    entries.set(key, entry);
  }
  return [...entries.values()];
}

/** The file of the same guide in another style, if there is one. */
export function siblingId(book: Book, style: Style): string | null {
  if (!book.guide) return null;
  const id = `${book.guide}-${style}`;
  return loaders.has(id) ? id : null;
}

/** The styles a book's guide has, in the standard order. */
export function guideStyles(book: Book): Style[] {
  return book.guide ? STYLES.filter((s) => loaders.has(`${book.guide}-${s}`)) : [];
}

/**
 * The file to open for an id in a link. A guide with styles: a link that names the guide itself
 * opens its Map file. A book summary, which has no styles: a link to one of its old style files
 * ("nexus-summary-recap") opens the book.
 */
export function resolveBookId(id: string): string | null {
  if (loaders.has(id)) return id;
  if (loaders.has(`${id}-map`)) return `${id}-map`;
  const m = id.match(new RegExp(`^(.+)-(${STYLES.join('|')})$`));
  return m && loaders.has(m[1]) ? m[1] : null;
}
