#!/usr/bin/env python3
"""Checks a Ghostreader guide against the book's text and its working files (references/verify.md).

The work folder (work/<guide>/, never committed) holds JSON files, one schema each in schemas/
(references/working-files.md): source/ (extract_book.py: toc.json and one text file per
section), plan.json, facts/<chapter-id>.json, ledger/<chapter-id>.json, concepts.json,
styles.json, verdicts/<chapter-id>.json and recall-test/. The guide is the four files
src/books/<guide>-{map,recap,recall,layers}.json.

Commands (run from the repository root):

  schema <guide>       Every working file matches its schema.
  plan <guide>         plan.json against toc.json and the Map file: every chapter of the book, in
                       order, under its own title; every body section used or skipped with a reason.
  facts <guide>        Fact sheets and ledger: every anchor exists in the chapter's own text files
                       and its quote is in the anchored paragraphs; each fact has the fields its type
                       needs; 5-8 must-carry items spread over the chapter; a ledger file per chapter.
  names <guide>        Every name and every number from 11 up on a chapter's screens, in all four
                       styles, is in the book's text up to and including that chapter. It finds
                       outside facts, wrong forms of names, and spoilers (a name the book has not
                       given yet). Confirmed exceptions go one per line in work/<guide>/names-ok.txt.
  concepts <guide>     Writes concepts.json from the fact sheets (keeps each "core" mark), then
                       checks that each concept is named on a screen of the chapter that introduces it.
  text <guide>         The guide as plain text, for a judge: --style (default map), --upto
                       <chapter-id> (inclusive), --pdf to add the PDF-only blocks. Every screen has
                       an id, "ch3.s2" (chapter ch3, screen 2 of the chapter in the book file).
  test <guide>         The blind recall test, for --style and --upto: writes
                       recall-test/<style>-<chapter>.md (the questions, then the guide's app screens)
                       and -key.json with the answers.
  verdicts <guide>     The judges' files verdicts/<chapter-id>.json: no unsupported or inferred
                       claim, every must-carry item on a screen of every style, resume screens right.
  score <guide>        Adds up recall-test/<style>-<chapter>-score.json for --style and --upto; an
                       answer without a screen of the test scores zero. Pass: 80% overall, 60% per
                       chapter.
  render <guide>       Markdown views of the working files in work/<guide>/view/, for people.

Options: --work DIR (default work/<guide>), --books DIR (default src/books), --schemas DIR
(default the repository's schemas/), --json (the result as {"command", "guide", "clean",
"problems": [{"rule", "where", "message"}]}, plus "scores" for score).
Each problem line starts with its rule ID (spec/rules.md): "GR-A02 <where>: <message>".
Exit codes: 0 = clean, 1 = problems found (each line says what to fix), 2 = cannot run.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # schema_lite.py, next to this file
from schema_lite import SchemaError, validate  # noqa: E402

STYLES = ('map', 'recap', 'recall', 'layers')
MUST_MIN, MUST_MAX = 5, 8
QUOTE_MIN, QUOTE_MAX = 3, 12
PASS_ALL, PASS_CHAPTER = 0.8, 0.6
NEEDS = {  # fields a fact of each type must have (GR-A06)
    'scene': ('with',), 'person': ('who', 'role'), 'relation': ('who', 'to'), 'state': ('who',),
    'concept': ('concept',),
}
NOT_PROSE = {'type', 'chart', 'only', 'style', 'tag', 'svg', 'from', 'to', 'with', 'off', 'appears',
             'major', 'columns', 'id', 'number', 'guide', 'kind', 'file', 'written', 'skill', 'format', 'meta'}
# Words the guide may capitalise that are not names from the book.
ALWAYS_OK = {'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'Mr', 'Mrs', 'Ms', 'Dr', 'St',
             'Chapter', 'Chapters', 'Ch', 'Part', 'Parts', 'Prologue', 'Epilogue', 'Introduction',
             'Conclusion', 'Appendix', 'Preface', 'From'}
REPO = Path(__file__).resolve().parents[4]


def fail(msg):
    print(f'check_guide: {msg}', file=sys.stderr)
    sys.exit(2)


def load_json(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        fail(f'not found: {path}')
    except json.JSONDecodeError as e:
        fail(f'{path}: not valid JSON ({e})')


def norm(s):
    """Text as the quote check compares it: same quotes and dashes, no thousands separators,
    one space, lower case."""
    s = s.replace('’', "'").replace('‘', "'").replace('“', '').replace('”', '').replace('"', '')
    s = s.replace('…', '...').replace('—', '-').replace('–', '-')
    s = re.sub(r'(?<=\d),(?=\d{3})', '', s)
    return re.sub(r'\s+', ' ', s).strip().lower()


def fmt_anchor(a):
    p1, p2 = a['p']
    return f'{a["file"]} p{p1}' + (f'–p{p2}' if p2 != p1 else '')


# ------------------------------------------------------------------ the book's text

class Source:
    def __init__(self, work):
        self.dir = Path(work) / 'source'
        self.toc = load_json(self.dir / 'toc.json')
        self.by_n = {e['n']: e for e in self.toc}
        self._text = {}
        self._paras = {}

    def has(self, n):
        return n in self.by_n

    def paragraphs(self, n):
        e = self.by_n.get(n)
        return e['paragraphs'] if e else 0

    def para(self, n, p):
        """Paragraph p of file n, as extract_book.py wrote it ("[p12] text")."""
        if n not in self._paras:
            lines = (self.dir / self.by_n[n]['file']).read_text().splitlines()
            self._paras[n] = {int(m.group(1)): m.group(2) for m in (re.match(r'^\[p(\d+)\] (.*)$', l) for l in lines) if m}
        return self._paras[n].get(p, '')

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


# ------------------------------------------------------------------ working files

class Work:
    """The JSON working files of one guide, each checked against its schema when it is read."""

    def __init__(self, args, guide_id, say):
        self.dir = Path(args.work or f'work/{guide_id}')
        self.schemas = Path(args.schemas) if args.schemas else REPO / 'schemas'
        self.say = say
        self._schema = {}

    def schema(self, name):
        if name not in self._schema:
            self._schema[name] = load_json(self.schemas / f'{name}.schema.json')
        return self._schema[name]

    def check(self, path, name):
        """Schema problems of one file (GR-F04); True when it is valid."""
        try:
            errors = validate(load_json(path), self.schema(name))
        except SchemaError as e:
            fail(f'{name}.schema.json: {e}')
        for e in errors:
            self.say('GR-F04', str(path), f'{e} (schemas/{name}.schema.json)')
        return not errors

    def read(self, rel, name, missing=None):
        """A working file, or None when it is missing (problem `missing`, a (rule, message) pair)
        or does not match its schema."""
        path = self.dir / rel
        if not path.exists():
            if missing:
                self.say(missing[0], str(path), missing[1])
            return None
        return load_json(path) if self.check(path, name) else None

    def facts(self, cid, report=True):
        md = self.dir / 'facts' / f'{cid}.md'
        if report and md.exists() and not (self.dir / 'facts' / f'{cid}.json').exists():
            self.say('GR-A01', str(md), 'fact sheets are JSON files now (facts/<chapter-id>.json, references/working-files.md)')
            return None
        return self.read(f'facts/{cid}.json', 'facts', ('GR-A01', 'no fact sheet') if report else None)


FILES = (  # working file pattern -> schema
    ('intake.json', 'intake'), ('plan.json', 'plan'), ('facts/*.json', 'facts'),
    ('ledger/*.json', 'ledger'), ('concepts.json', 'concepts'), ('styles.json', 'styles'),
    ('verdicts/*.json', 'verdict'), ('recall-test/*-key.json', 'recall-key'),
    ('recall-test/*-answers.json', 'recall-answers'), ('recall-test/*-score.json', 'recall-score'),
)


def cmd_schema(args, guide, w, say):
    n = 0
    for pattern, name in FILES:
        for path in sorted(w.dir.glob(pattern)):
            w.check(path, name)
            n += 1
    for path in sorted(w.dir.glob('facts/*.md')) + ([w.dir / 'ledger.md'] if (w.dir / 'ledger.md').exists() else []):
        say('GR-F04', str(path), 'a Markdown working file: write it as JSON (references/working-files.md)')
    if not n:
        say('GR-F04', str(w.dir), 'no working files found')


def screen_refs(book):
    """chapter id -> {"ch3.s2": screen}: every screen of the chapter, numbered from 1 as in the file."""
    out = {}
    for _, ch, screens in chapters(book):
        out[ch['id']] = {f'{ch["id"]}.s{i}': s for i, s in enumerate(screens, 1)}
    return out


def chapter_text(book, cid):
    for _, ch, screens in chapters(book):
        if ch['id'] == cid:
            return '\n'.join(t for s in screens for _, t in strings(s))
    return ''


# ------------------------------------------------------------------ plan

def cmd_plan(args, guide, w, say):
    plan = w.read('plan.json', 'plan', ('GR-S01', 'no plan'))
    if not plan:
        return
    src = Source(w.dir)
    book = guide['map']
    where = str(w.dir / 'plan.json')
    used = {}
    for part in plan['parts']:
        for ch in part['chapters']:
            for f in ch['sources']:
                if not src.has(int(f)):
                    say('GR-S01', f'{where} {ch["id"]}', f'text file {f} is not in toc.json')
                if f in used:
                    say('GR-S01', f'{where} {ch["id"]}', f'text file {f} is also in {used[f]}')
                used[f] = ch['id']
    skipped = {s['file'] for s in plan.get('skipped', [])}
    for e in src.toc:
        f = f'{e["n"]:03d}'
        if e.get('kind') == 'body' and f not in used and f not in skipped:
            say('GR-S01', where, f'text file {f} ("{e["title"]}") is in no chapter: add it, or list it in "skipped" with the reason')
    # The Map file has exactly the plan's parts and chapters, in order.
    shape = lambda parts: [(p['id'], p.get('label'), p.get('title'), [(c['id'], c['number'], c['title']) for c in p['chapters']]) for p in parts]
    planned, made = shape(plan['parts']), shape(book['parts'])
    for i in range(max(len(planned), len(made))):
        x = planned[i] if i < len(planned) else None
        y = made[i] if i < len(made) else None
        if x != y:
            say('GR-S01', book['id'], f'part {i + 1} differs from the plan: plan {x}, Map file {y}')
            break
    for key in ('type', 'title'):
        if plan.get(key) != book.get(key):
            say('GR-S01', book['id'], f'"{key}" is "{book.get(key)}" but the plan has "{plan.get(key)}"')
    # Non-fiction: "The question" says the book's question in the same words in every chapter.
    if book['type'] != 'fiction' and plan.get('question'):
        for style, b in guide.items():
            for _, ch, screens in written(b):
                for s in screens:
                    if s.get('label') == 'Where it stands':
                        q = next((i['text'] for i in s['items'] if i['title'] == 'The question'), None)
                        if q is not None and norm(q).rstrip('?.') != norm(plan['question']).rstrip('?.'):
                            say('GR-W07', f'{b["id"]} {ch["id"]}', f'"The question" is "{q}"; the plan has "{plan["question"]}": use the same words')


# ------------------------------------------------------------------ fact sheets and ledger

def check_anchor(src, sources, a, where, say):
    n, (p1, p2) = int(a['file']), a['p']
    if a['file'] not in sources:
        say('GR-A02', where, f'anchor {fmt_anchor(a)} is not in one of this chapter\'s text files ({", ".join(sources)})')
        return None
    total = src.paragraphs(n)
    if p2 < p1 or not 1 <= p1 <= total or not 1 <= p2 <= total:
        say('GR-A02', where, f'anchor {fmt_anchor(a)} does not exist (file {a["file"]} has {total} paragraphs)')
        return None
    words = len(a['quote'].split())
    if not QUOTE_MIN <= words <= QUOTE_MAX:
        say('GR-A05', where, f'the quote has {words} words: copy {QUOTE_MIN}–{QUOTE_MAX} words exactly')
    elif not any(norm(a['quote']) in norm(src.para(n, p)) for p in range(p1, p2 + 1)):
        say('GR-A05', where, f'the quote "{a["quote"][:50]}" is not in {fmt_anchor(a)}: find the right paragraph, or remove the fact')
    return p1


def cmd_facts(args, guide, w, say):
    src = Source(w.dir)
    book = guide['map']
    fiction = book['type'] == 'fiction'
    for _, ch, _ in written(book):
        cid = ch['id']
        sheet = w.facts(cid)
        if not sheet:
            continue
        path = str(w.dir / 'facts' / f'{cid}.json')
        if sheet['chapter'] != cid:
            say('GR-A01', path, f'"chapter" is "{sheet["chapter"]}"; the file is for {cid}')
        sources = sheet['sources']
        bad = [f for f in sources if not src.has(int(f))]
        if bad:
            say('GR-A01', path, f'text file(s) {", ".join(bad)} are not in toc.json')
            continue
        # Facts: unique ids, anchors that hold, the fields each type needs.
        ids, pos = {}, {}
        offsets, total = {}, 0
        for f in sources:
            offsets[f] = total
            total += src.paragraphs(int(f))
        for i, fact in enumerate(sheet['facts']):
            where = f'{path} facts[{i}] {fact["id"]}'
            if fact['id'] in ids:
                say('GR-A06', where, f'the id {fact["id"]} is used twice')
            ids[fact['id']] = fact
            p = check_anchor(src, sources, fact['anchor'], where, say)
            if p is not None:
                pos[fact['id']] = (offsets[fact['anchor']['file']] + p) / max(total, 1)
            for field in NEEDS.get(fact['type'], ()):
                if not fact.get(field):
                    say('GR-A06', where, f'a {fact["type"]} fact needs "{field}"')
            if fact['type'] == 'scene' and not (fact.get('when') or fact.get('where')):
                say('GR-A06', where, 'a scene needs the "when" or the "where" the book gives (or both)')
        # Must carry: 5-8 items on known facts, spread over the chapter.
        must = sheet['must_carry']
        if not MUST_MIN <= len(must) <= MUST_MAX:
            say('GR-M01', path, f'"must_carry" needs {MUST_MIN}–{MUST_MAX} items (has {len(must)})')
        spread, seen = [], set()
        for m in must:
            where = f'{path} must_carry {m["id"]}'
            if m['id'] in seen:
                say('GR-M01', where, f'the id {m["id"]} is used twice')
            seen.add(m['id'])
            unknown = [f for f in m['facts'] if f not in ids]
            if unknown:
                say('GR-M01', where, f'refers to unknown fact(s) {", ".join(unknown)}')
            elif m['kind'] != 'open' and m['facts'][0] in pos:
                spread.append(pos[m['facts'][0]])
        # Summaries skip the middle and lean on the end.
        if total >= 20 and len(spread) >= 3:
            thirds = [sum(1 for x in spread if lo < x <= hi) for lo, hi in ((-1, 1 / 3), (1 / 3, 2 / 3), (2 / 3, 2))]
            if thirds[0] == 0 or thirds[1] == 0:
                say('GR-M02', path, f'no must-carry item from the {"first" if thirds[0] == 0 else "middle"} third of the chapter: read it again for what a reader needs from there')
            if thirds[2] > len(spread) / 2:
                say('GR-M02', path, f'{thirds[2]} of {len(spread)} must-carry items come from the last third: the end is over-weighted')
        # The ledger of the chapter.
        ledger = w.read(f'ledger/{cid}.json', 'ledger', ('GR-A03', 'no ledger file for this chapter'))
        if not ledger:
            continue
        lpath = str(w.dir / 'ledger' / f'{cid}.json')
        if ledger['chapter'] != cid:
            say('GR-A03', lpath, f'"chapter" is "{ledger["chapter"]}"; the file is for {cid}')
        for i, e in enumerate(ledger['entries']):
            where = f'{lpath} entries[{i}]'
            check_anchor(src, sources, e['anchor'], where, say)
            if fiction:
                if 'status' in e or not e.get('dimension') or not e.get('after'):
                    say('GR-A04', where, 'a fiction entry is a change: "dimension", "after" (and "before", "cause" when known), no "status"')
                elif e['dimension'] not in ('time', 'place') and not e.get('entity'):
                    say('GR-A04', where, f'a "{e["dimension"]}" entry needs the "entity" that changes')
            elif not e.get('status') or not e.get('text') or 'dimension' in e:
                say('GR-A04', where, 'a non-fiction entry has "status" (established, open, answered or promised) and "text"')


# ------------------------------------------------------------------ names and numbers

NAME = re.compile(r"(?<![\w'-])[A-Z][\w'-]*")
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
    out.add(re.sub(r'i(er|est|es|ed)$', 'y', w))  # mightier -> mighty, studies -> study
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


def cmd_names(args, guide, w, say):
    src = Source(w.dir)
    ok_file = w.dir / 'names-ok.txt'
    ok = set(ALWAYS_OK)
    if ok_file.exists():
        ok |= {l.strip() for l in ok_file.read_text().splitlines() if l.strip() and not l.startswith('#')}
    last_source = {}
    for _, ch, _ in written(guide['map']):
        sheet = w.facts(ch['id'], report=False)
        if not sheet:
            fail(f'no valid fact sheet {w.dir / "facts" / (ch["id"] + ".json")}: the names check needs each chapter\'s "sources"')
        last_source[ch['id']] = max(int(f) for f in sheet['sources'])
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
                    for kind, word, first in candidates(string, label=key == 'label'):
                        if word in ok or (kind, word) in missing:
                            continue
                        if not in_book(kind, word, first, text, whole):
                            missing[(kind, word)] = string
            for (kind, word), string in missing.items():
                say('GR-C02', f'{book["id"]} {ch["id"]}', f'{kind} "{word}" is not in the book up to this chapter (in "{string[:60]}")')


# ------------------------------------------------------------------ concepts

def cmd_concepts(args, guide, w, say):
    book = guide['map']
    old = {}
    path = w.dir / 'concepts.json'
    if path.exists() and w.check(path, 'concepts'):
        old = {(c['name'], c['chapter']): c for c in load_json(path)['concepts']}
    found = []
    for _, ch, _ in written(book):
        sheet = w.facts(ch['id'], report=False)
        for fact in (sheet or {}).get('facts', []):
            if fact['type'] == 'concept' and fact.get('concept'):
                c = fact['concept']
                prev = old.get((c['name'], ch['id']), {})
                found.append({'name': c['name'], 'kind': c['kind'], 'mode': c['mode'], 'chapter': ch['id'],
                              'fact': fact['id'], 'core': prev.get('core', False)})
                # Shown, not only named: the concept's name, or every member's, on a screen of its chapter.
                text = norm(chapter_text(book, ch['id']))
                names = [c['name']] if norm(c['name']) in text else [m['name'] for m in c['members'] if norm(m['name']) in text]
                if not names or (names != [c['name']] and len(names) < len(c['members'])):
                    say('GR-V05', f'{book["id"]} {ch["id"]}', f'concept "{c["name"]}" ({fact["id"]}) is not on a screen of its chapter: give it a chart, a key point or a "Terms" row, under the same name')
    path.write_text(json.dumps({'concepts': found}, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {path}: {len(found)} concept(s); mark "core": true on the ones later chapters build on', file=sys.stderr)


# ------------------------------------------------------------------ the guide as text

def screen_text(s, ref=''):
    t = s['type']
    lines = [f'[{ref + " · " if ref else ""}{s.get("label") or t}]' + (' (PDF only)' if s.get('only') == 'pdf' else '')]
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
        shown = [(f'{ch["id"]}.s{i}', s) for i, s in enumerate(screens, 1)
                 if (s.get('only') != 'pdf' or pdf) and not (pdf and s.get('only') == 'app')]
        if shown:
            kicker = ' · '.join(x for x in (part.get('label'), part.get('title')) if x)
            out.append(f'\n## {ch["title"]}' + (f' ({kicker})' if kicker else '') + f' [{ch["id"]}]')
            out += [screen_text(s, ref) for ref, s in shown]
        if ch['id'] == upto:
            break
    return '\n\n'.join(out)


def app_refs(book, upto):
    """The screen ids a recall test shows: app screens up to the chapter."""
    refs = set()
    for _, ch, screens in chapters(book):
        refs |= {f'{ch["id"]}.s{i}' for i, s in enumerate(screens, 1) if s.get('only') != 'pdf'}
        if ch['id'] == upto:
            break
    return refs


def cmd_text(args, guide, w, say):
    style = args.style or 'map'
    if style not in guide:
        fail(f'no {style} file')
    print(guide_text(guide[style], args.upto, args.pdf))


def cmd_test(args, guide, w, say):
    if not args.upto:
        fail('test needs --upto <chapter-id>')
    style = args.style or 'map'
    if style not in guide:
        fail(f'no {style} file')
    book = guide[style]
    key = []
    for _, ch, _ in written(book):
        sheet = w.facts(ch['id'], report=False)
        if not sheet:
            fail(f'no valid fact sheet for {ch["id"]}: run check_guide.py facts first')
        for m in sheet['must_carry']:
            key.append({'n': len(key) + 1, 'chapter': ch['id'], 'must': m['id'], 'kind': m['kind'],
                        'question': m['question'], 'answer': m['text']})
        if ch['id'] == args.upto:
            break
    titles = {c['id']: c['title'] for _, c, _ in chapters(book)}
    out = w.dir / 'recall-test'
    out.mkdir(parents=True, exist_ok=True)
    stem = f'{style}-{args.upto}'
    (out / f'{stem}.md').write_text(
        '# Blind recall test\n\nAnswer every question using ONLY the guide below. Do not use anything '
        'you know about the book. One or two sentences per answer. For every answer, give the id of '
        'the screen it comes from (in square brackets before each screen, for example "ch3.s2"). When '
        'the guide does not give the answer, write "Not in the guide" and no screen. Reply with JSON '
        'only, in this form (schemas/recall-answers.schema.json):\n\n'
        '{"answers": [{"n": 1, "answer": "…", "screen": "ch1.s2"}, {"n": 2, "answer": "Not in the guide", "screen": null}]}\n\n'
        '# Questions\n\n' + '\n'.join(f'{q["n"]}. ({titles[q["chapter"]]}) {q["question"]}' for q in key)
        + '\n\n---\n\n' + guide_text(book, args.upto) + '\n')
    (out / f'{stem}-key.json').write_text(json.dumps({'guide': args.guide, 'style': style, 'upto': args.upto,
                                                      'questions': key}, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {out / (stem + ".md")} ({len(key)} questions) and its key {out / (stem + "-key.json")}', file=sys.stderr)


# ------------------------------------------------------------------ judges' files

def cmd_verdicts(args, guide, w, say):
    refs = {style: screen_refs(b) for style, b in guide.items()}
    for _, ch, _ in written(guide['map']):
        cid = ch['id']
        sheet = w.facts(cid, report=False)
        v = w.read(f'verdicts/{cid}.json', 'verdict', ('GR-C01', 'no verdict: run the claim check (references/verify.md, checks 3 and 4)'))
        if v:
            path = str(w.dir / 'verdicts' / f'{cid}.json')
            if v['chapter'] != cid:
                say('GR-F04', path, f'"chapter" is "{v["chapter"]}"; the file is for {cid}')
            for c in v['claims']:
                where = f'{path} {c["style"]} {c["screen"]}'
                if c['style'] in refs and c['screen'] not in refs[c['style']].get(cid, {}):
                    say('GR-F04', where, f'no screen {c["screen"]} in chapter {cid} of the {c["style"]} file')
                if c['verdict'] != 'supported':
                    act = 'fix it or remove it' if c['verdict'] == 'unsupported' else 'soften it or remove it, unless the text states it'
                    say('GR-C01', where, f'{c["verdict"]}: "{c["claim"]}"' + (f' ({c["note"]})' if c.get('note') else '') + f': {act}')
            checked = {m['id']: m for m in v['must_carry']}
            for m in (sheet or {}).get('must_carry', []):
                if m['id'] not in checked:
                    say('GR-M03', f'{path} {m["id"]}', 'not checked: the verdict needs every must-carry item of the chapter')
                    continue
                for style in STYLES:
                    at = checked[m['id']][style]
                    if at == 'missing':
                        say('GR-M03', f'{path} {m["id"]}', f'missing in {style}: put "{m["text"][:60]}" on a screen that style shows ("Key points" first)')
                    elif style in refs and at not in refs[style].get(cid, {}):
                        say('GR-F04', f'{path} {m["id"]}', f'no screen {at} in chapter {cid} of the {style} file')
            r = v['resume']
            if not r['matches_ledger']:
                say('GR-R04', path, '"Where it stands" or "Still open" does not match the ledger at the chapter\'s end')
            for x in r['later_facts']:
                say('GR-R04', path, f'from a later chapter, or a hint of an answer: {x}')
            for x in r['names_without_role']:
                say('GR-W06', path, f'"{x}" has no role at its first mention')
        if ch['id'] == args.upto:
            break


def cmd_score(args, guide, w, say):
    if not args.upto:
        fail('score needs --upto <chapter-id>')
    style = args.style or 'map'
    stem = f'recall-test/{style}-{args.upto}'
    key = w.read(f'{stem}-key.json', 'recall-key', ('GR-M04', 'no key: run check_guide.py test first'))
    answers = w.read(f'{stem}-answers.json', 'recall-answers', ('GR-M04', 'no answers: give the test to an isolated reader'))
    scores = w.read(f'{stem}-score.json', 'recall-score', ('GR-M04', 'no score: give the answers and the key to an isolated scorer'))
    if not (key and answers and scores):
        return None
    shown = app_refs(guide[style], args.upto)
    ans = {a['n']: a for a in answers['answers']}
    sc = {s['n']: s for s in scores['scores']}
    by_chapter, total = {}, []
    for q in key['questions']:
        a, s = ans.get(q['n']), sc.get(q['n'])
        if a is None or s is None:
            say('GR-M04', f'{w.dir / stem} question {q["n"]}', 'no answer' if a is None else 'no score')
        points = 0.0 if not a or not s or a['screen'] not in shown else float(s['score'])
        total.append(points)
        by_chapter.setdefault(q['chapter'], []).append(points)
    pct = lambda xs: sum(xs) / len(xs) if xs else 0.0
    result = {'style': style, 'upto': args.upto, 'score': round(pct(total), 3),
              'chapters': {c: round(pct(xs), 3) for c, xs in by_chapter.items()}}
    if result['score'] < PASS_ALL:
        say('GR-M04', f'{style} up to {args.upto}', f'{result["score"]:.0%} of the points; at least {PASS_ALL:.0%}: carry each missed fact on a screen this style shows')
    for c, x in result['chapters'].items():
        if x < PASS_CHAPTER:
            say('GR-M04', f'{style} {c}', f'{x:.0%} of the points; at least {PASS_CHAPTER:.0%} per chapter')
    if not args.json:
        print(f'{style} up to {args.upto}: {result["score"]:.0%} · ' + ' · '.join(f'{c} {x:.0%}' for c, x in result['chapters'].items()))
    return result


# ------------------------------------------------------------------ views for people

def cmd_render(args, guide, w, say):
    view = w.dir / 'view'
    view.mkdir(parents=True, exist_ok=True)
    for _, ch, _ in written(guide['map']):
        sheet = w.facts(ch['id'], report=False)
        if not sheet:
            continue
        lines = [f'# {ch["id"]} · {ch["title"]} · source {", ".join(sheet["sources"])}', '', '## Facts']
        for f in sheet['facts']:
            extra = ', '.join(f'{k}: {", ".join(v) if isinstance(v, list) else v}' for k, v in f.items()
                              if k in ('when', 'where', 'with', 'off', 'who', 'to', 'role') and v)
            lines.append(f'- {f["id"]} · {f["type"]} · {f["basis"]} · {f["text"]}' + (f' ({extra})' if extra else '') + f' · {fmt_anchor(f["anchor"])}')
            if f.get('concept'):
                c = f['concept']
                lines.append(f'  {{{c["name"]}}} {c["kind"]} · {c["mode"]} · ' + ' / '.join(f'{m["name"]} ({m["definition"]})' for m in c['members']))
        lines += ['', '## Must carry']
        for m in sheet['must_carry']:
            lines.append(f'- {m["id"]} · {m["kind"]} · {m["text"]} · {", ".join(m["facts"])}\n  Q: {m["question"]}')
        ledger_path = w.dir / 'ledger' / f'{ch["id"]}.json'
        if ledger_path.exists():
            lines += ['', '## Ledger']
            for e in load_json(ledger_path)['entries']:
                if 'status' in e:
                    lines.append(f'- {e["status"]} · {e.get("text", "")} · {fmt_anchor(e["anchor"])}')
                else:
                    who = ' · '.join(x for x in (e.get('entity'), e.get('dimension')) if x)
                    lines.append(f'- {who}: {e.get("before") or "none"} → {e.get("after", "")}' + (f' ({e["cause"]})' if e.get('cause') else '') + f' · {fmt_anchor(e["anchor"])}')
        (view / f'{ch["id"]}.md').write_text('\n'.join(lines) + '\n')
    print(f'wrote Markdown views in {view}', file=sys.stderr)


COMMANDS = {'schema': cmd_schema, 'plan': cmd_plan, 'facts': cmd_facts, 'names': cmd_names,
            'concepts': cmd_concepts, 'text': cmd_text, 'test': cmd_test, 'verdicts': cmd_verdicts,
            'score': cmd_score, 'render': cmd_render}
CHECKS = ('schema', 'plan', 'facts', 'names', 'concepts', 'verdicts', 'score')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=list(COMMANDS))
    ap.add_argument('guide', help='the guide id, e.g. nexus-summary')
    ap.add_argument('--work', help='work folder (default work/<guide>)')
    ap.add_argument('--books', default='src/books')
    ap.add_argument('--schemas', help='schema folder (default: the repository\'s schemas/)')
    ap.add_argument('--style', choices=STYLES)
    ap.add_argument('--upto', help='last chapter id (text, test, verdicts, score)')
    ap.add_argument('--pdf', action='store_true', help='text: add the PDF-only blocks')
    ap.add_argument('--json', action='store_true', help='checks: print the result as JSON')
    args = ap.parse_args()
    guide = load_guide(args.books, args.guide)
    problems = []

    def say(rule, where, message):
        problems.append({'rule': rule, 'where': where, 'message': message})

    w = Work(args, args.guide, say)
    extra = COMMANDS[args.command](args, guide, w, say)
    if args.json and args.command in CHECKS:
        out = {'command': args.command, 'guide': args.guide, 'clean': not problems, 'problems': problems}
        if args.command == 'score':
            out['scores'] = extra
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        for p in problems:
            print(f'{p["rule"]} {p["where"]}: {p["message"]}')
        if args.command in CHECKS:
            print(f'{len(problems)} problem(s)' if problems else 'clean', file=sys.stderr)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
