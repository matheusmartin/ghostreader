#!/usr/bin/env python3
"""Turn a book file (EPUB, PDF, TXT, Markdown or HTML) into numbered plain text, one file per
section of the book's table of contents, for writing a Ghostwriter guide.

Usage:
    python3 extract_book.py BOOK_FILE --out work/<book-id>/source [--split REGEX]

Output, in --out (keep it in work/: it is the book's text and must never be committed):
    meta.json     title, authors, language, publisher, date, format, pages
    toc.json      one entry per section: n, file, title, level, words, paragraphs, kind
    NNN-slug.txt  "# Title", then one paragraph per line: "[p12] text"

A fact in a fact sheet cites its section and paragraph ("012 p34"), so every claim in the guide
can be checked against the text. "words" is the section's real length (the book map's chip size).
"kind" is a guess from the title: front, part, body or back. Check it.

EPUB  sections follow the book's own table of contents (EPUB 3 nav or EPUB 2 NCX) in reading
      order; an entry that points inside a file (#id) starts a new section there. A
      DRM-protected EPUB stops with a message.
PDF   sections follow the PDF outline (bookmarks). Without an outline, use --split with a regex
      for the chapter headings; otherwise the whole text is one section with [page N] marks.
      Running headers and page numbers are removed. A PDF without a text layer (a scan) stops
      with a message.
TXT   --split REGEX starts a section at each matching line, e.g. --split '^(CHAPTER|Chapter) [0-9IVXLC]+'.
      Project Gutenberg's licence header and footer are removed.
MD    splits at "#" and "##" headings unless --split is given.
HTML  splits at <h1> and <h2> unless --split is given.

Exit codes: 0 = done, 2 = cannot read the book (format, DRM, no text layer, bad regex).
Requirements: Python 3.9+. PDF also needs poppler-utils (pdftotext) or the pypdf package.
"""
import argparse
import json
import posixpath
import re
import shutil
import subprocess
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree as ET

BLOCKS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre", "dt", "dd", "td", "th",
          "figcaption", "section", "article", "header", "footer", "aside", "tr", "table", "ul", "ol", "hr", "body"}
SKIP = {"script", "style", "head", "title", "svg", "math"}
FRONT = re.compile(r"^\W*(cover|title page|copyright|dedication|contents|table of contents|epigraph|also by|praise for|"
                   r"half title|frontispiece|imprint|colophon|list of (illustrations|figures|maps))\b", re.I)
BACK = re.compile(r"^\W*(acknowledg|notes\b|endnotes|index\b|bibliography|references\b|further reading|"
                  r"about the (author|publisher)|credits|permissions|sources\b|end of the project gutenberg|(the )?full project gutenberg|full license)", re.I)
PART = re.compile(r"^(part|book|volume|vol\.)\s+([0-9ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third)\b", re.I)


def fail(msg):
    print(f"extract_book.py: {msg}", file=sys.stderr)
    sys.exit(2)


def clean(s):
    s = s.replace("­", "").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def words(paras):
    return sum(len(p.split()) for p in paras)


class Section:
    def __init__(self, title, level=1):
        self.title = clean(title) or "Untitled"
        self.level = level
        self.paras = []


# ---------------------------------------------------------------- HTML text with cut points
class TextParser(HTMLParser):
    """Collects block texts from XHTML. When an element carries an id in `cuts`, emits a cut."""

    def __init__(self, cuts=(), heading_cut=()):
        super().__init__(convert_charrefs=True)
        self.cuts = set(cuts)
        self.heading_cut = set(heading_cut)
        self.events = []
        self.buf = []
        self.skip = 0
        self.heading = None

    def flush(self):
        text = clean("".join(self.buf))
        self.buf = []
        if text:
            self.events.append(("para", text))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        ident = a.get("id") or (a.get("name") if tag == "a" else None)
        if ident and ident in self.cuts:
            self.flush()
            self.events.append(("cut", ident))
        if tag in SKIP:
            self.skip += 1
        elif tag in BLOCKS:
            self.flush()
            if tag in self.heading_cut:
                self.heading = []
        elif tag == "br":
            self.buf.append(" ")

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag in BLOCKS:
            if self.heading is not None and tag in self.heading_cut:
                title = clean("".join(self.buf))
                self.buf = []
                self.heading = None
                if title:
                    self.events.append(("heading", title))
                return
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)

    def close(self):
        super().close()
        self.flush()


class NavParser(HTMLParser):
    """EPUB 3 nav document: the <nav epub:type="toc"> list as (href, title, level)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_toc = False
        self.nav_depth = 0
        self.depth = 0
        self.entries = []
        self.href = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "nav":
            kinds = (a.get("epub:type") or a.get("role") or "").split()
            if "toc" in kinds or "doc-toc" in kinds:
                self.in_toc = True
                self.nav_depth = 0
            if self.in_toc:
                self.nav_depth += 1
        if not self.in_toc:
            return
        if tag == "ol" or tag == "ul":
            self.depth += 1
        elif tag == "a" and a.get("href"):
            self.href = a["href"]
            self.text = []

    def handle_endtag(self, tag):
        if not self.in_toc:
            return
        if tag in ("ol", "ul"):
            self.depth -= 1
        elif tag == "a" and self.href is not None:
            self.entries.append((self.href, clean("".join(self.text)), max(1, self.depth)))
            self.href = None
        elif tag == "nav":
            self.nav_depth -= 1
            if self.nav_depth <= 0:
                self.in_toc = False

    def handle_data(self, data):
        if self.href is not None:
            self.text.append(data)


# ---------------------------------------------------------------- EPUB
def local(tag):
    return tag.rsplit("}", 1)[-1]


def epub(path):
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        fail("this EPUB is not a valid zip file")
    names = set(z.namelist())
    if "META-INF/encryption.xml" in names:
        enc = ET.fromstring(z.read("META-INF/encryption.xml"))
        for ref in enc.iter():
            if local(ref.tag) == "CipherReference":
                uri = unquote(ref.get("URI", ""))
                if re.search(r"\.(x?html?|xml)$", uri, re.I):
                    fail("this EPUB is DRM-protected (its text is encrypted). Use a DRM-free copy, a PDF, or a text file.")
    try:
        container = ET.fromstring(z.read("META-INF/container.xml"))
    except KeyError:
        fail("META-INF/container.xml is missing: not an EPUB")
    opf_path = next(el.get("full-path") for el in container.iter() if local(el.tag) == "rootfile")
    base = posixpath.dirname(opf_path)
    opf = ET.fromstring(z.read(opf_path))

    def resolve(rel_base, href):
        return posixpath.normpath(posixpath.join(rel_base, unquote(href))) if href else ""

    meta = {"format": "EPUB"}
    for el in opf.iter():
        tag = local(el.tag)
        text = clean(el.text or "")
        if not text:
            continue
        if tag == "title" and "title" not in meta:
            meta["title"] = text
        elif tag == "creator":
            meta.setdefault("authors", []).append(text)
        elif tag in ("language", "publisher", "date") and tag not in meta:
            meta[tag] = text
    manifest, spine, ncx_id, nav_href = {}, [], None, None
    for el in opf.iter():
        tag = local(el.tag)
        if tag == "item":
            href = resolve(base, el.get("href"))
            manifest[el.get("id")] = (href, el.get("media-type", ""))
            if "nav" in (el.get("properties") or "").split():
                nav_href = href
        elif tag == "spine":
            ncx_id = el.get("toc")
        elif tag == "itemref":
            spine.append(el.get("idref"))
    files = [manifest[i][0] for i in spine if i in manifest and "html" in manifest[i][1]]
    if not files:
        fail("the EPUB has no readable chapters")

    toc = []                                  # (file, fragment, title, level)
    if nav_href and nav_href in names:
        p = NavParser()
        p.feed(z.read(nav_href).decode("utf-8", "replace"))
        for href, title, level in p.entries:
            f, _, frag = href.partition("#")
            toc.append((resolve(posixpath.dirname(nav_href), f), frag or None, title, level))
    if not toc and ncx_id in manifest:
        ncx_path = manifest[ncx_id][0]
        root = ET.fromstring(z.read(ncx_path))

        def walk(node, level):
            for np in node:
                if local(np.tag) != "navPoint":
                    continue
                label = next((clean("".join(t.itertext())) for t in np.iter() if local(t.tag) == "text"), "")
                src = next((c.get("src") for c in np if local(c.tag) == "content"), "")
                f, _, frag = (src or "").partition("#")
                toc.append((resolve(posixpath.dirname(ncx_path), f), frag or None, label, level))
                walk(np, level + 1)
        for nm in root.iter():
            if local(nm.tag) == "navMap":
                walk(nm, 1)
    toc = [t for t in toc if t[0] in files]

    starts = {}                               # file -> [(fragment or None, title, level)]
    for f, frag, title, level in toc:
        starts.setdefault(f, []).append((frag, title, level))

    sections = [Section("Before the contents", 1)]
    for f in files:
        here = starts.get(f, [])
        for frag, title, level in here:
            if frag is None:
                sections.append(Section(title, level))
        cuts = {frag: (title, level) for frag, title, level in here if frag}
        p = TextParser(cuts=cuts.keys())
        try:
            p.feed(z.read(f).decode("utf-8", "replace"))
            p.close()
        except KeyError:
            continue
        for kind, value in p.events:
            if kind == "cut":
                title, level = cuts[value]
                sections.append(Section(title, level))
            else:
                sections[-1].paras.append(value)
    if not toc:
        print("extract_book.py: no table of contents found: one section per file", file=sys.stderr)
    return meta, [s for s in sections if s.paras or s is not sections[0]]


# ---------------------------------------------------------------- PDF
def pdf(path, split):
    meta = {"format": "PDF"}
    pages_text = None
    outline = []
    try:
        import pypdf                                    # optional
        reader = pypdf.PdfReader(str(path))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                fail("this PDF is password-protected")
        info = reader.metadata or {}
        if info.get("/Title"):
            meta["title"] = clean(str(info["/Title"]))
        if info.get("/Author"):
            meta["authors"] = [clean(str(info["/Author"]))]
        meta["pages"] = len(reader.pages)

        def walk(items, level):
            for it in items:
                if isinstance(it, list):
                    walk(it, level + 1)
                else:
                    try:
                        outline.append((reader.get_destination_page_number(it), clean(str(it.title)), level))
                    except Exception:
                        pass
        walk(reader.outline, 1)
    except ImportError:
        reader = None
    if shutil.which("pdftotext"):
        out = subprocess.run(["pdftotext", "-enc", "UTF-8", str(path), "-"], capture_output=True)
        if out.returncode != 0:
            fail(f"pdftotext could not read the file: {out.stderr.decode(errors='replace').strip()}")
        pages_text = out.stdout.decode("utf-8", "replace").split("\f")
        if pages_text and not pages_text[-1].strip():
            pages_text.pop()
    elif reader is not None:
        pages_text = [(pg.extract_text() or "") for pg in reader.pages]
    else:
        fail("reading a PDF needs pdftotext (poppler-utils) or the pypdf package")
    meta.setdefault("pages", len(pages_text))
    chars = sum(len(t.strip()) for t in pages_text)
    if chars < 200 * max(1, len(pages_text)) * 0.25:
        fail("this PDF has almost no text layer (a scan?). Use an EPUB or a text copy, or run OCR first.")

    # Running headers and footers: short lines that repeat on many pages.
    edge = {}
    for t in pages_text:
        lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
        for ln in lines[:2] + lines[-2:]:
            key = re.sub(r"\d+", "#", ln.lower())
            edge[key] = edge.get(key, 0) + 1
    repeated = {k for k, c in edge.items() if c >= max(4, 0.3 * len(pages_text)) and len(k) < 80}

    page_paras = []
    for t in pages_text:
        lines = [ln.strip() for ln in t.splitlines()]
        lines = [ln for ln in lines if not (ln and (re.fullmatch(r"[0-9ivxlc]{1,6}", ln, re.I)
                                                     or re.sub(r"\d+", "#", ln.lower()) in repeated))]
        # pdftotext often gives no blank line between paragraphs: a line clearly shorter than the
        # page's usual line that ends a sentence also ends its paragraph (headings too).
        lengths = sorted(len(ln) for ln in lines if ln)
        usual = lengths[int(len(lengths) * 0.8)] if lengths else 0
        paras, cur = [], []
        for ln in lines:
            if not ln:
                if cur:
                    paras.append(cur)
                    cur = []
                continue
            cur.append(ln)
            if usual >= 30 and len(ln) < 0.8 * usual and re.search(r"[.!?:;”\"’)\]]$", ln):
                paras.append(cur)
                cur = []
        if cur:
            paras.append(cur)
        joined = []
        for lines in paras:
            text = ""
            for ln in lines:
                if text.endswith("-") and ln[:1].islower():
                    text = text[:-1] + ln
                else:
                    text = f"{text} {ln}" if text else ln
            joined.append(clean(text))
        page_paras.append([p for p in joined if p])
    # A paragraph that runs on to the next page.
    for i in range(len(page_paras) - 1):
        a, b = page_paras[i], page_paras[i + 1]
        if a and b and not re.search(r"[.!?:”\"')\]]$", a[-1]) and b[0][:1].islower():
            a[-1] = f"{a[-1]} {b.pop(0)}"

    if outline and not split:
        outline.sort(key=lambda o: o[0])
        sections = [Section("Before the contents", 1)]
        starts = {}
        for page, title, level in outline:
            starts.setdefault(page, []).append((title, level))
        for i, paras in enumerate(page_paras):
            for title, level in starts.get(i, []):
                sections.append(Section(title, level))
            sections[-1].paras.extend(paras)
        return meta, [s for s in sections if s.paras or s is not sections[0]]
    flat = []
    for i, paras in enumerate(page_paras):
        flat.append(f"[page {i + 1}]")
        flat.extend(paras)
    return meta, split_paras(flat, split, "Full text")


# ---------------------------------------------------------------- text, Markdown, HTML
def split_paras(paras, split, first_title):
    if not split:
        s = Section(first_title, 1)
        s.paras = paras
        return [s]
    try:
        rx = re.compile(split)
    except re.error as e:
        fail(f"--split is not a valid regex: {e}")
    sections = [Section("Before the first match", 1)]
    for p in paras:
        if rx.search(p):
            sections.append(Section(p[:120], 1))
        else:
            sections[-1].paras.append(p)
    if len(sections) == 1:
        print("extract_book.py: --split matched no line: one section", file=sys.stderr)
    return [s for s in sections if s.paras or s is not sections[0]]


def text_file(path, split, markdown):
    raw = path.read_bytes()
    try:
        t = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        t = raw.decode("latin-1")
    meta = {"format": "Markdown" if markdown else "text"}
    start = re.search(r"^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG.*$", t, re.M | re.I)
    end = re.search(r"^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG.*$", t, re.M | re.I)
    if start:
        head = t[:start.start()]
        m = re.search(r"^Title:\s*(.+)$", head, re.M)
        if m:
            meta["title"] = clean(m.group(1))
        m = re.search(r"^Author:\s*(.+)$", head, re.M)
        if m:
            meta["authors"] = [clean(m.group(1))]
        t = t[start.end():end.start() if end else None]
        meta["format"] = "Project Gutenberg text"
    blocks = [clean(b) for b in re.split(r"\n\s*\n", t.replace("\r\n", "\n"))]
    blocks = [b for b in blocks if b]
    if markdown and not split:
        split = r"^#{1,2} "
    secs = split_paras(blocks, split, meta.get("title", "Full text"))
    for s in secs:
        s.title = s.title.lstrip("# ").strip() or s.title
    return meta, secs


def html_file(path, split):
    t = path.read_text("utf-8", errors="replace")
    p = TextParser(heading_cut=() if split else ("h1", "h2"))
    p.feed(t)
    p.close()
    sections = [Section("Before the first heading", 1)]
    for kind, value in p.events:
        if kind == "heading":
            sections.append(Section(value, 1))
        elif kind == "para":
            sections[-1].paras.append(value)
    sections = [s for s in sections if s.paras or s is not sections[0]]
    if split:
        return {"format": "HTML"}, split_paras([q for s in sections for q in s.paras], split, "Full text")
    return {"format": "HTML"}, sections


# ---------------------------------------------------------------- output
def kind_of(sec):
    if PART.match(sec.title) and words(sec.paras) < 300:
        return "part"
    if FRONT.search(sec.title) or sec.title.startswith("Before the"):
        return "front"
    if BACK.search(sec.title):
        return "back"
    return "body"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "section"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("book", help="EPUB, PDF, TXT, MD or HTML file")
    ap.add_argument("--out", required=True, help="output folder, e.g. work/<book-id>/source")
    ap.add_argument("--split", help="regex for the line that starts each section (PDF without outline, TXT, MD, HTML)")
    a = ap.parse_args()
    path = Path(a.book)
    if not path.is_file():
        fail(f"no such file: {path}")
    ext = path.suffix.lower()
    if ext == ".epub":
        meta, sections = epub(path)
    elif ext == ".pdf":
        meta, sections = pdf(path, a.split)
    elif ext in (".txt", ".text"):
        meta, sections = text_file(path, a.split, markdown=False)
    elif ext in (".md", ".markdown"):
        meta, sections = text_file(path, a.split, markdown=True)
    elif ext in (".html", ".htm", ".xhtml"):
        meta, sections = html_file(path, a.split)
    else:
        fail(f"unknown format {ext}: use EPUB, PDF, TXT, MD or HTML")
    meta["source_file"] = path.name

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("[0-9][0-9][0-9]-*.txt"):
        old.unlink()
    toc = []
    for n, s in enumerate(sections, 1):
        name = f"{n:03d}-{slug(s.title)}.txt"
        body = "\n".join(f"[p{i}] {p}" for i, p in enumerate(s.paras, 1))
        (out / name).write_text(f"# {s.title}\n\n{body}\n", encoding="utf-8")
        toc.append({"n": n, "file": name, "title": s.title, "level": s.level, "words": words(s.paras),
                    "paragraphs": len(s.paras), "kind": kind_of(s)})
    (out / "toc.json").write_text(json.dumps(toc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    total = sum(t["words"] for t in toc)
    print(f"{meta.get('title', path.name)} · {', '.join(meta.get('authors', [])) or 'author unknown'} · "
          f"{meta['format']} · {len(toc)} sections · {total:,} words → {out}")
    for t in toc:
        print(f"  {t['n']:03d}  {t['words']:>7,}  {t['kind']:<5}  {'  ' * (t['level'] - 1)}{t['title'][:70]}")


if __name__ == "__main__":
    main()
