// One renderer per screen type. A screen is one piece of information: it must fit the screen
// without scrolling. `fitScreen` shrinks the type a little when a screen is too full; the real
// fix is to split the content into two screens.

import { append, h, rich, sceneText, type Child } from '../lib/dom.ts';
import { sanitizeSvg } from '../lib/sanitize.ts';
import { DEFAULT_CAPTION, isSvgChart, PHONE_WIDTH, renderChart } from '../charts/charts.ts';
import { sceneChart } from '../charts/scenes.ts';
import { bookMap } from '../charts/bookmap.ts';
import type { Plan, PlanScreen, SceneListScreen } from '../model/plan.ts';
import type { BookType, ScenesScreen, Screen } from '../model/types.ts';

export interface ScreenContext {
  plan: Plan;
  /** Go to a screen of the plan. */
  jump(index: number): void;
  /** Leave the book. */
  exit(): void;
}

export const GUIDE_NAMES: Record<BookType, string> = {
  fiction: 'Story guide',
  reading: 'Reading guide',
  done: 'Book summary',
};

/** Element.append() would print null as "null"; this skips empty children. */
const add = (el: HTMLElement, ...kids: (Child | Child[])[]) => append(el, kids);
const label = (text: string, tag: 'h2' | 'span' = 'h2') => h(tag, { class: 'label' }, text);
const tag = (text: string, kind = '') => h('span', { class: `tag ${kind}`.trim() }, text);

export function renderScreen(ps: PlanScreen, ctx: ScreenContext): HTMLElement {
  const c = ps.content;
  const body = h('div', { class: 'screen-body' });
  switch (c.type) {
    case 'cover': cover(body, ctx); break;
    case 'opener': opener(body, ps, ctx); break;
    case 'end': end(body, ctx); break;
    case 'scene-list': sceneList(body, c); break;
    default: renderBlock(body, c);
  }
  const ch = ps.chapter;
  const where = ch.kind === 'chapter' ? `${ch.number} ${ch.title}, screen ${ps.inChapter + 1} of ${ch.count}` : ch.title;
  return h('section', {
    class: 'screen',
    'data-type': c.type,
    'data-key': ps.key,
    'aria-roledescription': 'screen',
    'aria-label': where,
  }, body);
}

// ---- screens the plan adds --------------------------------------------------------------------

function cover(body: HTMLElement, ctx: ScreenContext) {
  const b = ctx.plan.book;
  const kicker = [GUIDE_NAMES[b.type], b.upTo ? `to ${b.upTo}` : ''].filter(Boolean).join(' · ');
  add(body, 
    h('div', { class: 'jacket' },
      h('div', { class: 'jacket-top' }, label(kicker, 'span'), b.sample ? tag('Sample', 'grey') : null),
      h('h1', { class: `cover-title${b.title.length > 28 ? ' long' : ''}` }, b.title),
      b.subtitle ? h('p', { class: 'cover-sub' }, b.subtitle) : null,
      h('p', { class: 'cover-author' }, b.author),
      b.edition ? h('p', { class: 'cover-edition' }, b.edition) : null,
      rich(b.lead, 'p', 'cover-lead'),
    ),
    bookMap(ctx.plan, { onPick: (ch) => ctx.jump(ch.first) }),
    h('p', { class: 'hint' }, 'Swipe up to begin'),
  );
}

function opener(body: HTMLElement, ps: PlanScreen, ctx: ScreenContext) {
  const ch = ps.chapter;
  const long = ch.title.length > 42;
  const rest = ch.count - 1;
  add(body, 
    h('header', { class: 'opener-head' },
      h('div', { class: 'opener-num' }, ch.number),
      label(ch.part.kicker, 'span'),
      h('h1', { class: `opener-title${long ? ' long' : ''}` }, ch.title),
    ),
    ch.sections.length > 0
      ? h('ol', { class: 'opener-sections' },
          ch.sections.map((s) =>
            h('li', null,
              h('button', { type: 'button', onclick: () => ctx.jump(s.first) },
                h('span', { class: 'os-title' }, s.title),
                h('span', { class: 'os-count' }, s.count === 1 ? '1 screen' : `${s.count} screens`),
              ),
            ),
          ),
        )
      : h('p', { class: 'opener-meta' }, rest === 1 ? '1 screen' : `${rest} screens`),
  );
}

function end(body: HTMLElement, ctx: ScreenContext) {
  const b = ctx.plan.book;
  add(body, 
    h('div', { class: 'end' },
      label(`End of the ${GUIDE_NAMES[b.type].toLowerCase()}`, 'span'),
      h('h1', { class: 'end-title' }, b.title),
      h('p', { class: 'end-text' }, b.upTo ? `This guide covers the book to ${b.upTo}.` : 'You have reached the end of the guide.'),
      h('div', { class: 'end-actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => ctx.exit() }, 'Back to the library'),
        h('button', { type: 'button', class: 'btn', onclick: () => ctx.jump(0) }, 'Back to the cover'),
      ),
    ),
  );
}

/** The scenes of a scenes block as a numbered list; the numbers match the chart's columns. */
function sceneList(body: HTMLElement, v: SceneListScreen) {
  add(body, label('What happens'), sceneItems(v.source, v.from, v.to, false));
}

export function sceneItems(src: ScenesScreen, from: number, to: number, withPeople: boolean): HTMLElement {
  return h('ol', { class: 'scene-list', start: from + 1 },
    src.scenes.slice(from, to).map((sc, k) =>
      h('li', { class: `scene${sc.key ? ' key-scene' : ''}` },
        h('span', { class: 'scene-n', 'aria-hidden': 'true' }, String(from + k + 1)),
        h('div', { class: 'scene-body' },
          sceneText(sc.text, 'p', 'scene-text'),
          withPeople
            ? h('p', { class: 'scene-people' }, [...sc.with, ...(sc.off ?? []).map((o) => `${o} (at a distance)`)].join(', '))
            : null,
        ),
      ),
    ),
  );
}

/** "Who is where": the scene chart of a scenes block. */
export function sceneFigure(src: ScenesScreen, width = PHONE_WIDTH): HTMLElement {
  return h('div', { class: 'figure svg-figure' }, sceneChart(src, width));
}

// ---- screens the author writes ----------------------------------------------------------------

export interface BlockOptions {
  /** Design width of SVG charts: 340 on a phone, 640 in the PDF. */
  width?: number;
}

/** Renders one authored screen into `body`. The print view uses it for most blocks too. */
export function renderBlock(body: HTMLElement, s: Screen, opts: BlockOptions = {}) {
  const width = opts.width ?? PHONE_WIDTH;
  switch (s.type) {
    case 'summary':
      add(body, 
        h('div', { class: 'core' },
          label(s.label, 'span'),
          rich(s.text, 'p', 'core-text'),
          s.takeaway
            ? h('div', { class: 'why' }, label(s.takeaway.label, 'span'), rich(s.takeaway.text, 'p', 'why-text'))
            : null,
        ),
      );
      break;

    case 'points':
      add(body, 
        label(s.label),
        h('div', { class: `points ${s.style === 'box' ? 'boxed' : 'barred'}` },
          s.items.map((it) =>
            h('div', { class: 'point' },
              h('div', { class: 'point-title' }, rich(it.title), it.tag ? tag(it.tag) : null),
              rich(it.text, 'p', 'point-text'),
            ),
          ),
        ),
      );
      break;

    case 'steps':
      add(body, label(s.label), h('ol', { class: 'steps' }, s.steps.map((st) => h('li', null, rich(st)))));
      break;

    case 'list':
      add(body, 
        label(s.label),
        h('ul', { class: 'rows' },
          s.rows.map((r) =>
            h('li', null,
              h('span', { class: 'row-name' }, rich(r.name)),
              rich(r.text, 'span', 'row-text'),
              r.meta ? h('span', { class: 'row-meta' }, r.meta) : null,
            ),
          ),
        ),
      );
      break;

    case 'quiz':
      add(body, 
        label(s.label),
        h('ol', { class: 'quiz' },
          s.questions.map((q, i) => {
            const answer = rich(q.a, 'p', 'quiz-a');
            answer.hidden = true;
            const button = h('button', { type: 'button', class: 'quiz-q', 'aria-expanded': 'false' },
              h('span', { class: 'quiz-n' }, `Q${i + 1}`),
              rich(q.q, 'span', 'quiz-text'),
            );
            button.addEventListener('click', () => {
              answer.hidden = !answer.hidden;
              button.setAttribute('aria-expanded', String(!answer.hidden));
            });
            return h('li', null, button, answer);
          }),
        ),
        h('p', { class: 'hint' }, 'Tap a question to see the answer'),
      );
      break;

    case 'text':
      add(body, s.label ? label(s.label) : '', h('div', { class: 'prose' }, s.paragraphs.map((p) => rich(p, 'p'))));
      break;

    case 'scenes':
      add(body,
        label(s.label ?? 'Who is where'),
        sceneFigure(s, width),
        h('p', { class: 'cap' }, 'Columns: the scenes in order. Dot: in the scene · ring: there from a distance'),
      );
      break;

    case 'chart': {
      const caption = s.caption ?? DEFAULT_CAPTION[s.chart];
      add(body,
        s.label ? label(s.label) : '',
        h('div', { class: `figure${isSvgChart(s.chart) ? ' svg-figure' : ''}` }, renderChart(s, width)),
        caption ? h('p', { class: 'cap' }, caption) : null,
      );
      break;
    }

    case 'figure': {
      const svg = sanitizeSvg(s.svg);
      if (svg) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', s.alt);
      }
      add(body, 
        s.label ? label(s.label) : '',
        h('div', { class: 'figure svg-figure' }, svg ?? h('p', { class: 'cap' }, 'This diagram could not be drawn.')),
        s.caption ? h('p', { class: 'cap' }, s.caption) : null,
      );
      break;
    }
  }
}

// ---- fit --------------------------------------------------------------------------------------

const MIN_FIT = 0.72;

/** Shrinks the type of a screen that is too full, down to 72 %. Run after the screen is in the page. */
export function fitScreen(screen: HTMLElement): void {
  const body = screen.querySelector<HTMLElement>('.screen-body');
  if (!body) return;
  body.style.setProperty('--fit', '1');
  const over = () => body.scrollHeight > body.clientHeight + 1;
  if (!over()) {
    screen.classList.remove('overfull');
    return;
  }
  // Text height grows about with the square of the type size, so start from the square root.
  let fit = Math.max(MIN_FIT, Math.floor(Math.sqrt(body.clientHeight / body.scrollHeight) * 100) / 100);
  body.style.setProperty('--fit', String(fit));
  while (over() && fit > MIN_FIT) {
    fit = Math.max(MIN_FIT, fit - 0.03);
    body.style.setProperty('--fit', String(fit));
  }
  // Still too full: mark it, so authors see it in development.
  screen.classList.toggle('overfull', over());
}
