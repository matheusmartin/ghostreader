// The reader's part of the menu (ui/menu.ts): the library, the cover, the PDF, a link to this
// screen, the style, and the contents (parts, chapters, sections). Chapters not written yet show
// only their number.

import { h } from '../lib/dom.ts';
import { guideLabel, STYLE_NAMES } from '../screens/render.ts';
import { pdfLink } from '../lib/pdf.ts';
import { shareLink } from '../lib/share.ts';
import { setSetting } from '../lib/storage.ts';
import { guideStyles, siblingId } from '../data/books.ts';
import { readHash } from '../router.ts';
import { closeMenu, HOLD_HELP, type MenuPage } from './menu.ts';
import type { Style } from '../model/types.ts';
import type { Plan, PlanScreen } from '../model/plan.ts';

export interface BookMenuActions {
  /** The screen the reader shows now. */
  at(): PlanScreen;
  jump(index: number): void;
  library(): void;
}

export function bookMenu(plan: Plan, actions: BookMenuActions): MenuPage {
  const b = plan.book;
  let shareTimer = 0;

  const pick = (index: number) => {
    closeMenu();
    actions.jump(index);
  };

  /** The address bar always names the current screen (main.ts), so the link is the page address. */
  const shareButton = () => {
    const label = 'Share this screen';
    const button = h('button', { type: 'button', class: 'btn' }, label);
    const flash = (text: string) => {
      button.textContent = text;
      clearTimeout(shareTimer);
      shareTimer = window.setTimeout(() => { button.textContent = label; }, 2400);
    };
    button.addEventListener('click', async () => {
      const ch = actions.at().chapter;
      const title = ch.kind === 'chapter' ? `${b.title} · ${ch.number} ${ch.title}` : b.title;
      const result = await shareLink(location.href, title);
      if (result === 'copied') flash('Link copied');
      else if (result === 'failed') flash('Copy the address to share');
    });
    return button;
  };

  /** The other styles of this guide: switching opens the same chapter in that style. */
  const stylePicker = (): HTMLElement | null => {
    const styles = guideStyles(b);
    if (styles.length < 2) return null;
    const current = b.style ?? 'map';
    const switchStyle = (s: Style) => {
      const id = siblingId(b, s);
      if (!id || current === s) return;
      setSetting('style', s);
      closeMenu();
      const ch = actions.at().chapter;
      location.replace(ch.kind === 'chapter' ? readHash(id, ch.id, 0) : readHash(id));
    };
    return h('div', { class: 'style-picker' },
      h('span', { class: 'label' }, 'Style'),
      h('div', { class: 'style-list', role: 'radiogroup', 'aria-label': 'Style' },
        styles.map((s) =>
          h('button', { type: 'button', class: 'style-opt', role: 'radio', 'aria-checked': String(s === current), onclick: () => switchStyle(s) },
            STYLE_NAMES[s]),
        ),
      ),
    );
  };

  const toc = (): HTMLElement => {
    const at = actions.at();
    return h('nav', { class: 'toc', 'aria-label': 'Contents' },
      plan.parts.map((part) =>
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
                h('button', { type: 'button', onclick: () => pick(ch.first), 'aria-current': current ? 'true' : null },
                  h('span', { class: 'toc-num' }, ch.number),
                  h('span', { class: 'toc-title' }, ch.title),
                ),
                ch.sections.length > 0
                  ? h('ol', { class: 'toc-sections' },
                      ch.sections.map((s) =>
                        h('li', { class: s === at.section ? 'current' : '' },
                          h('button', { type: 'button', onclick: () => pick(s.first) }, s.title),
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
  };

  return {
    label: guideLabel(b),
    title: b.title,
    sub: b.author,
    actions: () => [
      h('button', { type: 'button', class: 'btn primary', onclick: () => { closeMenu(); actions.library(); } }, 'Library'),
      h('button', { type: 'button', class: 'btn', onclick: () => pick(0) }, 'Cover'),
      pdfLink(b, 'Download PDF'),
      shareButton(),
    ],
    top: () => [stylePicker()],
    bottom: () => [toc()],
    help: [
      ['Swipe up · down', 'Next · previous screen'],
      ['Swipe left · right', 'Next · previous chapter'],
      HOLD_HELP,
    ],
    closed: () => clearTimeout(shareTimer),
  };
}
