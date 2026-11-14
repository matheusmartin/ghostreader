// The library: every src/books/<id>.json file is a book. Drop a file in that folder and it
// appears in the library after the next build. Each file loads only when needed.

import { validateBook } from '../model/validate.ts';
import type { Book } from '../model/types.ts';

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
