// The book menu, opened by a tap: the library, full screen, page colour, contents (parts,
// chapters, sections) and a reminder of the gestures. Chapters not written yet show only their number.

import { h } from '../lib/dom.ts';
import { canFullscreen, isFullscreen, isInstalled, toggleFullscreen } from '../lib/device.ts';
import { GUIDE_NAMES } from '../screens/render.ts';
import { schemePicker } from './scheme-picker.ts';
import type { Plan, PlanScreen } from '../model/plan.ts';

export interface MenuActions {
  jump(index: number): void;
  library(): void;
}

export class Menu {
  readonly el: HTMLElement;
  private sheet: HTMLElement;
  private toc: HTMLElement;
  private fsButton: HTMLButtonElement | null = null;

  private plan: Plan;
  private actions: MenuActions;

  constructor(plan: Plan, actions: MenuActions) {
    this.plan = plan;
    this.actions = actions;
    const b = plan.book;
    this.toc = h('nav', { class: 'toc', 'aria-label': 'Contents' });
    if (canFullscreen() && !isInstalled()) {
      this.fsButton = h('button', { type: 'button', class: 'btn', onclick: () => void toggleFullscreen().then(() => this.syncFs()) }, 'Full screen');
    }
    this.sheet = h('div', { class: 'menu-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${b.title} menu` },
      h('div', { class: 'menu-head' },
        h('div', null,
          h('span', { class: 'label' }, GUIDE_NAMES[b.type]),
          h('h2', { class: 'menu-title' }, b.title),
          h('p', { class: 'menu-author' }, b.author),
        ),
        h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Close menu', onclick: () => this.close() }, 'Close'),
      ),
      h('div', { class: 'menu-actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => actions.library() }, 'Library'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.pick(0) }, 'Cover'),
        this.fsButton,
      ),
      schemePicker(),
      this.toc,
      h('dl', { class: 'menu-help' },
        h('dt', null, 'Swipe up · down'), h('dd', null, 'Next · previous screen'),
        h('dt', null, 'Swipe left · right'), h('dd', null, 'Next · previous chapter'),
        h('dt', null, 'Tap'), h('dd', null, 'This menu'),
      ),
    );
    this.el = h('div', { class: 'menu', hidden: true },
      h('div', { class: 'menu-backdrop', onclick: () => this.close() }),
      this.sheet,
    );
    document.addEventListener('fullscreenchange', this.syncFs);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(at: PlanScreen): void {
    this.buildToc(at);
    this.syncFs();
    this.el.hidden = false;
    void this.el.offsetHeight; // start the slide-in from the closed state
    this.el.classList.add('open');
    // 'nearest' keeps the top of the menu (actions, page colour) in view when it can.
    this.toc.querySelector<HTMLElement>('.current')?.scrollIntoView({ block: 'nearest' });
  }

  close(): void {
    this.el.classList.remove('open');
    this.el.hidden = true;
  }

  toggle(at: PlanScreen): void {
    if (this.isOpen) this.close();
    else this.open(at);
  }

  destroy(): void {
    document.removeEventListener('fullscreenchange', this.syncFs);
  }

  private pick(index: number) {
    this.close();
    this.actions.jump(index);
  }

  private syncFs = () => {
    if (this.fsButton) this.fsButton.textContent = isFullscreen() ? 'Exit full screen' : 'Full screen';
  };

  private buildToc(at: PlanScreen) {
    this.toc.replaceChildren(
      ...this.plan.parts.map((part) =>
        h('section', { class: `toc-part theme-${part.theme}` },
          h('h3', { class: 'label' }, part.kicker),
          h('ol', null,
            part.chapters.map((ch) => {
              if (ch.count === 0) {
                return h('li', { class: 'toc-ch later' },
                  h('span', { class: 'toc-num' }, ch.number),
                  h('span', { class: 'toc-title' }, 'Not in this guide yet'),
                );
              }
              const current = ch === at.chapter;
              return h('li', { class: `toc-ch${current ? ' current' : ''}` },
                h('button', { type: 'button', onclick: () => this.pick(ch.first), 'aria-current': current ? 'true' : null },
                  h('span', { class: 'toc-num' }, ch.number),
                  h('span', { class: 'toc-title' }, ch.title),
                ),
                ch.sections.length > 0
                  ? h('ol', { class: 'toc-sections' },
                      ch.sections.map((s) =>
                        h('li', { class: s === at.section ? 'current' : '' },
                          h('button', { type: 'button', onclick: () => this.pick(s.first) }, s.title),
                        ),
                      ),
                    )
                  : null,
              );
            }),
          ),
        ),
      ),
    );
  }
}
