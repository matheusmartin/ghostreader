#!/usr/bin/env python3
"""Builds the Recap, Recall and Layers files of a guide from its Map file and a styles file.

Every guide is written in all four styles (references/styles.md). Write the Map file first
(src/books/<guide>-map.json, with "guide" and "style": "map"), then the per-style texts in
work/<id>/styles.json, then run:

    python3 -I .claude/skills/ghostwriter-book/scripts/build_styles.py \\
        src/books/<guide>-map.json work/<id>/styles.json

It writes src/books/<guide>-recap.json, -recall.json and -layers.json next to the Map file:
diagrams, key points, logic and PDF detail come from the Map chapters; the new screens come from
the styles file. The files have exactly the Map file's parts and chapters, the book's own: the
script adds no chapter, and it stops when the Map file has a guide-made overview chapter (number
S, B, K, W, T or M) or the styles file lacks a written chapter. Run `npm run validate` afterwards:
the limits and writing rules apply to these files too.
"""
import argparse
import copy
import json
import os
import sys

STYLES = ('recap', 'recall', 'layers')
GUIDE_MADE = {'S', 'B', 'K', 'W', 'T', 'M'}  # overview chapters of earlier versions: not allowed


def fail(msg):
    sys.exit(f'build_styles: {msg}')


def app(screens):
    return [s for s in screens if s.get('only') != 'pdf']


def pdf_only(screens, drop_quiz=False):
    return [copy.deepcopy(s) for s in screens if s.get('only') == 'pdf' and not (drop_quiz and s['type'] == 'quiz')]


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
    for s in screens:
        if s.get('label') == label and s.get('only') != 'pdf':
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


def quiz(label, qa):
    return {'type': 'quiz', 'label': label, 'questions': [{'q': x['q'], 'a': x['a']} for x in qa]}


def chapter_screens(ch):
    if 'sections' in ch:
        return [s for sec in ch['sections'] for s in sec['screens']]
    return ch.get('screens', [])


def build(map_book, notes, style):
    guide = map_book.get('guide') or fail('the Map file has no "guide"')
    book = copy.deepcopy(map_book)
    book['id'] = f'{guide}-{style}'
    book['style'] = style
    chapters = notes.get('chapters', {})
    question = notes.get('question', '')

    made = [ch['id'] for part in book['parts'] for ch in part['chapters'] if ch['number'] in GUIDE_MADE]
    if made:
        fail(f'the Map file has guide-made chapters ({", ".join(made)}): a guide holds only the book\'s own chapters')

    # Reading order of written chapters, for Layers' "argument so far".
    order = [ch['id'] for part in book['parts'] for ch in part['chapters'] if chapter_screens(ch)]
    missing = [cid for cid in order if cid not in chapters]
    if missing:
        fail(f'styles file has no entry for: {", ".join(missing)}')

    for part in book['parts']:
        new_chapters = []
        for ch in part['chapters']:
            screens = chapter_screens(ch)
            if not screens:
                new_chapters.append(ch)
                continue
            n = chapters[ch['id']]
            ch = {k: v for k, v in ch.items() if k not in ('screens', 'sections')}
            ch['screens'] = RECIPES[style](ch['id'], screens, n, order, chapters, question, notes)
            new_chapters.append(ch)
        part['chapters'] = new_chapters
    return book


def recap(cid, screens, n, order, chapters, question, notes):
    out = []
    if n.get('before'):
        out.append({'type': 'summary', 'label': 'Before this chapter', 'text': n['before']})
    out.append({'type': 'text', 'label': 'Recap', 'paragraphs': n['recap']})
    out.append({'type': 'list', 'label': 'Key moments', 'rows': [{'name': m['name'], 'text': m['text']} for m in n['moments']]})
    out.append(main_chart(screens, n.get('main'), cid))
    out.append({'type': 'points', 'label': 'Remember', 'items': [{'title': r['title'], 'text': r['text']} for r in n['remember']]})
    return out + pdf_only(screens)


def recall(cid, screens, n, order, chapters, question, notes):
    out = [quiz('Try to remember', n['questions'])]
    summary = first(screens, 'summary')
    if summary:
        out.append(summary)
    out.append(main_chart(screens, n.get('main'), cid))
    points = first(screens, 'points', 'Key points') or first(screens, 'points', style_not='box')
    if points:
        out.append(points)
    return out + pdf_only(screens, drop_quiz=True)


def layers(cid, screens, n, order, chapters, question, notes):
    i = order.index(cid)
    items = notes.get('first_items', []) if i == 0 else [chapters[c]['point'] for c in order[max(0, i - 3):i]]
    out = [{'type': 'summary', 'label': 'In one line', 'text': n['line']}]
    points = first(screens, 'points', 'Key points') or first(screens, 'points', style_not='box')
    if points:
        points['label'] = 'In three points'
        out.append(points)
    if items:
        out.append({'type': 'chart', 'chart': 'flow', 'label': 'The argument so far', 'start': question,
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
    ap.add_argument('styles_file', help='work/<id>/styles.json')
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
