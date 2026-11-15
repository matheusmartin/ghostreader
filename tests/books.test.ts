// `npm run validate` runs this file: every book in src/books must pass the format check.

import { describe, expect, it } from 'vitest';
import { validateBook } from '../src/model/validate.ts';
import { lintBook } from '../src/model/lint.ts';
import type { Book } from '../src/model/types.ts';

const files = import.meta.glob<unknown>('../src/books/*.json', { eager: true, import: 'default' });

describe('bundled books', () => {
  it('has at least one book', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  for (const [path, raw] of Object.entries(files)) {
    const file = path.replace(/^.*\//, '');
    it(`${file} is a valid book`, () => {
      const { errors } = validateBook(raw);
      expect(errors, errors.join('\n')).toEqual([]);
      expect((raw as { id: string }).id, 'the id must match the file name').toBe(file.replace(/\.json$/, ''));
    });
    it(`${file} follows the content rules`, () => {
      const { book } = validateBook(raw);
      const problems = book ? lintBook(book as Book) : [];
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  it('writes every guide in all four styles, one file each', () => {
    const books = Object.values(files) as Book[];
    const guides = new Map<string, string[]>();
    for (const b of books) {
      expect(b.guide, `${b.id}: every book file belongs to a guide ("guide")`).toBeTruthy();
      guides.set(b.guide!, [...(guides.get(b.guide!) ?? []), b.style ?? 'map']);
    }
    for (const [guide, styles] of guides) expect(styles.sort(), guide).toEqual(['layers', 'map', 'recall', 'recap']);
  });

  it('keeps title, author, parts and chapters the same across the styles of a guide', () => {
    const books = Object.values(files) as Book[];
    const shape = (b: Book) => JSON.stringify([b.title, b.author, b.type, b.upTo,
      b.parts.map((p) => [p.label, p.title, p.chapters.map((c) => [c.id, c.number, c.title])])]);
    for (const b of books) {
      const map = books.find((m) => m.guide === b.guide && m.style === 'map');
      expect(shape(b), b.id).toBe(shape(map!));
    }
  });
});

describe('validateBook', () => {
  it('rejects personal data: there is no highlights or notes screen', () => {
    const { errors } = validateBook({
      format: 1, id: 'x', type: 'done', title: 'X', author: 'Y', lead: 'Z',
      parts: [{ id: 'p', chapters: [{ id: 'c', number: '1', title: 'One', screens: [{ type: 'highlights', label: 'Your highlights', items: [] }] }] }],
    });
    expect(errors).toEqual(['parts[0].chapters[0].screens[0]: "type" must be one of summary, points, steps, list, quiz, text, scenes, chart, figure']);
  });

  it('reports every problem with its path', () => {
    const { book, errors } = validateBook({
      format: 1,
      id: 'x',
      type: 'novel',
      title: 'X',
      author: 'Y',
      lead: 'Z',
      parts: [
        {
          id: 'p',
          theme: 'blue',
          chapters: [
            { id: 'c', number: '1', title: 'One', screens: [{ type: 'summary', label: 'In short' }, { type: 'chart', chart: 'pie' }] },
            { id: 'c', number: '2', title: 'Two', screens: [], sections: [] },
          ],
        },
      ],
    });
    expect(book).toBeNull();
    expect(errors).toEqual([
      '"type" must be one of fiction, reading, done',
      'parts[0]: "theme" is no longer used (one colour for the whole book): remove it',
      'parts[0].chapters[0].screens[0]: missing "text"',
      'parts[0].chapters[0].screens[1]: "chart" must be one of bars, compare, flow, timeline, network, threads, cycle, matrix, branches, layers',
      'parts[0].chapters[1]: id "c" is used twice',
      'parts[0].chapters[1]: use "screens" or "sections", not both',
      'parts[0].chapters[1]: "screens" needs at least 1 item',
      'parts[0].chapters[1]: "sections" needs at least 1 item',
    ]);
  });
});

describe('style', () => {
  const base = { format: 1, id: 's', type: 'reading', title: 'T', author: 'A', lead: 'L', parts: [{ id: 'p', chapters: [{ id: 'c', number: '1', title: 'One', screens: [{ type: 'summary', label: 'In short', text: 'Text.' }] }] }] };
  it('accepts the four styles and nothing else', () => {
    for (const style of ['map', 'recap', 'recall', 'layers']) expect(validateBook({ ...base, style }).errors).toEqual([]);
    expect(validateBook({ ...base, style: 'fancy' }).errors).toEqual(['"style" must be one of map, recap, recall, layers']);
  });
});

describe('guide', () => {
  const base = { format: 1, type: 'reading', title: 'T', author: 'A', lead: 'L', parts: [{ id: 'p', chapters: [{ id: 'c', number: '1', title: 'One', screens: [{ type: 'summary', label: 'In short', text: 'Text.' }] }] }] };
  it('needs a style and the id "<guide>-<style>"', () => {
    expect(validateBook({ ...base, id: 'x-recap', guide: 'x', style: 'recap' }).errors).toEqual([]);
    expect(validateBook({ ...base, id: 'x-recap', guide: 'x' }).errors).toEqual(['a file with "guide" needs "style"']);
    expect(validateBook({ ...base, id: 'x', guide: 'x', style: 'recap' }).errors).toEqual(['"id" must be "x-recap" ("<guide>-<style>")']);
  });
});
