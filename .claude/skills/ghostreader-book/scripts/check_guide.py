#!/usr/bin/env python3
"""Checks a Ghostreader guide against the book's text and its working files (references/verify.md).

The work folder (work/<guide>/, never committed) holds what extract_book.py and the fact sheets
made: source/ (toc.json and one text file per section), facts/<chapter-id>.md and ledger.md.
The guide is the four files src/books/<guide>-{map,recap,recall,layers}.json.

Commands (run from the repository root):

  facts <guide>        Fact sheets and ledger: every anchor exists in the chapter's own source
                       files; each chapter has 5-8 "Must carry" items, each with a question,
                       spread over the chapter (not bunched at its end); the ledger has every
                       written chapter.
  names <guide>        Every name and every number from 11 up on a chapter's screens, in all four
                       styles, is in the book's text up to and including that chapter. It finds
                       outside facts, wrong forms of names, and spoilers (a name the book has not
                       given yet). Confirmed exceptions go one per line in work/<guide>/names-ok.txt.
  text <guide>         The guide as plain text, for a verifier: --style (default map), --upto
                       <chapter-id> (inclusive), --pdf to add the PDF-only blocks.
  test <guide>         The blind recall test: writes work/<guide>/recall-test/<style>-<chapter>.md
                       (the guide's app screens up to the chapter, then the must-carry questions of
                       those chapters, without answers) and a -key.md with the answers. Needs --upto.

Options: --work DIR (default work/<guide>), --books DIR (default src/books).
Exit codes: 0 = clean, 1 = problems found (each line says what to fix), 2 = cannot run.
"""
import argparse
import json
import re
import sys
from pathlib import Path

STYLES = ('map', 'recap', 'recall', 'layers')
MUST_MIN, MUST_MAX = 5, 8
KINDS = {'state', 'cause', 'claim', 'concept', 'open'}
LEDGER_NONFICTION = {'established', 'open', 'answered', 'promised'}
ANCHOR = re.compile(r'\b(\d{3}) p(\d+)(?:\s*[–-]\s*p?(\d+))?')
NOT_PROSE = {'type', 'chart', 'only', 'style', 'tag', 'svg', 'from', 'to', 'with', 'off', 'appears',
             'major', 'columns', 'id', 'number', 'guide', 'kind', 'file', 'written', 'skill', 'format', 'meta'}
# Words the guide may capitalise that are not names from the book.
ALWAYS_OK = {'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'Mr', 'Mrs', 'Ms', 'Dr', 'St',
             'Chapter', 'Chapters', 'Ch', 'Part', 'Parts', 'Prologue', 'Epilogue', 'Introduction',
             'Conclusion', 'Appendix', 'Preface', 'From'}


def fail(msg):
    print(f'check_guide: {msg}', file=sys.stderr)
    sys.exit(2)


def load_json(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        fail(f'not found: {path}')


# ------------------------------------------------------------------ the book's text

class Source:
    def __init__(self, work):
        self.dir = Path(work) / 'source'
        self.toc = load_json(self.dir / 'toc.json')
        self.by_n = {e['n']: e for e in self.toc}
        self._text = {}

    def paragraphs(self, n):
        e = self.by_n.get(n)
        return e['paragraphs'] if e else 0

    def text(self, n):
        if n not in self._text:
            e = self.by_n[n]
            raw = (self.dir / e['file']).read_text().replace('’', "'").replace('‘', "'")
            raw = re.sub(r'(?<=\d),(?=\d{3})', '', raw)  # 13,000 -> 13000
            raw = re.sub(r'(?<![A-Za-z])((?:[A-Z]\.){2,})', lambda m: m.group(1).replace('.', ''), raw)  # U.S. -> US
            self._text[n] = raw
        return self._text[n]

    def text_upto(self, last_n):
        return '\n'.join(self.text(e['n']) for e in self.toc if e['n'] <= last_n and e['kind'] != 'back')


# ------------------------------------------------------------------ the guide

def load_guide(books, guide):
    out = {}
    for style in STYLES:
        p = Path(books) / f'{guide}-{style}.json'
        if p.exists():
            out[style] = load_json(p)
    if 'map' not in out:
        fail(f'no Map file {Path(books) / f"{guide}-map.json"}')
    return out


def chapters(book):
    for part in book['parts']:
        for ch in part['chapters']:
            screens = ch.get('screens') or [s for sec in ch.get('sections', []) for s in sec['screens']]
            yield part, ch, screens


def written(book):
    return [(p, c, s) for p, c, s in chapters(book) if any(x.get('only') != 'pdf' for x in s)]


def strings(v, key=''):
    """Every prose string in a screen, with its key."""
    if key in NOT_PROSE:
        return
    if isinstance(v, str):
        yield key, v
    elif isinstance(v, list):
        for x in v:
            yield from strings(x, key)
    elif isinstance(v, dict):
        for k, x in v.items():
            yield from strings(x, k)


# ------------------------------------------------------------------ fact sheets

class Sheet:
    def __init__(self, path):
        self.path = path
        self.lines = path.read_text().splitlines()
        head = self.lines[0] if self.lines else ''
        m = re.search(r'source ([\d,\s–-]+)', head)
        self.sources = []
        if m:
            for a, b in re.findall(r'(\d{3})(?:\s*[–-]\s*(\d{3}))?', m.group(1)):
                self.sources += list(range(int(a), int(b or a) + 1))
        self.must = []
        section = None
        for i, line in enumerate(self.lines):
            if line.startswith('## '):
                section = line[3:].strip().lower()
                continue
            if section and section.startswith('must carry'):
                m = re.match(r'-\s*(M\d+)\s*·\s*(\w+)\s*·\s*(.+)$', line)
                if m:
                    self.must.append({'id': m.group(1), 'kind': m.group(2), 'text': m.group(3), 'q': None, 'line': i + 1})
                elif line.strip().startswith('Q:') and self.must:
                    self.must[-1]['q'] = line.strip()[2:].strip()


def check_anchor(src, sheet_sources, n, p, p2, where, say):
    if n not in sheet_sources:
        say(f'{where}: anchor {n:03d} p{p} is not one of this chapter\'s source files ({", ".join(f"{s:03d}" for s in sheet_sources)})')
        return None
    total = src.paragraphs(n)
    for q in (p, p2):
        if q is not None and not 1 <= q <= total:
            say(f'{where}: anchor {n:03d} p{q} does not exist (file {n:03d} has {total} paragraphs)')
            return None
    return p


def cmd_facts(args, guide, work, say):
    src = Source(work)
    book = guide['map']
    fiction = book['type'] == 'fiction'
    facts = Path(work) / 'facts'
    chapter_sources = {}
    for _, ch, _ in written(book):
        path = facts / f'{ch["id"]}.md'
        if not path.exists():
            say(f'{ch["id"]}: no fact sheet {path}')
            continue
        sheet = Sheet(path)
        if not sheet.sources:
            say(f'{path}: the first line needs "source NNN" (or "source NNN–NNN"): the chapter\'s text files')
            continue
        chapter_sources[ch['id']] = sheet.sources
        # Every anchor in the sheet points into this chapter's text.
        for i, line in enumerate(sheet.lines[1:], start=2):
            for a in ANCHOR.finditer(line):
                check_anchor(src, sheet.sources, int(a.group(1)), int(a.group(2)),
                             int(a.group(3)) if a.group(3) else None, f'{path}:{i}', say)
        # Must carry: 5-8 items, each with a kind, an anchor and a question.
        must = sheet.must
        if not MUST_MIN <= len(must) <= MUST_MAX:
            say(f'{path}: "## Must carry" needs {MUST_MIN}–{MUST_MAX} items (has {len(must)})')
        offsets, total, pos = {}, 0, []
        for n in sheet.sources:
            offsets[n] = total
            total += src.paragraphs(n)
        for m in must:
            where = f'{path}:{m["line"]} {m["id"]}'
            if m['kind'] not in KINDS:
                say(f'{where}: kind "{m["kind"]}" must be one of {", ".join(sorted(KINDS))}')
            if not m['q']:
                say(f'{where}: needs a question on the next line ("  Q: …")')
            a = ANCHOR.search(m['text'])
            if not a:
                say(f'{where}: needs an anchor ("005 p12")')
            elif m['kind'] != 'open' and int(a.group(1)) in offsets:
                pos.append((offsets[int(a.group(1))] + int(a.group(2))) / max(total, 1))
        # Spread over the chapter: summaries skip the middle and lean on the end.
        if total >= 20 and len(pos) >= 3:
            thirds = [sum(1 for x in pos if lo < x <= hi) for lo, hi in ((-1, 1 / 3), (1 / 3, 2 / 3), (2 / 3, 2))]
            if thirds[0] == 0 or thirds[1] == 0:
                say(f'{path}: no must-carry item from the {"first" if thirds[0] == 0 else "middle"} third of the chapter: read it again for what a reader needs from there')
            if thirds[2] > len(pos) / 2:
                say(f'{path}: {thirds[2]} of {len(pos)} must-carry items come from the last third: the end is over-weighted')
    # The ledger: one section per written chapter, anchored lines.
    ledger = Path(work) / 'ledger.md'
    if not ledger.exists():
        say(f'no ledger {ledger}')
        return
    current, seen = None, set()
    for i, line in enumerate(ledger.read_text().splitlines(), start=1):
        if line.startswith('## '):
            current = line[3:].strip()
            seen.add(current)
            continue
        if not line.startswith('- ') or current is None:
            continue
        where = f'{ledger}:{i}'
        a = ANCHOR.search(line)
        if not a:
            say(f'{where}: needs an anchor')
        elif current in chapter_sources:
            check_anchor(src, chapter_sources[current], int(a.group(1)), int(a.group(2)),
                         int(a.group(3)) if a.group(3) else None, where, say)
        kind = line[2:].split('·')[0].strip().lower()
        if fiction:
            if kind != 'time' and '→' not in line:
                say(f'{where}: a fiction ledger line is a change, "Person · field: old → new · anchor" (or "time · … · anchor")')
        elif kind not in LEDGER_NONFICTION:
            say(f'{where}: starts with one of {", ".join(sorted(LEDGER_NONFICTION))}')
    for _, ch, _ in written(book):
        if ch['id'] not in seen:
            say(f'{ledger}: no "## {ch["id"]}" section')


# ------------------------------------------------------------------ names and numbers

NAME = re.compile(r"[A-Z][\w'-]*")
NUMBER = re.compile(r'(?<![\w.])\d[\d,]*(?:\.\d+)?')


def candidates(text, label=False):
    """(kind, word, first) for capitalised words, and figures from 11 up. `first`: starts a
    sentence or an item. The first word of a label is the guide's own (sentence case): skipped."""
    t = re.sub(r'\*\*|[{}\[\]]', '', text.replace('’', "'").replace('‘', "'"))
    for seg in re.split(r'(?:^|(?<=[.!?:;·–—()"]))\s+|^', t):
        seg = seg.strip(' "(')
        for k, m in enumerate(NAME.finditer(seg)):
            w = re.sub(r"'s?$", '', m.group(0))
            first = m.start() == 0
            if first and label:
                label = False
                continue
            for part in w.split('-'):
                if part[:1].isupper() and len(part) > 1:
                    yield ('name', part, first and part == w.split('-')[0])
    for m in NUMBER.finditer(t):
        before = t[max(0, m.start() - 8):m.start()]
        if re.search(r'(Chapter|Ch|Part)\s$', before):
            continue
        v = m.group(0).replace(',', '').rstrip('.')
        try:
            if float(v) >= 11:
                yield ('number', v, False)
        except ValueError:
            pass


BRITISH = ((r'is(e|ed|es|ing|ation|ations)$', r'iz\1'), (r'our', 'or'), (r'tre$', 'ter'), (r'ence$', 'ense'),
           (r'([^l])ll(ed|ing|er)$', r'\1l\2'), (r'ogue$', 'og'))
ENDINGS = ('ations', 'ation', 'ings', 'ing', 'ness', 'less', 'ful', 'ers', 'er', 'ed', 'es', 'ly', 's', 'd', 'i', 'an', 'ese')


def forms(w):
    """The word, its American spelling, and stems without common endings (4 letters at least)."""
    out = {w}
    for a, b in BRITISH:
        out.add(re.sub(a, b, w))
    for f in list(out):
        for end in ENDINGS:
            if f.endswith(end) and len(f) - len(end) >= 4:
                out.add(f[:-len(end)])
                if f[-len(end) - 1:-len(end)] == f[-len(end) - 2:-len(end) - 1]:
                    out.add(f[:-len(end) - 1])  # admitting -> admit
    return out


def in_book(kind, w, first, text, whole):
    """`text`: the book up to the chapter; `whole`: the whole book (body, front matter)."""
    if kind == 'number':
        return re.search(rf'(?<![\d.]){re.escape(w)}(?![\d])', text) is not None
    for f in forms(w):
        if len(f) < 2:
            continue
        if re.search(rf'\b{re.escape(f)}', text):
            return True
        # A word that starts a sentence or an item is an ordinary word when the book writes it in
        # lower case somewhere; a name the book always capitalises must be there by this chapter.
        if first and re.search(rf'\b{re.escape(f.lower())}', whole):
            return True
    return False


def cmd_names(args, guide, work, say):
    src = Source(work)
    ok_file = Path(work) / 'names-ok.txt'
    ok = set(ALWAYS_OK)
    if ok_file.exists():
        ok |= {l.strip() for l in ok_file.read_text().splitlines() if l.strip() and not l.startswith('#')}
    facts = Path(work) / 'facts'
    last_source = {}
    for _, ch, _ in written(guide['map']):
        p = facts / f'{ch["id"]}.md'
        if not p.exists():
            fail(f'no fact sheet {p}: the names check needs each chapter\'s "source" line')
        s = Sheet(p).sources
        if not s:
            fail(f'{p}: no "source NNN" on the first line')
        last_source[ch['id']] = max(s)
    cache = {}
    whole = src.text_upto(max(e['n'] for e in src.toc))
    for style, book in guide.items():
        for _, ch, screens in written(book):
            if ch['id'] not in last_source:
                continue
            n = last_source[ch['id']]
            if n not in cache:
                cache[n] = src.text_upto(n)
            text = cache[n]
            missing = {}
            for s in screens:
                for key, string in strings(s):
                    for kind, w, first in candidates(string, label=key == 'label'):
                        if w in ok or (kind, w) in missing:
                            continue
                        if not in_book(kind, w, first, text, whole):
                            missing[(kind, w)] = string
            for (kind, w), string in missing.items():
                say(f'{book["id"]} {ch["id"]}: {kind} "{w}" is not in the book up to this chapter (in "{string[:60]}")')


# ------------------------------------------------------------------ the guide as text

def screen_text(s):
    t = s['type']
    lines = [f'[{s.get("label") or t}]' + (' (PDF only)' if s.get('only') == 'pdf' else '')]
    if t == 'summary':
        lines.append(s['text'])
        if s.get('takeaway'):
            lines.append(f'{s["takeaway"]["label"]}: {s["takeaway"]["text"]}')
    elif t == 'points':
        lines += [f'- {i["title"]}: {i["text"]}' for i in s['items']]
    elif t == 'steps':
        lines += [f'{k}. {x}' for k, x in enumerate(s['steps'], 1)]
    elif t == 'list':
        lines += [f'- {r["name"]}: {r["text"]}' for r in s['rows']]
    elif t == 'quiz':
        lines += [f'Q: {q["q"]}\n   A: {q["a"]}' for q in s['questions']]
    elif t == 'text':
        lines += s['paragraphs']
    elif t == 'scenes':
        for k, sc in enumerate(s['scenes'], 1):
            lines.append(f'{k}. {sc["text"]} (with: {", ".join(sc.get("with", []))}'
                         + (f'; at a distance: {", ".join(sc["off"])}' if sc.get('off') else '') + ')')
    elif t == 'figure':
        lines.append(f'(figure) {s.get("alt", "")} {s.get("caption", "")}')
    elif t == 'chart':
        c = s['chart']
        if c == 'flow':
            lines.append(f'Start: {s.get("start", "")}')
            for g in s['groups']:
                lines.append((f'{g["label"]}: ' if g.get('label') else '') + ' → '.join(g['items']))
        elif c == 'compare':
            lines.append(' | '.join(s['columns']))
            lines += [' | '.join(r) for r in s['rows']]
        elif c == 'matrix':
            lines.append('Columns: ' + ', '.join(s['columns']))
            lines += [f'- {r["label"]}: ' + ', '.join(col for col, v in zip(s['columns'], r['cells']) if v) for r in s['rows']]
        elif c == 'network':
            lines.append('Centre: ' + ', '.join(s['centre']))
            lines.append('Nodes: ' + ', '.join(n['name'] + (f' ({n["note"]})' if n.get('note') else '') for n in s['nodes']))
            lines += [f'- {l["from"]} → {l["to"]}' + (f': {l["label"]}' if l.get('label') else '') for l in s['links']]
        elif c == 'timeline':
            lines += [f'- {i.get("when", "")}: ' + (f'{i["title"]}. ' if i.get('title') else '') + i['text'] for i in s['items']]
        elif c == 'cycle':
            lines.append(' → '.join(n['title'] + (f' ({n["text"]})' if n.get('text') else '') for n in s['nodes']) + ' → (back to start)')
        elif c == 'branches':
            lines.append(f'Start: {s.get("start", "")}')
            lines += [f'- {o["title"]}: {o.get("text", "")}' for o in s['options']]
        elif c == 'layers':
            lines += [f'- {r["title"]}' + (f': {r["text"]}' if r.get('text') else '') for r in s['rings']]
        elif c == 'bars':
            lines += [f'- {d["label"]}: {d["value"]}' for d in s['data']]
        elif c == 'threads':
            lines += [f'- {th["name"]}: {th.get("text", "")}' for th in s['threads']]
        if s.get('key'):
            lines.append(f'Key: {s["key"]}')
        if s.get('caption'):
            lines.append(f'({s["caption"]})')
    return '\n'.join(lines)


def guide_text(book, upto=None, pdf=False):
    out = [f'# {book["title"]} · {book.get("style", "map")}']
    ids = [c['id'] for _, c, _ in chapters(book)]
    if upto and upto not in ids:
        fail(f'no chapter "{upto}" (chapters: {", ".join(ids)})')
    for part, ch, screens in chapters(book):
        shown = [s for s in screens if pdf or s.get('only') != 'pdf']
        if shown:
            kicker = ' · '.join(x for x in (part.get('label'), part.get('title')) if x)
            out.append(f'\n## {ch["title"]}' + (f' ({kicker})' if kicker else '') + f' [{ch["id"]}]')
            out += [screen_text(s) for s in shown if s.get('only') != 'app' or not pdf]
        if ch['id'] == upto:
            break
    return '\n\n'.join(out)


def cmd_text(args, guide, work, say):
    style = args.style or 'map'
    if style not in guide:
        fail(f'no {style} file')
    print(guide_text(guide[style], args.upto, args.pdf))


def cmd_test(args, guide, work, say):
    if not args.upto:
        fail('test needs --upto <chapter-id>')
    style = args.style or 'map'
    book = guide[style]
    facts = Path(work) / 'facts'
    questions, key = [], []
    for _, ch, _ in written(book):
        sheet = Sheet(facts / f'{ch["id"]}.md')
        for m in sheet.must:
            k = len(questions) + 1
            questions.append(f'{k}. ({ch["title"]}) {m["q"]}')
            key.append(f'{k}. [{ch["id"]} {m["id"]} · {m["kind"]}] {m["q"]}\n   Answer: {m["text"]}')
        if ch['id'] == args.upto:
            break
    out_dir = Path(work) / 'recall-test'
    out_dir.mkdir(exist_ok=True)
    test = out_dir / f'{style}-{args.upto}.md'
    test.write_text(
        '# Blind recall test\n\nAnswer every question using ONLY the guide below. Do not use anything '
        'you know about the book. When the guide does not give the answer, write "Not in the guide". '
        'One or two sentences per answer.\n\n# Questions\n\n' + '\n'.join(questions)
        + '\n\n---\n\n' + guide_text(book, args.upto) + '\n')
    (out_dir / f'{style}-{args.upto}-key.md').write_text('# Answer key\n\n' + '\n'.join(key) + '\n')
    print(f'wrote {test} ({len(questions)} questions) and its key {out_dir / f"{style}-{args.upto}-key.md"}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['facts', 'names', 'text', 'test'])
    ap.add_argument('guide', help='the guide id, e.g. nexus-summary')
    ap.add_argument('--work', help='work folder (default work/<guide>)')
    ap.add_argument('--books', default='src/books')
    ap.add_argument('--style', choices=STYLES)
    ap.add_argument('--upto', help='last chapter id (text, test)')
    ap.add_argument('--pdf', action='store_true', help='text: add the PDF-only blocks')
    args = ap.parse_args()
    work = args.work or f'work/{args.guide}'
    guide = load_guide(args.books, args.guide)
    problems = []
    {'facts': cmd_facts, 'names': cmd_names, 'text': cmd_text, 'test': cmd_test}[args.command](args, guide, work, problems.append)
    for p in problems:
        print(p)
    if args.command in ('facts', 'names'):
        print(f'{len(problems)} problem(s)' if problems else 'clean', file=sys.stderr)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
