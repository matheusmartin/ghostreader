// The book map: one row per part, one chip per chapter, sized by the chapter's real length when
// every chapter has one. Chapters not written yet are dashed and show only their number,
// because titles can spoil. In the reader the map is also a table of contents: tap a chip.

import { h } from '../lib/dom.ts';
import type { Plan, PlanChapter } from '../model/plan.ts';

export interface BookMapOptions {
  current?: PlanChapter | null;
  onPick?: (ch: PlanChapter) => void;
}

/** "05" → "5"; "P", "B", "A1" stay. */
export const chipNumber = (n: string) => (/^\d+$/.test(n) ? String(Number(n)) : n);

export function bookMap(plan: Plan, opts: BookMapOptions = {}): HTMLElement {
  const all = plan.parts.flatMap((p) => p.chapters);
  const sized = all.length > 0 && all.every((c) => c.length !== undefined);
  // One scale for the whole book: the longest part fills the row.
  const longest = Math.max(1, ...plan.parts.map((p) => p.chapters.reduce((sum, c) => sum + (c.length ?? 0), 0)));

  return h('div', { class: 'bookmap' },
    plan.parts.map((part) =>
      h('div', { class: 'bm-row' },
        h('div', { class: 'bm-label' }, part.label ?? part.title ?? part.kicker),
        h('div', { class: 'bm-chips' },
          part.chapters.map((ch) => {
            const written = ch.count > 0;
            const cls = `bm-chip${written ? '' : ' later'}${ch === opts.current ? ' key' : ''}`;
            const label = written ? `${ch.number} ${ch.title}` : `${ch.number}, not in this guide yet`;
            const chip = written && opts.onPick
              ? h('button', { class: cls, type: 'button', 'aria-label': label, onclick: () => opts.onPick?.(ch) }, chipNumber(ch.number))
              : h('span', { class: cls, 'aria-label': label, role: 'img' }, chipNumber(ch.number));
            if (sized) chip.style.flex = `0 1 ${((ch.length ?? 0) / longest) * 100}%`;
            return chip;
          }),
        ),
      ),
    ),
  );
}
