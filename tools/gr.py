#!/usr/bin/env python3
"""gr: lets any AI model, or a person, do one step of a Ghostreader guide by hand.

  python3 -I tools/gr.py prompt <step> --guide <g> [--chapter <id>] [--style <s>]
        Prints the step's prompt (prompts/<step>.md) with its inputs filled in, the reference
        files it needs, and the JSON Schema of the reply. Paste it into any AI chat, or give it to
        an agent's isolated run.
  python3 -I tools/gr.py save <step> --guide <g> --reply FILE --family <family> --model <name> [--chapter <id>] [--style <s>]
        Checks the reply (its schema, then the step's checks), saves it where the workflow keeps
        it, and records the attempt in work/<guide>/run.json. Exit 1 lists the problems, each
        with its rule ID (spec/rules.md): send them back to the model, and save its fixed reply.

Steps: plan, read, ledger, write-map, write-styles, verify, recall-reader, recall-scorer.
Options: --work DIR (default work/<guide>), --books DIR (default src/books).
Exit codes: 0 = saved and every check passed, 1 = problems found, 2 = cannot run.
Standard library only.
"""
import argparse
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / '.claude' / 'skills' / 'ghostreader-book'
SCRIPTS = SKILL / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import check_guide as cg  # noqa: E402  (the guide text, the screen ids)
from schema_lite import validate  # noqa: E402

SPEC = '1.0.0'
RUNNER = 'gr 2.0.0'
STEPS = {  # step: (prompt file, role, storage schema, its definition)
    'plan': ('plan.md', 'writer', 'plan', None),
    'read': ('read-chapter.md', 'writer', 'facts', None),
    'ledger': ('ledger.md', 'writer', 'ledger', None),
    'write-map': ('write-map.md', 'writer', 'book', 'Chapter'),
    'write-styles': ('write-styles.md', 'writer', 'styles', 'Chapter'),
    'verify': ('verify.md', 'judge', 'verdict', None),
    'recall-reader': ('recall-reader.md', 'reader', 'recall-answers', None),
    'recall-scorer': ('recall-scorer.md', 'scorer', 'recall-score', None),
}


class Stop(Exception):
    """The run cannot go on (exit code 2)."""


def now():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def read_json(path, default=None):
    path = Path(path)
    if not path.exists():
        if default is not None:
            return default
        raise Stop(f'not found: {path}')
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise Stop(f'{path}: not valid JSON ({e})')


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def parse_json(text):
    t = text.strip()
    m = re.match(r'^```(?:json)?\s*\n(.*)\n```$', t, re.S)
    return json.loads(m.group(1) if m else t)


def schema(name):
    return read_json(REPO / 'schemas' / f'{name}.schema.json')


def storage(name, definition):
    """The storage schema of a step's output, with its definition as the root when it has one."""
    s = schema(name)
    if definition:
        root = dict(s['definitions'][definition])
        root['definitions'] = s['definitions']
        return root
    return s


def _resolve(s, root):
    while isinstance(s, dict) and '$ref' in s:
        node = root
        for part in s['$ref'][2:].split('/'):
            node = node[part]
        s = node
    return s


def _branch(v, s, root):
    """The object branch of an anyOf that `v` belongs to: the one whose consts it has."""
    for b in s.get('anyOf', []):
        b = _resolve(b, root)
        if b.get('type') == 'null':
            continue
        if 'anyOf' in b:
            found = _branch(v, b, root)
            if found:
                return found
            continue
        consts = {k: p['const'] for k, p in b.get('properties', {}).items() if isinstance(p, dict) and 'const' in p}
        if isinstance(v, dict) and all(v.get(k) == c for k, c in consts.items()):
            return b
    return None


def _nullable(s, root):
    s = _resolve(s, root) or {}
    t = s.get('type')
    return t == 'null' or (isinstance(t, list) and 'null' in t) or any(_resolve(b, root).get('type') == 'null' for b in s.get('anyOf', []))


def strip_nulls(v, s, root):
    """Remove the nulls the LLM profile put in place of optional fields the model left empty."""
    s = _resolve(s, root) or {}
    if isinstance(v, dict):
        if 'anyOf' in s:
            s = _branch(v, s, root) or s
        props, req = s.get('properties', {}), set(s.get('required', []))
        return {k: strip_nulls(x, props.get(k, {}), root) for k, x in v.items()
                if not (x is None and k not in req and not _nullable(props.get(k, {}), root))}
    if isinstance(v, list):
        return [strip_nulls(x, s.get('items', {}), root) for x in v]
    return v


def parse_prompt(path):
    text = Path(path).read_text()
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m:
        raise Stop(f'{path}: no header')
    head, key = {}, None
    for line in m.group(1).splitlines():
        top = re.match(r'^(\w+):\s*(.*)$', line)
        if top:
            key = top.group(1)
            head[key] = [] if top.group(2) == '[]' else (top.group(2) or None)
            continue
        item = re.match(r'^  - (.*)$', line)
        if item:
            head[key] = (head[key] or []) + [item.group(1)]
            continue
        sub = re.match(r'^  (\w+):\s*(.*)$', line)
        if sub:
            head[key] = dict(head[key] or {}, **{sub.group(1): sub.group(2)})
    return head, text[m.end():]


def render(step, values):
    """The prompt text of a step, with its inputs filled in and its reference files after it."""
    head, body = parse_prompt(REPO / 'prompts' / STEPS[step][0])

    def fill(m):
        if m.group(1) not in values:
            raise Stop(f'prompts/{STEPS[step][0]}: no value for {{{{{m.group(1)}}}}}')
        return str(values[m.group(1)])

    body = re.sub(r'\{\{(\w+)\}\}', fill, body)
    for ref in head.get('include') or []:
        body += f'\n\n---\n\n# Reference: {ref}\n\n' + (SKILL / ref).resolve().read_text()
    return head, body


class Guide:
    def __init__(self, guide, work, books):
        self.id, self.work, self.books = guide, Path(work), Path(books)

    @property
    def map_path(self):
        return self.books / f'{self.id}-map.json'

    def plan(self):
        return read_json(self.work / 'plan.json')

    def chapters(self):
        """[(part, chapter)] of the plan, in order."""
        return [(p, c) for p in self.plan()['parts'] for c in p['chapters']]

    def to_write(self):
        """The chapter ids to write: all of them, or those up to the limit in intake.json."""
        ids = [c['id'] for _, c in self.chapters()]
        up_to = read_json(self.work / 'intake.json', {}).get('upTo')
        if not up_to:
            return ids
        m = re.fullmatch(r'(?i)chapter\s+(\d+)', up_to.strip())
        for i, (_, c) in enumerate(self.chapters()):
            if up_to in (c['id'], c['title'], c['number']) or (m and c['number'].isdigit() and int(c['number']) == int(m.group(1))):
                return ids[:i + 1]
        raise Stop(f'intake.json: the limit "{up_to}" is not a chapter of the plan')

    def before(self, cid, include=False):
        ids = [c['id'] for _, c in self.chapters()]
        return ids[:ids.index(cid) + (1 if include else 0)]

    def text(self, cid):
        toc = {f'{e["n"]:03d}': e for e in read_json(self.work / 'source' / 'toc.json')}
        sources = next(c['sources'] for _, c in self.chapters() if c['id'] == cid)
        parts = []
        for f in sources:
            if f not in toc:
                raise Stop(f'text file {f} of {cid} is not in source/toc.json')
            parts.append(f'=== Text file {f} ===\n' + (self.work / 'source' / toc[f]['file']).read_text())
        return '\n\n'.join(parts)

    def file(self, rel, empty='(none yet)'):
        p = self.work / rel
        return p.read_text().strip() if p.exists() else empty

    def files(self, rel_pattern, ids, empty='(none yet)'):
        out = [(self.work / rel_pattern.format(cid)).read_text().strip() for cid in ids if (self.work / rel_pattern.format(cid)).exists()]
        return '\n\n'.join(out) if out else empty

    def map_book(self):
        return read_json(self.map_path) if self.map_path.exists() else None

    def map_chapter(self, cid):
        book = self.map_book()
        for _, ch, _ in cg.chapters(book or {'parts': []}):
            if ch['id'] == cid:
                return ch
        return None

    def skeleton(self):
        """A Map file with the plan's parts and chapters and no screens, for the first write-map."""
        plan, intake = self.plan(), read_json(self.work / 'intake.json', {})
        skill = re.search(r'version:\s*"([^"]+)"', (SKILL / 'SKILL.md').read_text())
        book = {'format': 1, 'id': f'{self.id}-map', 'guide': self.id, 'style': 'map', 'type': plan['type'],
                'title': plan['title'], 'author': plan.get('author') or intake.get('author', ''),
                'source': {'kind': 'book-file', 'file': intake.get('file', {}).get('format', 'TXT'),
                           'written': now()[:10], 'skill': skill.group(1) if skill else '', 'spec': SPEC},
                'parts': []}
        if intake.get('upTo'):
            book['upTo'] = intake['upTo']
        for p in plan['parts']:
            part = {k: p[k] for k in ('id', 'label', 'title') if p.get(k)}
            part['chapters'] = [dict({'id': c['id'], 'number': c['number'], 'title': c['title']},
                                     **({'length': c['words']} if c.get('words') else {})) for c in p['chapters']]
            book['parts'].append(part)
        return book

    def style_text(self, style, cid):
        """One chapter of one style as the judge reads it: every screen with its id, PDF blocks too."""
        path = self.books / f'{self.id}-{style}.json'
        if not path.exists():
            return f'(no {style} file)'
        text = cg.guide_text(read_json(path), upto=cid, every=True)  # every screen, app-only ones too
        i = text.find(f'[{cid}]\n')
        start = text.rfind('\n## ', 0, i) if i >= 0 else -1
        return f'# Style: {style}\n' + (text[start:] if start >= 0 else text)


def inputs(step, g, cid, style):
    """The values of a step's {{inputs}}, as its prompt header lists them."""
    v = {'guide': g.id, 'chapter': cid or '', 'style': style or ''}
    if step == 'plan':
        toc = read_json(g.work / 'source' / 'toc.json')
        first = next((e for e in toc if e.get('kind') == 'body' and e.get('words', 0) >= 200
                      and (g.work / 'source' / e['file']).exists()), None)
        v.update(intake=g.file('intake.json'), toc=g.file('source/toc.json'),
                 opening=(g.work / 'source' / first['file']).read_text() if first else '(no opening text)')
    elif step == 'read':
        earlier = []
        for x in g.before(cid):
            p = g.work / 'facts' / f'{x}.json'
            if p.exists():
                earlier += [dict(f['concept'], chapter=x) for f in read_json(p)['facts'] if f.get('concept')]
        people = {}
        for x in g.before(cid):
            p = g.work / 'facts' / f'{x}.json'
            if p.exists():
                for f in read_json(p)['facts']:
                    if f['type'] == 'person' and f.get('who'):
                        people.setdefault(f['who'], f.get('role', ''))
        v.update(chapter_text=g.text(cid), plan=g.file('plan.json'),
                 earlier_concepts=json.dumps(earlier, ensure_ascii=False, indent=1) if earlier else '(none yet)',
                 earlier_people='\n'.join(f'- {n}: {r}' for n, r in people.items()) or '(none yet)')
    elif step == 'ledger':
        v.update(facts=g.file(f'facts/{cid}.json'), earlier_ledger=g.files('ledger/{}.json', g.before(cid)),
                 chapter_text=g.text(cid))
    elif step == 'write-map':
        book = g.map_book()
        earlier = [ch for _, ch, s in cg.chapters(book) if ch['id'] in g.before(cid) and s] if book else []
        v.update(plan=g.file('plan.json'), facts=g.file(f'facts/{cid}.json'),
                 ledger=g.files('ledger/{}.json', g.before(cid, True)), concepts=g.file('concepts.json'),
                 earlier_chapters=json.dumps(earlier, ensure_ascii=False, indent=1) if earlier else '(none yet)')
    elif step == 'write-styles':
        ch = g.map_chapter(cid)
        if not ch:
            raise Stop(f'no chapter {cid} in {g.map_path}: run write-map first')
        v.update(plan=g.file('plan.json'), facts=g.files('facts/{}.json', g.before(cid, True)),
                 ledger=g.files('ledger/{}.json', g.before(cid, True)), map_chapter=json.dumps(ch, ensure_ascii=False, indent=1))
    elif step == 'verify':
        v.update(chapter_text=g.text(cid), facts=g.file(f'facts/{cid}.json'),
                 ledger=g.files('ledger/{}.json', g.before(cid, True)),
                 **{f'guide_{s}': g.style_text(s, cid) for s in cg.STYLES})
    elif step == 'recall-reader':
        test = g.work / 'recall-test' / f'{style}-{cid}.md'
        if not test.exists() and style in cg.STYLES:
            check_guide('test', g, '--style', style, '--upto', cid)
        if not test.exists():
            raise Stop(f'no test {test}: write it first ({"gr.py goldtest" if style == "gold" else "check_guide.py test"})')
        v.update(test=test.read_text())
    elif step == 'recall-scorer':
        # A scorer without the reader's answers would mark every question 0: never call it.
        for name in (f'{style}-{cid}-key.json', f'{style}-{cid}-answers.json'):
            if not (g.work / 'recall-test' / name).exists():
                raise Stop(f'no {g.work / "recall-test" / name}: the scorer needs the key and the reader\'s answers')
        v.update(key=g.file(f'recall-test/{style}-{cid}-key.json'), answers=g.file(f'recall-test/{style}-{cid}-answers.json'))
    return v


def output_path(step, g, cid, style):
    return {
        'plan': g.work / 'plan.json', 'read': g.work / 'facts' / f'{cid}.json', 'ledger': g.work / 'ledger' / f'{cid}.json',
        'write-map': g.map_path, 'write-styles': g.work / 'styles.json', 'verify': g.work / 'verdicts' / f'{cid}.json',
        'recall-reader': g.work / 'recall-test' / f'{style}-{cid}-answers.json',
        'recall-scorer': g.work / 'recall-test' / f'{style}-{cid}-score.json',
    }[step]


def save(step, g, cid, style, value):
    """Write a step's output where the workflow keeps it."""
    if step == 'write-map':
        book = g.map_book() or g.skeleton()
        for _, ch, _ in cg.chapters(book):
            if ch['id'] == cid:
                keep = {k: ch[k] for k in ('id', 'number', 'title', 'length') if k in ch}
                ch.clear()
                ch.update(keep)
                ch.update({k: x for k, x in value.items() if k not in keep and k != 'length'})
                break
        else:
            raise Stop(f'no chapter {cid} in the Map file')
        write_json(g.map_path, book)
    elif step == 'write-styles':
        notes = read_json(g.work / 'styles.json', {})
        notes['question'] = g.plan().get('question', '')  # the plan is the source: a fixed plan reaches the styles
        notes.setdefault('chapters', {})[cid] = value
        write_json(g.work / 'styles.json', notes)
    else:
        write_json(output_path(step, g, cid, style), value)


def check_guide(command, g, *extra):
    r = subprocess.run([sys.executable, '-I', str(SCRIPTS / 'check_guide.py'), command, g.id, '--work', str(g.work),
                        '--books', str(g.books), *extra], capture_output=True, text=True)
    if r.returncode == 2:
        raise Stop(f'check_guide.py {command}: {r.stderr.strip()}')
    return r


def problems(command, g, keep, *extra):
    r = check_guide(command, g, '--json', *extra)
    return [f'{p["rule"]} {p["where"]}: {p["message"]}' for p in json.loads(r.stdout)['problems'] if keep(p)]


def validate_book(path, chapter_path):
    r = subprocess.run(['node', str(REPO / 'scripts' / 'validate-book.mjs'), str(path), '--json'], capture_output=True, text=True)
    if r.returncode == 2 or not r.stdout.strip():
        raise Stop(f'validate-book.mjs: {r.stderr.strip()}')
    return [f'{p["rule"]} {p["path"]}: {p["message"]}' for res in json.loads(r.stdout) for p in res['problems']
            if not chapter_path or p['path'] == chapter_path or p['path'].startswith(chapter_path + '.') or p['path'] == '']


def chapter_path(book, cid):
    for pi, part in enumerate(book['parts']):
        for ci, ch in enumerate(part['chapters']):
            if ch['id'] == cid:
                return f'parts[{pi}].chapters[{ci}]'
    return None


def gate(step, g, cid, style):
    """The problems of a step's output, after it is saved: the checks an agent runs too."""
    where = lambda *keys: (lambda p: any(k in p['where'] for k in keys))
    if step == 'plan':
        return problems('plan', g, lambda p: True)
    if step == 'read':
        return problems('facts', g, lambda p: f'facts/{cid}.' in p['where'] and p['rule'] != 'GR-A03')
    if step == 'ledger':
        return problems('facts', g, where(f'ledger/{cid}.json'))
    if step == 'write-map':
        book = read_json(g.map_path)
        ch = g.map_chapter(cid)
        out = [] if ch and (ch.get('screens') or ch.get('sections')) else [f'GR-F01 {cid}: the chapter has no screens']
        out += validate_book(g.map_path, chapter_path(book, cid))
        if (g.work / 'facts' / f'{cid}.json').exists():
            out += problems('names', g, lambda p: p['where'] == f'{g.id}-map {cid}')
        return out
    if step == 'write-styles':
        return styles_gate(g, cid)
    if step == 'verify':
        return problems('verdicts', g, lambda p: p['rule'] in ('GR-F04', 'GR-C06') and f'verdicts/{cid}.json' in p['where'], '--upto', cid)
    if step in ('recall-reader', 'recall-scorer'):
        key = read_json(g.work / 'recall-test' / f'{style}-{cid}-key.json')
        out = read_json(output_path(step, g, cid, style))
        want = {q['n'] for q in key['questions']}
        got = [x['n'] for x in out['answers' if step == 'recall-reader' else 'scores']]
        bad = [f'GR-F04 question {n}: {"missing" if n not in got else "answered twice"}' for n in sorted(want) if got.count(n) != 1]
        return bad + [f'GR-F04 question {n}: not in the key' for n in got if n not in want]
    return []


def styles_gate(g, cid):
    """Build the three styles from the Map chapters up to this one, then check this chapter in each."""
    import tempfile
    book = read_json(g.map_path)
    later = set(c['id'] for _, c in g.chapters()) - set(g.before(cid, True))
    for _, ch, _ in cg.chapters(book):
        if ch['id'] in later:
            ch.pop('screens', None)
            ch.pop('sections', None)
    with tempfile.TemporaryDirectory() as tmp:
        m = Path(tmp) / f'{g.id}-map.json'
        write_json(m, book)
        r = subprocess.run([sys.executable, '-I', str(SCRIPTS / 'build_styles.py'), str(m), str(g.work / 'styles.json')],
                           capture_output=True, text=True)
        if r.returncode:
            return [f'GR-F04 build_styles.py: {(r.stderr or r.stdout).strip()}']
        out = []
        for style in ('recap', 'recall', 'layers'):
            path = Path(tmp) / f'{g.id}-{style}.json'
            out += [f'{style} {x}' for x in validate_book(path, chapter_path(read_json(path), cid))]
        return out


def save_reply(step, g, cid, style, reply_path, family, model_name):
    """Level A: an agent answered the prompt itself. The same checks, the same files, the same record."""
    prompt_file, role, store, definition = STEPS[step]
    head, _ = parse_prompt(REPO / 'prompts' / prompt_file)
    store_schema = storage(store, definition)
    try:
        value = strip_nulls(parse_json(Path(reply_path).read_text()), store_schema, store_schema)
        bad = [f'GR-F04 {e}' for e in validate(value, store_schema)]
    except json.JSONDecodeError as e:
        value, bad = None, [f'GR-F04 the reply is not valid JSON: {e}']
    if not bad:
        save(step, g, cid, style, value)
        bad = gate(step, g, cid, style)
    path = g.work / 'run.json'
    run = read_json(path, {'guide': g.id, 'spec': SPEC, 'runner': RUNNER, 'stages': []})
    last = run['stages'][-1] if run['stages'] else None
    same = (last and last['stage'] == step and last.get('chapter') == cid and last.get('style') == style
            and last['gate'] == 'fail' and last['model'].get('provider') == 'agent')
    entry = {'stage': step, **({'chapter': cid} if cid else {}), **({'style': style} if style else {}),
             'prompt': f'{prompt_file[:-3]}@{head["version"]}', 'role': role,
             'model': {'provider': 'agent', 'family': family, 'model': model_name},
             'attempts': (last['attempts'] + 1) if same else 1, 'gate': 'fail' if bad else 'pass',
             'problems': bad[:40], 'finished': now()}
    if same:
        run['stages'][-1] = entry
    else:
        run['stages'].append(entry)
    write_json(path, run)
    for b in bad:
        print(b)
    print(f'{step} {cid or ""} {style or ""}: {"FAIL" if bad else "pass"} (attempt {entry["attempts"]})', file=sys.stderr)
    return not bad


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['prompt', 'save'])
    ap.add_argument('step', choices=list(STEPS))
    ap.add_argument('--guide', required=True)
    ap.add_argument('--chapter')
    ap.add_argument('--style', choices=list(cg.STYLES) + ['gold'])
    ap.add_argument('--work')
    ap.add_argument('--books', default='src/books')
    ap.add_argument('--reply', help='save: the file with the JSON reply')
    ap.add_argument('--family', help='save: the model family that wrote the reply ("gemini", "gpt", "claude", "person")')
    ap.add_argument('--model', help='save: the model that wrote the reply')
    args = ap.parse_args()
    g = Guide(args.guide, args.work or f'work/{args.guide}', args.books)
    try:
        if args.command == 'prompt':
            _, text = render(args.step, inputs(args.step, g, args.chapter, args.style))
            _, _, store, definition = STEPS[args.step]
            where = {'write-map': f'the chapter "{args.chapter}" of {g.map_path}',
                     'write-styles': f'the entry "chapters.{args.chapter}" of {g.work / "styles.json"}'}.get(
                         args.step, str(output_path(args.step, g, args.chapter, args.style)))
            print(text)
            print(f'\n---\n\n# The JSON Schema of your reply\n\nReply with one JSON value that matches this schema '
                  f'(schemas/{store}.schema.json' + (f'#/definitions/{definition}' if definition else '') + f'). It goes to {where}.\n')
            print(json.dumps(storage(store, definition), ensure_ascii=False, indent=1))
            return 0
        if not (args.reply and args.family and args.model):
            raise Stop('save needs --reply, --family and --model')
        return 0 if save_reply(args.step, g, args.chapter, args.style, args.reply, args.family, args.model) else 1
    except Stop as e:
        print(f'gr: {e}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
