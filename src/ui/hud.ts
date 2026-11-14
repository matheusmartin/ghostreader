// The "where am I" indicator. It mirrors the two swipe axes:
//   top strip     one segment per chapter (horizontal swipes move along it), filled as you read
//   breadcrumb    number · part · chapter title · section, and screen n of N in the chapter
//   right rail    one pip per screen of this chapter (vertical swipes move along it),
//                 grouped by section

import { h } from '../lib/dom.ts';
import { contentChapters, type Plan, type PlanChapter, type PlanScreen } from '../model/plan.ts';

export class Hud {
  readonly el: HTMLElement;
  readonly rail: HTMLElement;
  private segs = new Map<PlanChapter, HTMLElement>();
  private num = h('span', { class: 'hud-num' });
  private kicker = h('span', { class: 'hud-kicker label' });
  private title = h('span', { class: 'hud-title' });
  private section = h('span', { class: 'hud-section' });
  private pos = h('span', { class: 'hud-pos', 'aria-live': 'polite' });
  private railFor: PlanChapter | null = null;
  private pips: HTMLElement[] = [];
  private theme = '';

  private plan: Plan;

  constructor(plan: Plan) {
    this.plan = plan;
    const strip = h('div', { class: 'hud-strip', 'aria-hidden': 'true' },
      contentChapters(plan).map((ch) => {
        const seg = h('span', { class: `seg theme-${ch.part.theme}` }, h('span', { class: 'seg-fill' }));
        seg.style.flexGrow = String(ch.count);
        this.segs.set(ch, seg);
        return seg;
      }),
    );
    this.el = h('header', { class: 'hud' },
      strip,
      h('div', { class: 'hud-where' }, this.num, h('div', { class: 'hud-text' }, this.kicker, this.title, this.section), this.pos),
    );
    this.rail = h('nav', { class: 'rail', 'aria-hidden': 'true' });
  }

  update(ps: PlanScreen): void {
    const ch = ps.chapter;
    const theme = `theme-${ch.part.theme}`;
    for (const el of [this.el, this.rail]) {
      if (this.theme) el.classList.remove(this.theme);
      el.classList.add(theme);
    }
    this.theme = theme;

    // Strip: chapters before this one full, this one in part, later ones empty.
    for (const [c, seg] of this.segs) {
      const fill = ch.kind === 'end' || c.order < ch.order ? 1 : c === ch ? (ps.inChapter + 1) / c.count : 0;
      seg.style.setProperty('--fill', String(fill));
      seg.classList.toggle('current', c === ch);
    }

    // Cover, end and chapter opener show where you are in large type: the strip is enough.
    const quiet = ch.kind !== 'chapter' || ps.content.type === 'opener';
    this.el.classList.toggle('quiet', quiet);
    this.rail.classList.toggle('quiet', ch.kind !== 'chapter' || ch.count < 2);
    if (!quiet) {
      this.num.textContent = ch.number;
      this.kicker.textContent = ch.part.kicker;
      this.title.textContent = ch.title;
      this.section.textContent = ps.section?.title ?? '';
      this.section.hidden = !ps.section;
      this.pos.textContent = `${ps.inChapter + 1}/${ch.count}`;
      this.pos.setAttribute('aria-label', `Screen ${ps.inChapter + 1} of ${ch.count}`);
    }

    if (this.railFor !== ch) this.buildRail(ch);
    this.pips.forEach((p, i) => p.classList.toggle('on', i === ps.inChapter));
  }

  /** One pip per screen, in groups: the opener and loose screens, then each section. */
  private buildRail(ch: PlanChapter) {
    this.railFor = ch;
    this.rail.replaceChildren();
    this.pips = [];
    let group: HTMLElement | null = null;
    let groupKey: unknown = undefined;
    for (let i = 0; i < ch.count; i++) {
      const ps = this.plan.screens[ch.first + i];
      if (!group || ps.section !== groupKey) {
        group = h('span', { class: 'rail-group' });
        groupKey = ps.section;
        this.rail.append(group);
      }
      const pip = h('span', { class: 'pip' });
      this.pips.push(pip);
      group.append(pip);
    }
  }
}
