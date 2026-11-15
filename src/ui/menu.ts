// The book menu, opened by a tap: the library, a link to this screen, full screen, page colour,
// contents (parts, chapters, sections) and a reminder of the gestures. Chapters not written yet show
// only their number.

import { h } from '../lib/dom.ts';
import { canFullscreen, isFullscreen, isInstalled, toggleFullscreen } from '../lib/device.ts';
import { guideLabel } from '../screens/render.ts';
import { schemePicker } from './scheme-picker.ts';
import { pdfLink } from '../lib/pdf.ts';
import { shareLink } from '../lib/share.ts';
import type { Plan, PlanScreen } from '../model/plan.ts';

/** How long (ms) after opening the menu ignores clicks: the tap's own click comes within this time. */
const MENU_CLICK_GUARD = 500;

export interface MenuActions {
  jump(index: number): void;
  library(): void;
}

export class Menu {
  readonly el: HTMLElement;
  private sheet: HTMLElement;
  private toc: HTMLElement;
  private fsButton: HTMLButtonElement | null = null;
  private shareButton: HTMLButtonElement;
  private at: PlanScreen | null = null;
  private shareTimer = 0;
  /** Until this time (ms) the menu ignores clicks: see open(). */
  private guardUntil = 0;

  private plan: Plan;
  private actions: MenuActions;

  constructor(plan: Plan, actions: MenuActions) {
    this.plan = plan;
    this.actions = actions;
    const b = plan.book;
    this.toc = h('nav', { class: 'toc', 'aria-label': 'Contents' });
    this.shareButton = h('button', { type: 'button', class: 'btn', onclick: () => void this.share() }, 'Share this screen');
    if (canFullscreen() && !isInstalled()) {
      this.fsButton = h('button', { type: 'button', class: 'btn', onclick: () => void toggleFullscreen().then(() => this.syncFs()) }, 'Full screen');
    }
    this.sheet = h('div', { class: 'menu-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${b.title} menu` },
      h('div', { class: 'menu-head' },
        h('div', null,
          h('span', { class: 'label' }, guideLabel(b)),
          h('h2', { class: 'menu-title' }, b.title),
          h('p', { class: 'menu-author' }, b.author),
        ),
        h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Close menu', onclick: () => this.close() }, 'Close'),
      ),
      h('div', { class: 'menu-actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => actions.library() }, 'Library'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.pick(0) }, 'Cover'),
        pdfLink(b, 'Download PDF'),
        this.shareButton,
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
    // On a touch screen the tap that opens the menu is followed by a click at the same place, which
    // would land on the menu that just opened: on the backdrop (closing it) or on a button (jumping
    // to a chapter). Swallow clicks for a moment after the menu opens.
    this.el.addEventListener('click', (e) => {
      if (performance.now() < this.guardUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    document.addEventListener('fullscreenchange', this.syncFs);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(at: PlanScreen): void {
    this.guardUntil = performance.now() + MENU_CLICK_GUARD;
    this.at = at;
    this.resetShare();
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
    clearTimeout(this.shareTimer);
  }

  /** The address bar always names the current screen (main.ts), so the link is the page address. */
  private async share() {
    const ch = this.at?.chapter;
    const b = this.plan.book;
    const title = ch && ch.kind === 'chapter' ? `${b.title} · ${ch.number} ${ch.title}` : b.title;
    const result = await shareLink(location.href, title);
    if (result === 'copied') this.flashShare('Link copied');
    else if (result === 'failed') this.flashShare('Copy the address to share');
  }

  private flashShare(text: string) {
    this.shareButton.textContent = text;
    clearTimeout(this.shareTimer);
    this.shareTimer = window.setTimeout(() => this.resetShare(), 2400);
  }

  private resetShare() {
    clearTimeout(this.shareTimer);
    this.shareButton.textContent = 'Share this screen';
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
        h('section', { class: 'toc-part' },
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
