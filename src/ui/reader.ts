// Book read mode. The stage shows one screen at a time; a drag moves it with the finger and
// brings in the neighbour on the same axis:
//
//   vertical    previous / next screen         (finger up → next)
//   horizontal  previous / next chapter start  (finger left → next)
//
// Release past a fifth of the screen, or flick, to commit; otherwise the screen springs back.

import { h } from '../lib/dom.ts';
import { prefersReducedMotion } from '../lib/device.ts';
import { getFlag, setFlag } from '../data/progress.ts';
import { attachSwipe, shouldCommit, type Axis } from '../input/gestures.ts';
import { attachKeys, attachWheel, type Move } from '../input/keys.ts';
import { nextChapter, nextScreen, prevChapter, prevScreen, type Plan, type PlanScreen } from '../model/plan.ts';
import { fitScreen, renderScreen, type ScreenContext } from '../screens/render.ts';
import { Hud } from './hud.ts';
import { Menu } from './menu.ts';

export interface ReaderOptions {
  plan: Plan;
  start: number;
  /** Leave the book (back to the library). */
  exit(): void;
  /** Called on every arrival at a screen: save the place, update the address. */
  arrived(ps: PlanScreen): void;
}

type Dir = 1 | -1;

interface Drag {
  axis: Axis;
  dir: Dir | 0;
  target: number | null;
  incoming: HTMLElement | null;
  size: number;
  /** Last finger offset along the axis. */
  last: number;
}

const EASE = 'cubic-bezier(.22,.8,.24,1)';

export class Reader {
  readonly el: HTMLElement;
  private stage: HTMLElement;
  private hud: Hud;
  private menu: Menu;
  private hint: HTMLElement | null = null;
  private index: number;
  private current: HTMLElement | null = null;
  private drag: Drag | null = null;
  private transition: { anims: Animation[]; done: () => void } | null = null;
  private ctx: ScreenContext;
  private cleanups: (() => void)[] = [];

  private opts: ReaderOptions;

  constructor(opts: ReaderOptions) {
    this.opts = opts;
    const { plan } = opts;
    this.index = Math.min(Math.max(0, opts.start), plan.screens.length - 1);
    this.ctx = { plan, jump: (i) => this.jump(i), exit: () => opts.exit() };
    this.stage = h('main', { class: 'stage' });
    this.hud = new Hud(plan);
    this.menu = new Menu(plan, { jump: (i) => this.jump(i), library: () => opts.exit() });
    if (!getFlag('hint-seen')) {
      this.hint = h('div', { class: 'hint-toast', role: 'status' },
        h('b', null, 'Swipe up'), ' for the next screen, ',
        h('b', null, 'left'), ' for the next chapter. ',
        h('b', null, 'Tap'), ' for the menu.',
      );
    }
    this.el = h('div', { class: 'reader' }, this.stage, this.hud.el, this.hud.rail, this.hint, this.menu.el);
  }

  get plan(): Plan {
    return this.opts.plan;
  }

  attach(parent: HTMLElement): void {
    parent.append(this.el);
    this.current = this.mount(this.index);
    this.hud.update(this.plan.screens[this.index]);

    this.cleanups.push(
      attachSwipe(this.stage, {
        start: (axis, d) => this.dragStart(axis, d),
        move: (_axis, d) => this.dragMove(d),
        end: (_axis, d, v) => this.dragEnd(d, v),
        cancel: () => this.dragEnd(this.drag?.last ?? 0, 0, false),
        tap: (target) => {
          // Buttons inside a screen (quiz, book map, contents) handle their own taps.
          if (target.closest('button, a, input, select, textarea, label')) return;
          this.menu.toggle(this.plan.screens[this.index]);
        },
      }),
      attachKeys((m) => this.onMove(m)),
      attachWheel(this.stage, (m) => this.onMove(m)),
    );
    const refit = () => {
      if (this.drag) return;
      this.settle();
      if (this.current) fitScreen(this.current);
    };
    addEventListener('resize', refit);
    this.cleanups.push(() => removeEventListener('resize', refit), () => this.menu.destroy());
  }

  destroy(): void {
    this.settle();
    this.cleanups.forEach((f) => f());
    this.cleanups = [];
    this.el.remove();
  }

  /** Go to any screen: a slide on the vertical axis inside a chapter, horizontal across chapters. */
  jump(target: number): void {
    if (target === this.index || target < 0 || target >= this.plan.screens.length) return;
    const same = this.plan.screens[target].chapter === this.plan.screens[this.index].chapter;
    this.go(target, same ? 'y' : 'x', target > this.index ? 1 : -1);
  }

  private onMove(m: Move) {
    if (this.menu.isOpen) {
      if (m === 'menu') this.menu.close();
      return;
    }
    if (this.drag) return;
    const i = this.index;
    const p = this.plan;
    switch (m) {
      case 'next': return this.go(nextScreen(p, i), 'y', 1);
      case 'prev': return this.go(prevScreen(p, i), 'y', -1);
      case 'nextChapter': return this.go(nextChapter(p, i), 'x', 1);
      case 'prevChapter': return this.go(prevChapter(p, i), 'x', -1);
      case 'first': return this.jump(0);
      case 'last': return this.jump(p.screens.length - 1);
      case 'menu': return this.menu.toggle(p.screens[i]);
    }
  }

  private neighbour(axis: Axis, dir: Dir): number | null {
    const p = this.plan;
    const i = this.index;
    if (axis === 'y') return dir > 0 ? nextScreen(p, i) : prevScreen(p, i);
    return dir > 0 ? nextChapter(p, i) : prevChapter(p, i);
  }

  // ---- screens ---------------------------------------------------------------------------------

  private mount(index: number, axis: Axis = 'y', offset = 0): HTMLElement {
    const el = renderScreen(this.plan.screens[index], this.ctx);
    place(el, axis, offset);
    this.stage.append(el);
    fitScreen(el);
    return el;
  }

  private size(axis: Axis): number {
    return axis === 'x' ? this.stage.clientWidth : this.stage.clientHeight;
  }

  private arrive(index: number, el: HTMLElement) {
    this.index = index;
    this.current = el;
    const ps = this.plan.screens[index];
    this.hud.update(ps);
    this.opts.arrived(ps);
    if (this.hint) {
      const hint = this.hint;
      hint.addEventListener('transitionend', () => hint.remove(), { once: true });
      hint.classList.add('gone');
      setFlag('hint-seen');
      this.hint = null;
    }
  }

  // ---- drag ------------------------------------------------------------------------------------

  private dragStart(axis: Axis, d: number) {
    if (this.menu.isOpen) return;
    this.settle();
    this.drag = { axis, dir: 0, target: null, incoming: null, size: this.size(axis), last: d };
    this.dragMove(d);
  }

  private dragMove(d: number) {
    const g = this.drag;
    const cur = this.current;
    if (!g || !cur) return;
    g.last = d;
    const dir: Dir = d < 0 ? 1 : -1;
    if (dir !== g.dir) {
      // The finger crossed the start point: bring in the neighbour on the other side.
      g.incoming?.remove();
      g.dir = dir;
      g.target = this.neighbour(g.axis, dir);
      g.incoming = g.target === null ? null : this.mount(g.target, g.axis, dir * g.size);
    }
    if (g.incoming) {
      place(cur, g.axis, d);
      place(g.incoming, g.axis, d + dir * g.size);
    } else {
      place(cur, g.axis, rubberBand(d, g.size));
    }
  }

  private dragEnd(d: number, v: number, mayCommit = true) {
    const g = this.drag;
    const cur = this.current;
    this.drag = null;
    if (!g || !cur || g.dir === 0) return;
    const dir = g.dir;
    const incoming = g.incoming;
    const target = g.target;

    if (mayCommit && incoming && target !== null && shouldCommit(d, v, g.size)) {
      const remaining = g.size - Math.abs(d);
      const ms = clamp(remaining / Math.max(Math.abs(v), 1.1), 140, 320);
      this.animate(g.axis, ms, [[cur, d, -dir * g.size], [incoming, d + dir * g.size, 0]], () => {
        cur.remove();
        this.arrive(target, incoming);
      });
    } else {
      const from = incoming ? d : rubberBand(d, g.size);
      const layers: Layer[] = [[cur, from, 0]];
      if (incoming) layers.push([incoming, d + dir * g.size, dir * g.size]);
      this.animate(g.axis, 220, layers, () => incoming?.remove());
    }
  }

  // ---- programmatic moves ----------------------------------------------------------------------

  private go(target: number | null, axis: Axis, dir: Dir) {
    const cur = this.current;
    if (target === null || target === this.index || !cur) {
      if (target === null && cur && !this.transition) this.bump(axis, dir);
      return;
    }
    this.settle();
    const from = this.current!;
    const size = this.size(axis);
    const incoming = this.mount(target, axis, dir * size);
    this.animate(axis, 300, [[from, 0, -dir * size], [incoming, dir * size, 0]], () => {
      from.remove();
      this.arrive(target, incoming);
    });
  }

  /** At the first or last screen: a small push that comes back, so the key press is felt. */
  private bump(axis: Axis, dir: Dir) {
    const cur = this.current!;
    const d = -dir * 18;
    this.animate(axis, 260, [[cur, 0, 0]], () => {}, [0, d, 0]);
  }

  private animate(axis: Axis, ms: number, layers: Layer[], done: () => void, keyframes?: number[]) {
    for (const [el, , to] of layers) place(el, axis, to);
    if (prefersReducedMotion() || ms <= 0) {
      done();
      return;
    }
    const anims = layers.map(([el, from, to]) =>
      el.animate((keyframes ?? [from, to]).map((v) => ({ transform: translate(axis, v) })), { duration: ms, easing: EASE }),
    );
    const t = { anims, done };
    this.transition = t;
    Promise.all(anims.map((a) => a.finished)).then(
      () => { if (this.transition === t) this.settle(); },
      () => {},
    );
  }

  /** Ends a running slide at once, so a new move starts from a clean state. */
  private settle() {
    const t = this.transition;
    if (!t) return;
    this.transition = null;
    t.anims.forEach((a) => a.cancel());
    t.done();
  }
}

type Layer = [el: HTMLElement, from: number, to: number];

const translate = (axis: Axis, v: number) => (axis === 'x' ? `translate3d(${v}px,0,0)` : `translate3d(0,${v}px,0)`);

function place(el: HTMLElement, axis: Axis, v: number) {
  el.style.transform = v === 0 ? '' : translate(axis, v);
}

/** Resistance past the first or last screen, like a scroll view's edge. */
function rubberBand(d: number, size: number): number {
  return Math.sign(d) * (1 - 1 / ((Math.abs(d) / size) * 0.55 + 1)) * size;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
