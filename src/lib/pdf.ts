// The PDF of a book: built at deploy time as pdf/<book>.pdf (scripts/build-pdfs.mjs). In
// development there is no built file, so the link opens the print view instead.

import { h } from './dom.ts';
import { GUIDE_NAMES, STYLE_NAMES } from '../screens/render.ts';
import { printHash } from '../router.ts';
import type { Book } from '../model/types.ts';

/** "Harari - Nexus (2024) - Book Summary.pdf"; a style and a limit add "- Recap - to Chapter 3". */
export function pdfFileName(b: Book): string {
  const surname = b.author.trim().split(/\s+/).pop() ?? b.author;
  const guide = GUIDE_NAMES[b.type].replace(/\b\w/g, (c) => c.toUpperCase());
  const style = b.style ? STYLE_NAMES[b.style] : '';
  const name = [surname, `${b.title}${b.year ? ` (${b.year})` : ''}`, guide, style, b.upTo ? `to ${b.upTo}` : '']
    .filter(Boolean)
    .join(' - ');
  return `${name.replace(/[/\\:*?"<>|]/g, '')}.pdf`;
}

export function pdfLink(b: Book, label = 'PDF', className = 'btn'): HTMLAnchorElement {
  if (import.meta.env.DEV) {
    return h('a', { class: className, href: printHash(b.id), title: 'Print view (the PDF is built when the app is built)' }, label);
  }
  return h('a', { class: className, href: `pdf/${encodeURIComponent(b.id)}.pdf`, download: pdfFileName(b), type: 'application/pdf' }, label);
}
