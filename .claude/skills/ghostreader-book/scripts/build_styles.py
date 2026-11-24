#!/usr/bin/env python3
"""Builds the Recap, Recall and Layers files of a guide from its Map file and a styles file.

Every guide is written in all four styles (references/styles.md). Write the Map file first
(src/books/<guide>-map.json, with "guide" and "style": "map"), then the per-style texts in
work/<guide>/styles.json, then run:

    python3 -I .claude/skills/ghostreader-book/scripts/build_styles.py \\
        src/books/<guide>-map.json work/<guide>/styles.json

It writes src/books/<guide>-recap.json, -recall.json and -layers.json next to the Map file:
diagrams, key points, logic and PDF detail come from the Map chapters; the new screens come from
the styles file. Every chapter of every style ends with the Map chapter's resume screens, "Where
it stands" and (optionally) "Still open", so a reader who opens the last chapter they read finds
the same state of play in any style.

Recall's "Try to remember" holds the chapter's first two questions and, from the second written
chapter on, the third question of the chapter two before ("From Chapter 3: …"): a spaced repeat.
In the first chapter it holds all three. Layers' "argument so far" keeps the frame: one item per
finished part, then the points of the current part's earlier chapters (four items at most).

The files have exactly the Map file's parts and chapters, the book's own: the script adds no
chapter, and it stops when the Map file has a guide-made overview chapter (number S, B, K, W, T
or M), when a Map chapter lacks "Where it stands", or when the styles file lacks a written
chapter. Run `npm run validate` afterwards: the limits and writing rules apply to these files too.
"""
import argparse
import copy
import json
import os
import re
import sys

STYLES = ('recap', 'recall', 'layers')
GUIDE_MADE = {'S', 'B', 'K', 'W', 'T', 'M'}  # overview chapters of earlier versions: not allowed
END = ('Where it stands', 'Still open')  # the resume screens at the end of every chapter
QUESTION_WORDS = 24  # src/model/lint.ts: a quiz question on a phone screen
FLOW_ITEMS = 4


def fail(msg):
    sys.exit(f'build_styles: {msg}')


def words(s):
    return len([w for w in re.sub(r'[{}\[\]*]', '', s).split() if re.search(r'\w', w)])


def app(screens):
    return [s for s in screens if s.get('only') != 'pdf' and s.get('label') not in END]


def pdf_only(screens, drop_quiz=False):
    return [copy.deepcopy(s) for s in screens if s.get('only') == 'pdf' and not (drop_quiz and s['type'] == 'quiz')]


def end_screens(screens, cid):
    out = [copy.deepcopy(s) for s in screens if s.get('label') in END]
    if not out or out[0].get('label') != END[0]:
        fail(f'{cid}: the Map chapter has no "{END[0]}" screen (references/styles.md: the resume screens)')
    return out


def first(screens, kind, label=None, style_not=None):
    for s in app(screens):
        if s['type'] != kind:
            continue
        if label and s.get('label') != label:
            continue
        if style_not and s.get('style') == style_not:
            continue
        return copy.deepcopy(s)
    return None


def by_label(screens, label):
    for s in app(screens):
        if s.get('label') == label:
            return copy.deepcopy(s)
    return None


def main_chart(screens, label, cid):
    if label:
        s = by_label(screens, label)
        if not s:
            fail(f'{cid}: no screen labelled "{label}" in the Map file ("main")')
        return s
    for s in app(screens):
        if s['type'] in ('chart', 'scenes', 'figure'):
            return copy.deepcopy(s)
    fail(f'{cid}: the Map chapter has no chart, scenes or figure')


def chapter_screens(ch):
    if 'sections' in ch:
        return [s for sec in ch['sections'] for s in sec['screens']]
    return ch.get('screens', [])


def chapter_name(ch):
    """How a recycled question names its chapter: "Chapter 3", or the book's name ("Prologue")."""
    return f'Chapter {int(ch["number"])}' if ch['number'].isdigit() else ch['title']


class Guide:
    """The Map file's reading order, parts and styles notes, shared by the recipes."""

    def __init__(self, book, notes):
        self.notes = notes
        self.chapters = notes.get('chapters', {})
        self.question = notes.get('question', '')
        self.order = []   # written chapter ids in reading order
        self.part_of = {}  # chapter id -> part id
        self.info = {}    # chapter id -> chapter (without screens)
        self.parts = []   # part ids in order, with their written chapters
        for part in book['parts']:
            written = [ch['id'] for ch in part['chapters'] if chapter_screens(ch)]
            self.parts.append((part['id'], written))
            for ch in part['chapters']:
                if chapter_screens(ch):
                    self.order.append(ch['id'])
                    self.part_of[ch['id']] = part['id']
                    self.info[ch['id']] = ch

    def part_point(self, pid, written):
        given = self.notes.get('parts', {}).get(pid)
        if given:
            return given
        if len(written) == 1:
            return self.chapters[written[0]]['point']
        fail(f'styles file: "parts" needs a point for part "{pid}" (it has {len(written)} chapters)')

    def argument_so_far(self, cid):
        """Items of Layers' "argument so far": the finished parts, then the current part's earlier chapters."""
        i = self.order.index(cid)
        if i == 0:
            return self.notes.get('first_items', [])
        pid = self.part_of[cid]
        frame = []
        for part_id, written in self.parts:
            if part_id == pid:
                break
            if written:
                frame.append(self.part_point(part_id, written))
        here = [c for c in self.order[:i] if self.part_of[c] == pid]
        recent = [self.chapters[c]['point'] for c in here]
        frame = frame[-FLOW_ITEMS:]
        room = FLOW_ITEMS - len(frame)
        return frame + (recent[-room:] if room > 0 else [])

    def try_to_remember(self, cid):
        """Recall's first quiz: two questions on this chapter and one again from two chapters back."""
        qs = self.chapters[cid]['questions']
        if len(qs) != 3:
            fail(f'{cid}: "questions" needs exactly three questions (has {len(qs)})')
        i = self.order.index(cid)
        if i == 0:
            picked = qs
        else:
            back = self.order[max(0, i - 2)]
            again = copy.deepcopy(self.chapters[back]['questions'][2])
            again['q'] = f'From {chapter_name(self.info[back])}: {again["q"]}'
            if words(again['q']) > QUESTION_WORDS:
                fail(f'{back}: the third question is asked again later as "{again["q"]}": '
                     f'{words(again["q"])} words, at most {QUESTION_WORDS} (shorten the question)')
            picked = qs[:2] + [again]
        return {'type': 'quiz', 'label': 'Try to remember', 'questions': [{'q': x['q'], 'a': x['a']} for x in picked]}


def build(map_book, notes, style):
    guide = map_book.get('guide') or fail('the Map file has no "guide"')
    book = copy.deepcopy(map_book)
    book['id'] = f'{guide}-{style}'
    book['style'] = style

    made = [ch['id'] for part in book['parts'] for ch in part['chapters'] if ch['number'] in GUIDE_MADE]
    if made:
        fail(f'the Map file has guide-made chapters ({", ".join(made)}): a guide holds only the book\'s own chapters')

    g = Guide(book, notes)
    missing = [cid for cid in g.order if cid not in g.chapters]
    if missing:
        fail(f'styles file has no entry for: {", ".join(missing)}')

    for part in book['parts']:
        new_chapters = []
        for ch in part['chapters']:
            screens = chapter_screens(ch)
            if not screens:
                new_chapters.append(ch)
                continue
            n = g.chapters[ch['id']]
            ch = {k: v for k, v in ch.items() if k not in ('screens', 'sections')}
            ch['screens'] = RECIPES[style](ch['id'], screens, n, g) + end_screens(screens, ch['id'])
            new_chapters.append(ch)
        part['chapters'] = new_chapters
    return book


def recap(cid, screens, n, g):
    out = []
    if n.get('before'):
        out.append({'type': 'summary', 'label': 'Before this chapter', 'text': n['before']})
    out.append({'type': 'text', 'label': 'Recap', 'paragraphs': n['recap']})
    out.append({'type': 'list', 'label': 'Key moments', 'rows': [{'name': m['name'], 'text': m['text']} for m in n['moments']]})
    out.append(main_chart(screens, n.get('main'), cid))
    out.append({'type': 'points', 'label': 'Remember', 'items': [{'title': r['title'], 'text': r['text']} for r in n['remember']]})
    return out + pdf_only(screens)


def recall(cid, screens, n, g):
    out = [g.try_to_remember(cid)]
    summary = first(screens, 'summary')
    if summary:
        out.append(summary)
    out.append(main_chart(screens, n.get('main'), cid))
    points = first(screens, 'points', 'Key points') or first(screens, 'points', style_not='box')
    if points:
        out.append(points)
    return out + pdf_only(screens, drop_quiz=True)


def layers(cid, screens, n, g):
    items = g.argument_so_far(cid)
    out = [{'type': 'summary', 'label': 'In one line', 'text': n['line']}]
    points = first(screens, 'points', 'Key points') or first(screens, 'points', style_not='box')
    if points:
        points['label'] = 'In three points'
        out.append(points)
    if items:
        out.append({'type': 'chart', 'chart': 'flow', 'label': 'The argument so far', 'start': g.question,
                    'groups': [{'items': items}], 'key': n['key']})
    out.append(main_chart(screens, n.get('main'), cid))
    steps = first(screens, 'steps')
    if steps:
        steps['label'] = 'In detail'
        out.append(steps)
    return out + pdf_only(screens)


RECIPES = {'recap': recap, 'recall': recall, 'layers': layers}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('map_file', help='src/books/<guide>-map.json')
    ap.add_argument('styles_file', help='work/<guide>/styles.json')
    args = ap.parse_args()
    with open(args.map_file) as f:
        map_book = json.load(f)
    with open(args.styles_file) as f:
        notes = json.load(f)
    if map_book.get('style') != 'map':
        fail('the first file must be the Map file ("style": "map")')
    out_dir = os.path.dirname(os.path.abspath(args.map_file))
    for style in STYLES:
        book = build(map_book, notes, style)
        path = os.path.join(out_dir, f'{book["id"]}.json')
        with open(path, 'w') as f:
            json.dump(book, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'wrote {path}')


if __name__ == '__main__':
    main()
