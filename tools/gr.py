#!/usr/bin/env python3
"""gr: runs the model steps of a Ghostreader guide with any model that speaks the OpenAI-compatible
chat API (docs/proposal-model-neutral-guides.md, phase 3, "Level B"). Standard library only.

For each step it fills in the step's prompt (prompts/<step>.md) with the step's inputs, asks the
model for JSON in the form of the step's schema (schemas/llm/), checks the reply with the same
scripts an agent uses, sends the problems back for at most two repairs, writes the working file,
and records the call in work/<guide>/run.json.

  python3 -I tools/gr.py models [--provider gemini]
  python3 -I tools/gr.py stage <step> --guide <g> [--chapter <id>] [--style <s>]
  python3 -I tools/gr.py write --guide <g>          plan, then each chapter: read, ledger; concepts;
                                                    each chapter: write-map, write-styles; build styles
  python3 -I tools/gr.py check --guide <g>          each chapter: verify; the blind recall test of
                                                    every style at the last chapter; the scores
  python3 -I tools/gr.py eval --fixture <dir>       the conformance suite on a fixture (see eval_fixture)
  python3 -I tools/gr.py prompt <step> --guide <g> [--chapter <id>] [--style <s>]
                                                    print the filled-in prompt, for an agent or an
                                                    isolated run to answer by hand
  python3 -I tools/gr.py save <step> --guide <g> --reply FILE --family claude --model <name> [--chapter <id>] [--style <s>]
                                                    an agent's own reply to a prompt: checked, saved and
                                                    gated as the runner does it, and recorded in run.json;
                                                    run it again after a fix (exit 1 lists the problems)
  python3 -I tools/gr.py record <step> --guide <g> --family claude --model <name> [--chapter <id>]
                                                    add a step an agent ran itself to run.json

Steps: plan, read, ledger, write-map, write-styles, verify, recall-reader, recall-scorer.
Before `write`: put the book's text in work/<guide>/source/ with extract_book.py, and write
work/<guide>/intake.json (references/working-files.md). With a limit, move the files after it
to work/<guide>/after-limit/ first.

Options: --config FILE (default gr.config.json at the repository root, else tools/gr.example.json),
--writer/--judge/--reader/--scorer PROVIDER:MODEL, --work DIR (default work/<guide>), --books DIR
(default src/books). The API key is read from the environment variable the provider names
(key_env); a provider without key_env sends none.
Exit codes: 0 = every gate passed, 1 = a gate failed after the repairs, 2 = cannot run.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / '.claude' / 'skills' / 'ghostreader-book'
SCRIPTS = SKILL / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import check_guide as cg  # noqa: E402  (the guide text, the screen ids)
from schema_lite import validate  # noqa: E402

SPEC = '1.0.0'
RUNNER = 'gr 1.0.0'
STEPS = {  # step: (prompt file, role, LLM profile, storage schema, its definition)
    'plan': ('plan.md', 'writer', 'plan', 'plan', None),
    'read': ('read-chapter.md', 'writer', 'facts', 'facts', None),
    'ledger': ('ledger.md', 'writer', 'ledger', 'ledger', None),
    'write-map': ('write-map.md', 'writer', 'chapter', 'book', 'Chapter'),
    'write-styles': ('write-styles.md', 'writer', 'styles-chapter', 'styles', 'Chapter'),
    'verify': ('verify.md', 'judge', 'verdict', 'verdict', None),
    'recall-reader': ('recall-reader.md', 'reader', 'recall-answers', 'recall-answers', None),
    'recall-scorer': ('recall-scorer.md', 'scorer', 'recall-score', 'recall-score', None),
}
ROLES = ('writer', 'judge', 'reader', 'scorer')
SYSTEM = 'You follow the instructions exactly. You reply with one JSON value only: no comments, no Markdown.'


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


# ------------------------------------------------------------------ the model

class Model:
    """One provider and model, called through the OpenAI-compatible chat API."""

    refused = set()  # (provider, model, schema name) the provider would not serve: JSON mode from then on

    def __init__(self, role, provider, cfg, model, settings):
        if provider not in cfg['providers']:
            raise Stop(f'no provider "{provider}" in the config (has {", ".join(cfg["providers"])})')
        p = cfg['providers'][provider]
        self.role, self.provider, self.model = role, provider, model
        self.family = p.get('family', provider)
        self.base = p['base_url'].rstrip('/')
        self.key_env = p.get('key_env')
        self.timeout = settings.get('timeout', 600)
        self.retries = settings.get('retries', 5)

    def describe(self):
        return {'provider': self.provider, 'family': self.family, 'model': self.model}

    def _post(self, path, body):
        headers = {'Content-Type': 'application/json'}
        if self.key_env:
            key = os.environ.get(self.key_env)
            if not key:
                raise Stop(f'set the environment variable {self.key_env} to the {self.provider} API key')
            headers['Authorization'] = f'Bearer {key}'
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method='POST' if data else 'GET')
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            return json.loads(r.read().decode())

    def list(self):
        return self._post('/models', None)

    def chat(self, messages, schema=None, name='output'):
        """(text, served model, usage, mode). mode: "schema" when the provider took the schema,
        "json" when it refused it and the call fell back to JSON mode with the schema in the prompt."""
        mode = 'schema' if schema and (self.provider, self.model, name) not in Model.refused else 'json'
        if schema and mode == 'json':
            messages = messages[:-1] + [{'role': messages[-1]['role'], 'content': messages[-1]['content']
                                         + '\n\n## The JSON Schema of your reply\n\n' + json.dumps(schema, ensure_ascii=False)}]
        attempt = 0  # retries after a rate limit or a server error; the JSON-mode fallback is not one
        while True:
            body = {'model': self.model, 'messages': messages}
            if mode == 'schema':
                body['response_format'] = {'type': 'json_schema', 'json_schema': {'name': name, 'strict': True, 'schema': schema}}
            else:
                body['response_format'] = {'type': 'json_object'}
            try:
                d = self._post('/chat/completions', body)
                msg = d['choices'][0]['message']
                return msg.get('content') or '', d.get('model', self.model), d.get('usage') or {}, mode
            except urllib.error.HTTPError as e:
                text = e.read().decode(errors='replace')
                if e.code == 400 and mode == 'schema':
                    # The provider cannot serve this schema (too large or a keyword it lacks): JSON mode.
                    print(f'  {self.provider} refused the schema ({first_line(text)}); JSON mode with the schema in the prompt', file=sys.stderr)
                    mode = 'json'
                    Model.refused.add((self.provider, self.model, name))
                    messages = messages[:-1] + [{'role': messages[-1]['role'], 'content': messages[-1]['content']
                                                 + '\n\n## The JSON Schema of your reply\n\n' + json.dumps(schema, ensure_ascii=False)}]
                    continue
                if e.code == 429 and re.search(r'limit: 0\b', text):
                    raise Stop(f'{self.provider} {self.model}: no quota on this key for this model ({first_line(text)})')
                if e.code == 429 and re.search(r'per day', text):
                    when = re.search(r'retry in ([\dhms.]+)', text)
                    raise Stop(f'{self.provider} {self.model}: the daily quota is used up'
                               + (f'; it resets in {when.group(1)}' if when else '') + ' (the run resumes where it stopped)')
                if e.code in (429, 500, 502, 503, 504) and attempt < self.retries:
                    attempt += 1
                    wait = retry_after(e, text, attempt - 1)
                    print(f'  {self.provider} {e.code}: waiting {wait:.0f} s, then retry {attempt} of {self.retries}', file=sys.stderr)
                    time.sleep(wait)
                    continue
                raise Stop(f'{self.provider} {self.model}: HTTP {e.code}: {first_line(text)}')
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt < self.retries:
                    attempt += 1
                    time.sleep(10 * attempt)
                    continue
                raise Stop(f'{self.provider}: {e}')


def first_line(text):
    try:
        d = json.loads(text)
        d = d[0] if isinstance(d, list) else d
        return str(d.get('error', {}).get('message', text)).splitlines()[0][:200]
    except (ValueError, AttributeError, IndexError):
        return text.strip().splitlines()[0][:200] if text.strip() else '(no message)'


def retry_after(e, text, attempt):
    """Seconds to wait: what the provider asks for, else 20, 40, 80… up to five minutes."""
    if e.headers.get('Retry-After', '').isdigit():
        return min(float(e.headers['Retry-After']), 300)
    m = re.search(r'retry in ([\d.]+)s', text)
    if m and float(m.group(1)) <= 300:
        return float(m.group(1)) + 1
    return min(20 * 2 ** attempt, 300)


def parse_json(text):
    t = text.strip()
    m = re.match(r'^```(?:json)?\s*\n(.*)\n```$', t, re.S)
    return json.loads(m.group(1) if m else t)


# ------------------------------------------------------------------ schemas

def schema(name):
    return read_json(REPO / 'schemas' / f'{name}.schema.json')


def llm_profile(name):
    s = read_json(REPO / 'schemas' / 'llm' / f'{name}.llm.json')
    s.pop('title', None)
    return s


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


# ------------------------------------------------------------------ prompts

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


# ------------------------------------------------------------------ the guide's files

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
        text = cg.guide_text(read_json(path), upto=cid, pdf=True)
        i = text.find(f'[{cid}]\n')
        start = text.rfind('\n## ', 0, i) if i >= 0 else -1
        return f'# Style: {style}\n' + (text[start:] if start >= 0 else text)


# ------------------------------------------------------------------ the steps

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
        v.update(chapter_text=g.text(cid), plan=g.file('plan.json'),
                 earlier_concepts=json.dumps(earlier, ensure_ascii=False, indent=1) if earlier else '(none yet)')
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
        if not test.exists():
            check_guide('test', g, '--style', style, '--upto', cid)
        v.update(test=test.read_text())
    elif step == 'recall-scorer':
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
        notes.setdefault('question', g.plan().get('question', ''))
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
        return problems('verdicts', g, lambda p: p['rule'] == 'GR-F04' and f'verdicts/{cid}.json' in p['where'], '--upto', cid)
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


def passed(g, step, cid=None, style=None):
    """True when run.json already has a passing call of this step and its output is still there."""
    run = read_json(g.work / 'run.json', {'stages': []})
    if not any(s['stage'] == step and s.get('chapter') == cid and s.get('style') == style and s['gate'] == 'pass'
               for s in run['stages']):
        return False
    if step == 'write-map':
        ch = g.map_chapter(cid)
        return bool(ch and (ch.get('screens') or ch.get('sections')))
    if step == 'write-styles':
        return cid in read_json(g.work / 'styles.json', {}).get('chapters', {})
    return output_path(step, g, cid, style).exists()


def run_step(step, g, models, settings, cid=None, style=None, resume=True):
    """One step: prompt, call, checks, repairs. True when its gate passes. With `resume`, a step
    that already passed is not run again."""
    if resume and passed(g, step, cid, style):
        print(f'{" ".join(x for x in (step, cid, style) if x)}: passed before', file=sys.stderr)
        return True
    prompt_file, role, profile, store, definition = STEPS[step]
    head, text = render(step, inputs(step, g, cid, style))
    model = models[role]
    messages = [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': text}]
    store_schema = storage(store, definition)
    started, tokens, attempts, bad, served, mode = time.time(), {'prompt': 0, 'completion': 0}, 0, [], model.model, 'schema'
    label = ' '.join(x for x in (step, cid, style) if x)
    for attempt in range(settings.get('repairs', 2) + 1):
        attempts += 1
        print(f'{label}: {model.provider} {model.model}, call {attempts}', file=sys.stderr)
        raw, served, usage, mode = model.chat(messages, llm_profile(profile), name=profile.replace('-', '_'))
        tokens['prompt'] += usage.get('prompt_tokens', 0) or 0
        tokens['completion'] += usage.get('completion_tokens', 0) or 0
        try:
            value = strip_nulls(parse_json(raw), store_schema, store_schema)
            bad = [f'GR-F04 {e}' for e in validate(value, store_schema)]
        except json.JSONDecodeError as e:
            value, bad = None, [f'GR-F04 the reply is not valid JSON: {e}']
        if not bad:
            save(step, g, cid, style, value)
            bad = gate(step, g, cid, style)
        if not bad:
            break
        print(f'  {len(bad)} problem(s): ' + '; '.join(bad[:3]), file=sys.stderr)
        messages += [{'role': 'assistant', 'content': raw},
                     {'role': 'user', 'content': 'The checks found these problems in your JSON. Fix each one, keep '
                      'everything else, and reply with the whole corrected JSON only.\n\n' + '\n'.join(bad[:40])}]
    record(g, {'stage': step, **({'chapter': cid} if cid else {}), **({'style': style} if style else {}),
               'prompt': f'{prompt_file[:-3]}@{head["version"]}', 'role': role, 'model': model.describe(),
               'served': served, 'mode': mode, 'attempts': attempts, 'gate': 'fail' if bad else 'pass',
               'problems': bad[:40], 'tokens': tokens, 'seconds': round(time.time() - started, 1), 'finished': now()})
    print(f'{label}: {"FAIL" if bad else "pass"} after {attempts} call(s)', file=sys.stderr)
    return not bad


def save_reply(step, g, cid, style, reply_path, family, model_name):
    """Level A: an agent answered the prompt itself. The same checks, the same files, the same record."""
    prompt_file, role, _, store, definition = STEPS[step]
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


def record(g, entry):
    path = g.work / 'run.json'
    run = read_json(path, {'guide': g.id, 'spec': SPEC, 'runner': RUNNER, 'stages': []})
    run['stages'].append(entry)
    write_json(path, run)


# ------------------------------------------------------------------ whole runs

def write_guide(g, models, settings):
    ok = True
    if not (g.work / 'plan.json').exists():
        ok &= run_step('plan', g, models, settings)
        if not ok:
            return False
    chapters = g.to_write()
    for cid in chapters:
        ok &= run_step('read', g, models, settings, cid) and run_step('ledger', g, models, settings, cid)
    check_guide('concepts', g)
    for cid in chapters:
        ok &= run_step('write-map', g, models, settings, cid)
    for cid in chapters:
        ok &= run_step('write-styles', g, models, settings, cid)
    r = subprocess.run([sys.executable, '-I', str(SCRIPTS / 'build_styles.py'), str(g.map_path), str(g.work / 'styles.json')],
                       capture_output=True, text=True)
    if r.returncode:
        print(r.stderr, file=sys.stderr)
        ok = False
    return ok


def check_written(g, models, settings):
    """Each chapter checked by an isolated judge; the blind recall test of every style at the last chapter."""
    chapters = g.to_write()
    ok = all([run_step('verify', g, models, settings, cid) for cid in chapters])
    last = chapters[-1]
    scores = {}
    for style in cg.STYLES:
        check_guide('test', g, '--style', style, '--upto', last)
        ok &= run_step('recall-reader', g, models, settings, last, style) and run_step('recall-scorer', g, models, settings, last, style)
        r = check_guide('score', g, '--style', style, '--upto', last, '--json')
        scores[style] = json.loads(r.stdout).get('scores')
    verdicts = check_guide('verdicts', g, '--json')
    unsupported = sum(1 for p in json.loads(verdicts.stdout)['problems'] if p['rule'] == 'GR-C01')
    summary = {'recall': {s: (v or {}).get('score') for s, v in scores.items()}, 'unsupported_claims': unsupported,
               'judge_independent': models['judge'].family != models['writer'].family}
    write_json(g.work / 'checks.json', summary)
    print(json.dumps(summary, indent=1))
    return ok


# ------------------------------------------------------------------ the conformance suite

def eval_fixture(args, models, settings):
    """The conformance suite on one fixture (fixtures/<name>/gold.json): the writer writes the
    guide from the book's text; the judge, reader and scorer check it; the result is compared with
    the gold set. With a real book, --book gives the file; its SHA-256 must match the gold set."""
    fixture = Path(args.fixture)
    gold = read_json(fixture / 'gold.json')
    work = Path(args.work or f'work/eval-{fixture.name}-{time.strftime("%Y%m%d-%H%M%S")}')
    books = work / 'books'
    resume = work.exists() and (work / 'intake.json').exists()
    if work.exists() and any(work.iterdir()) and not resume:
        raise Stop(f'{work} is not empty')
    (work / 'source').mkdir(parents=True, exist_ok=True)
    books.mkdir(exist_ok=True)
    if resume:
        print(f'resuming the run in {work}', file=sys.stderr)
    elif args.book:
        digest = hashlib.sha256(Path(args.book).read_bytes()).hexdigest()
        if digest != gold['book']['sha256']:
            raise Stop(f'{args.book}: SHA-256 {digest} is not the gold set\'s {gold["book"]["sha256"]}: another edition')
        cmd = [sys.executable, '-I', str(SCRIPTS / 'extract_book.py'), args.book, '--out', str(work / 'source')]
        if gold['book'].get('split'):
            cmd += ['--split', gold['book']['split']]
        subprocess.run(cmd, check=True)
        for f in gold['book'].get('after_limit', []):
            (work / 'after-limit').mkdir(exist_ok=True)
            for p in (work / 'source').glob(f'{f}-*'):
                shutil.move(str(p), work / 'after-limit' / p.name)
    else:
        shutil.copytree(fixture / 'working' / 'source', work / 'source', dirs_exist_ok=True)
    write_json(work / 'intake.json', gold['intake'])
    g = Guide(gold['guide'], work, books)
    print(f'eval {fixture.name} in {work}', file=sys.stderr)
    wrote = write_guide(g, models, settings)
    checked = check_written(g, models, settings) if wrote else False
    run = read_json(work / 'run.json')
    report = {'fixture': fixture.name, 'spec': SPEC, 'models': {r: m.describe() for r, m in models.items()},
              'judge_independent': models['judge'].family != models['writer'].family,
              'gates': {'pass': sum(s['gate'] == 'pass' for s in run['stages']), 'fail': sum(s['gate'] == 'fail' for s in run['stages']),
                        'first_try': sum(s['attempts'] == 1 and s['gate'] == 'pass' for s in run['stages'])},
              'tokens': {k: sum(s.get('tokens', {}).get(k, 0) for s in run['stages']) for k in ('prompt', 'completion')}}
    if wrote:
        facts = json.loads(check_guide('facts', g, '--json').stdout)['problems']
        report['anchors_clean'] = not any(p['rule'] in ('GR-A02', 'GR-A05') for p in facts)
        report['concept_recall'] = concept_recall(g, gold)
        report['gold_recall'] = gold_recall(g, gold, models, settings)
        report['planted_caught'] = planted(fixture, gold, work, models, settings)
    if checked:
        report['blind_recall'] = read_json(work / 'checks.json')['recall']
    report['pass'] = conformant(report)
    write_json(work / 'eval.json', report)
    print(json.dumps(report, indent=1))
    return report['pass']


def conformant(r):
    """The pass marks of the proposal, section 5.7 (decision D5)."""
    marks = [r['gates']['fail'] == 0, r.get('anchors_clean') is True, (r.get('gold_recall') or 0) >= 0.8,
             (r.get('concept_recall') or 0) >= 0.9, r.get('planted_caught') is None or r['planted_caught'] >= 0.9,
             all((v or 0) >= 0.8 for v in (r.get('blind_recall') or {'none': 0}).values())]
    return all(marks)


def concept_recall(g, gold):
    want = gold.get('concepts', [])
    if not want:
        return 1.0
    got = [cg.norm(c['name']) for c in read_json(g.work / 'concepts.json', {'concepts': []})['concepts']]
    hit = sum(1 for c in want if any(cg.norm(c['name']) in x or x in cg.norm(c['name']) for x in got))
    return round(hit / len(want), 3)


def gold_recall(g, gold, models, settings):
    """The blind recall test with the gold set's questions: does the guide carry what matters?"""
    last = g.to_write()[-1]
    key = [{'n': i, 'chapter': q['chapter'], 'must': f'M{i}', 'kind': q.get('kind', 'state'), 'question': q['question'],
            'answer': q['answer']} for i, q in enumerate(gold['must_carry'], 1)]
    check_guide('test', g, '--style', 'map', '--upto', last)  # the test text, then the gold questions in place
    test = g.work / 'recall-test' / f'map-{last}.md'
    body = test.read_text().split('\n---\n', 1)[1]
    titles = {c['id']: c['title'] for _, c in g.chapters()}
    head = test.read_text().split('# Questions', 1)[0]
    gold_style = 'gold'
    (g.work / 'recall-test' / f'{gold_style}-{last}.md').write_text(
        head + '# Questions\n\n' + '\n'.join(f'{q["n"]}. ({titles[q["chapter"]]}) {q["question"]}' for q in key) + '\n\n---\n' + body)
    write_json(g.work / 'recall-test' / f'{gold_style}-{last}-key.json', {'guide': g.id, 'style': 'map', 'upto': last, 'questions': key})
    ok = run_step('recall-reader', g, models, settings, last, gold_style) and run_step('recall-scorer', g, models, settings, last, gold_style)
    if not ok:
        return None
    shown = cg.app_refs(read_json(g.map_path), last)
    answers = {a['n']: a for a in read_json(g.work / 'recall-test' / f'{gold_style}-{last}-answers.json')['answers']}
    scores = {s['n']: s['score'] for s in read_json(g.work / 'recall-test' / f'{gold_style}-{last}-score.json')['scores']}
    pts = [scores.get(q['n'], 0) if answers.get(q['n'], {}).get('screen') in shown else 0 for q in key]
    return round(sum(pts) / len(pts), 3)


def set_path(obj, path, value):
    parts = re.findall(r'[^.\[\]]+', path)
    for p in parts[:-1]:
        obj = obj[int(p)] if p.isdigit() else obj[p]
    last = parts[-1]
    obj[int(last) if last.isdigit() else last] = value


def planted(fixture, gold, work, models, settings):
    """The fixture's own guide with known false claims put in: how many does the judge catch?"""
    plants = gold.get('planted', [])
    if not plants or not (fixture / 'books').exists():
        return None  # not run: no planted claims, or no correct guide to plant them in
    pw, pb = work / 'planted', work / 'planted' / 'books'
    if not pw.exists():  # a resumed run keeps the planted copy it made before
        shutil.copytree(work / 'source', pw / 'source')
        # The run's own plan, fact sheets and ledger: for a real book, the fixture has none (they quote it).
        for name in ('plan.json', 'facts', 'ledger'):
            src = work / name
            (shutil.copytree if src.is_dir() else shutil.copy)(src, pw / name)
        shutil.copytree(fixture / 'books', pb)
    for x in (plants if not (pw / 'planted.done').exists() else []):
        path = pb / f'{gold["guide"]}-{x["style"]}.json'
        book = read_json(path)
        ch = next(c for _, c, _ in cg.chapters(book) if c['id'] == x['chapter'])
        set_path(ch['screens'][x['screen'] - 1], x['path'], x['text'])
        write_json(path, book)
    (pw / 'planted.done').write_text('')
    pg = Guide(gold['guide'], pw, pb)
    caught = 0
    for cid in sorted({x['chapter'] for x in plants}):
        if not run_step('verify', pg, models, settings, cid):
            continue
        claims = read_json(pw / 'verdicts' / f'{cid}.json')['claims']
        for x in (p for p in plants if p['chapter'] == cid):
            ref = f'{cid}.s{x["screen"]}'
            words = {w for w in re.findall(r'[a-z]+', x['claim'].lower()) if len(w) > 3}
            if any(c['screen'] == ref and c['style'] == x['style'] and c['verdict'] != 'supported'
                   and len(words & set(re.findall(r'[a-z]+', c['claim'].lower()))) >= max(1, len(words) // 2) for c in claims):
                caught += 1
    return round(caught / len(plants), 3)


# ------------------------------------------------------------------ main

def load_models(args):
    cfg_path = Path(args.config) if args.config else (REPO / 'gr.config.json' if (REPO / 'gr.config.json').exists() else REPO / 'tools' / 'gr.example.json')
    cfg = read_json(cfg_path)
    models = {}
    for role in ROLES:
        given = getattr(args, role, None)
        if given:
            provider, _, model = given.partition(':')
        else:
            provider, model = cfg['roles'][role]['provider'], cfg['roles'][role]['model']
        models[role] = Model(role, provider, cfg, model, cfg)
    return models, cfg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['models', 'stage', 'write', 'check', 'eval', 'record', 'prompt', 'save'])
    ap.add_argument('step', nargs='?', choices=list(STEPS))
    ap.add_argument('--guide')
    ap.add_argument('--chapter')
    ap.add_argument('--style', choices=list(cg.STYLES) + ['gold'])
    ap.add_argument('--work')
    ap.add_argument('--books', default='src/books')
    ap.add_argument('--config')
    ap.add_argument('--provider', help='models: the provider to list')
    ap.add_argument('--fixture', help='eval: fixtures/<name>')
    ap.add_argument('--book', help='eval: the book file of a real-book fixture')
    ap.add_argument('--family', help='record: the model family that ran the step')
    ap.add_argument('--model', help='record: the model that ran the step')
    ap.add_argument('--gate', choices=['pass', 'fail'], default='pass', help='record: the step\'s gate')
    ap.add_argument('--reply', help='save: the file with the agent\'s JSON reply')
    for role in ROLES:
        ap.add_argument(f'--{role}', help=f'PROVIDER:MODEL for the {role} role')
    args = ap.parse_args()
    try:
        models, cfg = load_models(args)
        if args.command == 'models':
            m = models['writer'] if not args.provider else Model('writer', args.provider, cfg, '', cfg)
            for x in m.list().get('data', []):
                print(x['id'])
            return 0
        if args.command == 'eval':
            if not args.fixture:
                raise Stop('eval needs --fixture')
            return 0 if eval_fixture(args, models, cfg) else 1
        if not args.guide:
            raise Stop(f'{args.command} needs --guide')
        g = Guide(args.guide, args.work or f'work/{args.guide}', args.books)
        if args.command == 'record':
            if not (args.step and args.family and args.model):
                raise Stop('record needs a step, --family and --model')
            head, _ = parse_prompt(REPO / 'prompts' / STEPS[args.step][0])
            record(g, {'stage': args.step, **({'chapter': args.chapter} if args.chapter else {}),
                       **({'style': args.style} if args.style else {}), 'prompt': f'{STEPS[args.step][0][:-3]}@{head["version"]}',
                       'role': STEPS[args.step][1], 'model': {'provider': 'agent', 'family': args.family, 'model': args.model},
                       'attempts': 1, 'gate': args.gate, 'finished': now()})
            return 0
        if args.command == 'save':
            if not (args.step and args.reply and args.family and args.model):
                raise Stop('save needs a step, --reply, --family and --model')
            return 0 if save_reply(args.step, g, args.chapter, args.style, args.reply, args.family, args.model) else 1
        if args.command == 'prompt':
            if not args.step:
                raise Stop('prompt needs a step')
            _, text = render(args.step, inputs(args.step, g, args.chapter, args.style))
            print(text)
            where = {'write-map': f'the chapter "{args.chapter}" of {g.map_path}',
                     'write-styles': f'the entry "chapters.{args.chapter}" of {g.work / "styles.json"}'}.get(
                         args.step, str(output_path(args.step, g, args.chapter, args.style)))
            print(f'\n## Where the reply goes\n\n{where} (schema: schemas/{STEPS[args.step][3]}.schema.json'
                  + (f'#/definitions/{STEPS[args.step][4]}' if STEPS[args.step][4] else '') + ').')
            return 0
        if args.command == 'stage':
            if not args.step:
                raise Stop('stage needs a step')
            return 0 if run_step(args.step, g, models, cfg, args.chapter, args.style, resume=False) else 1
        if args.command == 'write':
            return 0 if write_guide(g, models, cfg) else 1
        if args.command == 'check':
            return 0 if check_written(g, models, cfg) else 1
    except Stop as e:
        print(f'gr: {e}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
