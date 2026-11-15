// The PDF: the whole book on A4 pages, built from the same book file as the app.
//
//   cover       title, author, lead, book map and contents
//   chapters    one page (or more) per chapter: every block for the PDF, including the ones
//               marked only: "pdf" (detail the phone screens leave out), in a wider layout
//   answers     the answers of every "Test yourself", by chapter
//
// scripts/build-pdfs.mjs opens #/print/<book> in Chromium and saves it as dist/pdf/<book>.pdf.
// In a browser, the toolbar's button opens the print dialog ("Save as PDF").

import { h, rich } from '../lib/dom.ts';
import { bookMap } from '../charts/bookmap.ts';
import { PRINT_WIDTH, renderChart, DEFAULT_CAPTION } from '../charts/charts.ts';
import { buildPlan, chapterBlocks, hasBlocks, threadList, type Plan, type PlanPart } from '../model/plan.ts';
import { guideLabel, renderBlock, sceneFigure, sceneItems } from '../screens/render.ts';
import type { Book, Chapter, QuizScreen, Screen } from '../model/types.ts';

interface Answers { chapter: string; quizzes: QuizScreen[] }

export function renderPrint(root: HTMLElement, book: Book, opts: { back(): void }): { destroy(): void } {
  const plan = buildPlan(book);
  const chapters = new Map<string, Chapter>();
  for (const part of book.parts) for (const ch of part.chapters) chapters.set(ch.id, ch);

  const answers: Answers[] = [];
  const pages: HTMLElement[] = [cover(book, printPlan(plan, chapters))];
  for (const part of plan.parts) {
    for (const pc of part.chapters) {
      const ch = chapters.get(pc.id);
      if (!ch || !hasBlocks(ch, 'pdf')) continue;
      pages.push(chapterPage(ch, part, answers));
    }
  }
  if (answers.length > 0) pages.push(answersPage(answers));

  const toolbar = h('div', { class: 'print-toolbar' },
    h('button', { type: 'button', class: 'btn', onclick: () => opts.back() }, 'Back'),
    h('span', { class: 'print-note' }, `${guideLabel(book)} · A4`),
    h('button', { type: 'button', class: 'btn primary', onclick: () => print() }, 'Print or save as PDF'),
  );
  const doc = h('div', { class: 'print' }, pages);
  const el = h('div', { class: 'print-view' }, toolbar, doc);

  // Print on Paper, whatever page colour the reader chose.
  const html = document.documentElement;
  const scheme = html.getAttribute('data-scheme');
  html.setAttribute('data-scheme', 'paper');
  html.classList.add('printing');
  root.append(el);
  void document.fonts.ready.then(() => requestAnimationFrame(() => { html.dataset.printReady = '1'; }));

  return {
    destroy() {
      el.remove();
      html.classList.remove('printing');
      delete html.dataset.printReady;
      if (scheme) html.setAttribute('data-scheme', scheme);
    },
  };
}

/** The plan with "written" meaning "has content in the PDF", for the cover's book map. */
function printPlan(plan: Plan, chapters: Map<string, Chapter>): Plan {
  const parts = plan.parts.map((p): PlanPart => {
    const part: PlanPart = { ...p, chapters: [] };
    part.chapters = p.chapters.map((c) => {
      const ch = chapters.get(c.id);
      return { ...c, part, count: ch && hasBlocks(ch, 'pdf') ? 1 : 0 };
    });
    return part;
  });
  return { ...plan, parts };
}

function cover(book: Book, plan: Plan): HTMLElement {
  const kicker = guideLabel(book);
  return h('section', { class: 'pg pg-cover' },
    h('div', { class: 'jacket' },
      h('span', { class: 'label' }, kicker),
      h('h1', { class: 'cover-title' }, book.title),
      book.subtitle ? h('p', { class: 'cover-sub' }, book.subtitle) : null,
      h('p', { class: 'cover-author' }, book.author),
      book.edition ? h('p', { class: 'cover-edition' }, book.edition) : null,
      rich(book.lead, 'p', 'cover-lead'),
    ),
    bookMap(plan),
    h('nav', { class: 'pcontents', 'aria-label': 'Contents' },
      h('h2', { class: 'label' }, 'Contents'),
      plan.parts.map((part) =>
        h('div', { class: 'pc-part' },
          h('h3', { class: 'pc-kicker' }, part.kicker),
          h('ol', null,
            contentsRows(part).map(({ number, title, later }) =>
              h('li', { class: later ? 'later' : '' },
                h('span', { class: 'pc-num' }, number),
                h('span', { class: 'pc-title' }, title),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Contents rows: written chapters one by one; a run of unwritten ones as one row ("07–61"). */
function contentsRows(part: PlanPart): { number: string; title: string; later: boolean }[] {
  const rows: { number: string; title: string; later: boolean }[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) rows.push({ number: run.length === 1 ? run[0] : `${run[0]}–${run[run.length - 1]}`, title: 'Not in this guide yet', later: true });
    run = [];
  };
  for (const ch of part.chapters) {
    if (ch.count > 0) {
      flush();
      rows.push({ number: ch.number, title: ch.title, later: false });
    } else run.push(ch.number);
  }
  flush();
  return rows;
}

function chapterPage(ch: Chapter, part: PlanPart, answers: Answers[]): HTMLElement {
  const quizzes: QuizScreen[] = [];
  const page = h('section', { class: 'pg pg-chapter' },
    h('header', { class: 'ph' },
      h('span', { class: 'ph-num' }, ch.number),
      h('div', { class: 'ph-text' },
        h('span', { class: 'label' }, part.kicker),
        h('h1', { class: `ph-title${ch.title.length > 48 ? ' long' : ''}` }, ch.title),
      ),
    ),
    chapterBlocks(ch, 'pdf').map(({ section, screens }) =>
      h('div', { class: 'psection' },
        section ? h('h2', { class: 'psec' }, section.title) : null,
        screens.map((s) => block(s, quizzes)),
      ),
    ),
  );
  if (quizzes.length > 0) answers.push({ chapter: `${ch.number} · ${ch.title}`, quizzes });
  return page;
}

function block(s: Screen, quizzes: QuizScreen[]): HTMLElement {
  const el = h('div', { class: `pblock${s.only === 'pdf' ? ' pdf-only' : ''}`, 'data-type': s.type });
  if (s.type === 'chart') el.dataset.chart = s.chart;
  switch (s.type) {
    case 'quiz': {
      const first = quizzes.reduce((n, q) => n + q.questions.length, 0);
      quizzes.push(s);
      el.append(
        h('span', { class: 'label' }, s.label),
        h('ol', { class: 'pquiz', start: first + 1 }, s.questions.map((q) => h('li', null, rich(q.q)))),
        h('p', { class: 'cap' }, 'Answers at the end of the guide'),
      );
      break;
    }
    case 'scenes':
      el.append(
        h('span', { class: 'label' }, s.label ?? 'Who is where'),
        sceneFigure(s, PRINT_WIDTH),
        h('p', { class: 'cap' }, 'Columns: the scenes in order. Dot: in the scene · ring: there from a distance'),
        h('span', { class: 'label' }, 'What happens'),
        sceneItems(s, 0, s.scenes.length, true),
      );
      break;
    case 'chart':
      if (s.chart === 'threads') {
        const list = threadList(s);
        el.append(
          s.label ? h('span', { class: 'label' }, s.label) : '',
          h('div', { class: 'figure svg-figure' }, renderChart(s, PRINT_WIDTH)),
          h('p', { class: 'cap' }, s.caption ?? DEFAULT_CAPTION.threads ?? ''),
        );
        if (list) renderBlock(el, list);
        break;
      }
      renderBlock(el, s, { width: PRINT_WIDTH });
      break;
    default:
      renderBlock(el, s, { width: PRINT_WIDTH });
  }
  return el;
}

function answersPage(answers: Answers[]): HTMLElement {
  return h('section', { class: 'pg pg-answers' },
    h('header', { class: 'ph' },
      h('span', { class: 'ph-num' }, 'A'),
      h('div', { class: 'ph-text' }, h('span', { class: 'label' }, 'Test yourself'), h('h1', { class: 'ph-title' }, 'Answers')),
    ),
    answers.map((a) => {
      let n = 0;
      return h('div', { class: 'pblock pans' },
        h('h2', { class: 'psec' }, a.chapter),
        h('ol', { class: 'pans-list' },
          a.quizzes.flatMap((q) => q.questions.map((qa) => {
            n++;
            return h('li', { value: n },
              rich(qa.q, 'p', 'pans-q'),
              rich(qa.a, 'p', 'pans-a'),
            );
          })),
        ),
      );
    }),
  );
}
