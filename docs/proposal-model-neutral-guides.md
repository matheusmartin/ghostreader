# Proposal: a model-neutral standard for book guides

Status: proposal for decision · 2026-11-20 · scope: the process that reads a book and writes a
guide (today the `ghostreader-book` skill). The app and the book format do not change.

## 1 · Summary

The goal: any capable model, in any agent or through a plain API, reads a book and makes a guide
that passes the same checks as a guide that Claude makes today.

Most of the current process is portable already. The output format is plain JSON, the main
checks are scripts, and the skill uses the open Agent Skills format. The gaps are in four places:

1. **Discovery.** Only Claude Code finds the skill (`.claude/skills/`). There is no `AGENTS.md`.
2. **Claude-only steps.** The workflow tells the model to use "the task list" and "a fresh
   subagent". The real requirement (an isolated context with listed inputs) is not written down.
3. **Loose intermediate files.** Fact sheets, the ledger and the concept list are free Markdown
   that `check_guide.py` reads with regular expressions. A model that writes `M1 - state` in
   place of `M1 · state` breaks the check. Verifier results are not saved in a file.
4. **No language-neutral contract.** The book format is defined only in TypeScript. Other tools
   cannot use it for constrained output, and no file records which model made a guide or what
   scores it got.

The proposal: a standard in four layers, then a runner for models without tools.

| Layer | What | Example |
|---|---|---|
| Spec | Normative prose: stages, rules with IDs, interpretation rules | `spec/README.md`, rule `GR-W03` "no 'and then'" |
| Contracts | JSON Schema 2020-12 for every file a stage writes | `schemas/facts.schema.json` |
| Prompts | One versioned, model-neutral template per model stage | `prompts/read-chapter.md` |
| Gates | Scripts and isolated judges that accept or reject each output | `check_guide.py facts --json`, the blind recall test |

Plus packaging: `AGENTS.md` at the root, the skill under the cross-client path
`.agents/skills/`, and a small runner (`tools/gr.py`) that drives any model through an
OpenAI-compatible API.

## 2 · Goal and test of success

Two levels of portability:

| Level | Who runs the process | What it needs |
|---|---|---|
| A · Agent | A coding agent with a shell and files: Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot, Cursor and others | `AGENTS.md`, the skill, the scripts |
| B · Model only | A model with no tools, through an API (hosted or local: vLLM, Ollama, llama.cpp) | The runner, which calls the model stage by stage and runs the gates |

**Test of success:** a conformance suite (section 5.7) passes with at least two model families
at Level A and one at Level B. Same input, same gates, comparable scores.

## 3 · Evaluation of the current process

### 3.1 · Already portable: keep

| Part | Why it is portable |
|---|---|
| Final output: four JSON files per guide | Plain data. Any model can write JSON |
| `npm run validate` (`validate.ts`, `lint.ts`) | Deterministic. Same result for every model |
| `extract_book.py`, `build_styles.py`, `map.py`, `check_guide.py facts/names/text/test` | Scripts with a CLI. Any agent with a shell can run them |
| `check:screens`, `build` | Deterministic |
| SKILL.md frontmatter | Already uses the Agent Skills fields `name`, `description`, `metadata`, `compatibility` |
| Rules written as short, direct sentences | Easy for any model to follow. Few idioms |
| Research basis (FABLES, event indexing, retrieval practice) | Model-independent |

### 3.2 · Gaps

| # | Gap | Where | Effect on another model | Fix (section) |
|---|---|---|---|---|
| G1 | Skill only in `.claude/skills/`; no `AGENTS.md` | repo root | Codex, Copilot, Cursor and others do not find it | 5.9 |
| G2 | "Copy this checklist into the task list" | SKILL.md, Workflow | Not every agent has a task list | 5.3 |
| G3 | "Start a fresh subagent" for claims, must carry and recall | SKILL.md steps 7–8, verify.md | Agents without sub-agents skip the check, or check in the writer's own context (the writer then grades its own work) | 5.3 |
| G4 | Fact sheets, ledger and concept list are free Markdown, parsed by regex | SKILL.md step 5, `check_guide.py` | Small format drift breaks the check or hides items | 5.5 |
| G5 | Anchor check proves only that the paragraph exists | `check_guide.py facts` | A wrong anchor that points to a real paragraph passes | 5.4 |
| G6 | Book format only in TypeScript | `src/model/types.ts` | No constrained decoding; no validation without Node | 5.6 |
| G7 | Rules have no IDs | `lint.ts`, references | Fix messages and judge verdicts cannot be counted or compared across models | 5.6 |
| G8 | Judge results (claims, must carry, recall scores) live only in the chat | verify.md | No record; no comparison between models or runs | 5.7 |
| G9 | Writer scores its own recall test ("yourself or a second subagent") | verify.md step 5 | Self-grading bias | 5.7 |
| G10 | "For anything else, follow The Economist Style Guide's own entry" | writing-style.md | Each model follows its own memory of a copyrighted guide: output differs | 5.6 |
| G11 | Step 2 asks the model to read all references (about 16,000 words, roughly 21,000 tokens) at once | SKILL.md | Small-context models lose rules; every stage pays for all rules | 5.2 |
| G12 | SKILL.md is 3,600 words (roughly 4,800 tokens) | SKILL.md | At the spec's limit (body under 5,000 tokens) | 5.9 |
| G13 | Provenance is `source.skill` only | book files | You cannot tell which model, prompts or scores made a guide | 5.8 |
| G14 | Judgement steps rest on prose guidance and one example each | must carry, concepts, scenes | Models differ most here; nothing measures the difference | 5.4, 5.7 |
| G15 | Script paths include `.claude/skills/…` | every command | Paths break when the skill moves | 5.9 |

## 4 · Research findings that set the design

| Finding | Source | Design decision |
|---|---|---|
| Agent Skills is an open format: `name` and `description` required; `.agents/skills/` is the cross-client project path; keep SKILL.md under 500 lines and its body under about 5,000 tokens; load references only when needed | agentskills.io specification and client guide | Keep the skill format. Move it to `.agents/skills/`. Each stage loads only its own rules |
| `AGENTS.md` is plain Markdown, now under the Agentic AI Foundation (Linux Foundation). It is guidance, not enforcement. Claude Code reads `CLAUDE.md`, not `AGENTS.md` | AAIF blog; OpenAI announcement | Add `AGENTS.md`; add `CLAUDE.md` that imports it. Keep enforcement in scripts and CI |
| OpenAI, Gemini and Anthropic all accept JSON Schema for output, with different subsets. Common ground: basic types, `items`, `$defs`/`$ref`. OpenAI strict mode needs `additionalProperties: false` and every field in `required`. Reports say Anthropic does not apply string-length or number limits, and Anthropic and Gemini do not take recursive schemas. Strict mode can still fail in practice | Provider docs; comparison articles | A strict "LLM profile" of each schema (5.6). Word and item limits stay in the lint step after generation. Always validate output |
| In AI summaries of novels, most false claims are about what characters feel, want or know, about relations, and about the order of events. Summaries leave out key events and lean on the end | FABLES (Kim et al., 2024) | Keep claim-level checks. Add a `basis` label (stated or inferred) to every fact. Keep the position-spread rule |
| Incremental updating of a running summary keeps more detail than hierarchical merging, with a small loss in coherence | BooookScore (Chang et al., ICLR 2024) | Keep the current design: one fact sheet per chapter plus a running ledger. Never write a chapter from earlier summaries |
| An automated key-fact hierarchy (root, branch, leaf) agrees with experts over 90% of the time. Models are weakest on fine (leaf) facts and show lost-in-the-middle effects. Open models trail closed ones | HAMLET (Deng et al., EMNLP 2025) | Measure must-carry recall against a gold set per model. Expect different pass rates and record them |
| LLM judges tend to prefer their own outputs. A 2026 study finds most of the effect goes away under blind evaluation | Wataoka et al., 2024; Panickssery et al., 2024; Findings of EMNLP 2026 | Judges are blind to who wrote the guide. Use a judge from another model family when one is available, and record whether it was |
| A quote selector re-anchors text robustly; pair it with a position | W3C Web Annotation Data Model; EPUB annotations | Anchor = file + paragraph + a short exact quote, kept in `work/` only (5.4) |
| MCP 2026-07-28 is the current spec (stateless core) | modelcontextprotocol.io | Optional: an MCP server for the scripts, only for clients with no shell |
| Inspect (UK AI Security Institute) runs the same evaluation on many providers and on local models | inspect.aisi.org.uk | Optional harness for the conformance suite across models |

## 5 · The proposed standard

### 5.1 · Words used

The spec uses MUST, SHOULD and MAY (RFC 2119). A **stage** is one step with fixed inputs and one
output file. A **gate** accepts or rejects a stage's output. A **judge** is a model stage that
checks, not writes.

### 5.2 · The pipeline as stages

Every stage reads only its listed inputs and writes one file that MUST validate against its
schema. Model stages load only the rules they need (G11). The unit of work is one chapter. A
chapter of 10,000 words is about 13,000 tokens, so most stages fit a 32,000-token context.

| Stage | Kind | Inputs | Output (in `work/<guide>/`) | Gate |
|---|---|---|---|---|
| S0 Intake | person | type, title, author, limit, edition, book file | `intake.json` | schema |
| S1 Extract | script | book file | `source/` (text files, `toc.json`, `meta.json`) | script exit code |
| S2 Plan | model | `toc.json`, intake | `plan.json`: id, parts, chapters, lengths, the book's question | schema; chapters = toc chapters |
| S3 Read | model, per chapter | that chapter's text; plan; cast and concepts so far | `facts/<ch>.json` | schema; `check_guide.py facts` |
| S4 Ledger | model, per chapter, in order | `facts/<ch>.json`; ledger up to the chapter before | `ledger/<ch>.json` | schema; anchors |
| S5 Concepts | script, then model review | all fact sheets | `concepts.json` | schema |
| S6 Write Map | model, per chapter | `facts/<ch>.json`, ledger to `<ch>`, `concepts.json`, type recipe | chapter fragment `map/<ch>.json` | schema; `validate` |
| S7 Write styles | model, per chapter | as S6, plus the Map chapter | `styles/<ch>.json` | schema; `validate` |
| S8 Build | script | plan, fragments | four `src/books/<guide>-*.json` | `validate`, `check_guide.py names` |
| S9 Verify claims | judge, isolated, per chapter | chapter text, fact sheet, ledger, the chapter in all four styles | `verdicts/<ch>.json` | 0 unsupported claims after fixes |
| S10 Recall test | reader, then scorer, both isolated | reader: guide text only. Scorer: answers and key, no book | `recall/<style>-<ch>.json` | ≥ 80% overall, ≥ 60% per chapter |
| S11 Final checks | script | the four files | `checks.json` | `check:screens`, `build` |
| S12 Deliver | agent or person | the four files, `run.json` | commit | only `src/books/` changes |

A failed gate sends its messages back to the same stage. The stage MAY repeat up to two times;
then the run stops and reports the gate output.

### 5.3 · The isolation rule (replaces "fresh subagent" and "task list")

> An **isolated run** is a new model context that receives only the files the stage lists, and
> nothing from the writer's context. It MUST NOT see the writer's reasoning, earlier drafts or
> the answer key, unless the stage lists them.

Three equal ways to meet it:

1. A sub-agent, in agents that have them (Claude Code, Codex and others).
2. A separate call through the runner: `python3 tools/gr.py stage verify --guide <g> --chapter ch3`.
3. A different model, app or person, given the bundle that `check_guide.py text` writes.

The checklist lives in a file, not in a tool: `work/<guide>/progress.md`. Every agent can tick it.

### 5.4 · How to interpret a book

These rules make two models read the same chapter in the same way.

**1 · The text model.** `extract_book.py` defines the text: one file per entry of the book's
contents (`005.txt`), paragraphs numbered from 1, straight quotes, no thousands separators
(13,000 → 13000), dotted capitals joined (U.S. → US). The spec states these rules, so every
runner sees the same paragraph numbers.

**2 · Anchors.** Every fact has an anchor. Grammar: `NNN pA` or `NNN pA–pB`. The anchor object in
working files adds a short exact quote, 12 words at most, from the first paragraph of the range:

```json
{ "file": "005", "p": [11, 11], "quote": "she remained with no very cordial feelings" }
```

The facts check confirms that the quote is in that paragraph (G5). A wrong paragraph now fails.
The quote lives only in `work/`, which is never committed. Guides still MUST NOT quote the book.

**3 · Units.** Chapter = one entry of the book's contents. Fiction scene = a new place or a new
time starts a new scene; very short passages merge into the nearest scene; a flashback or a story
told by a character is its own scene. Non-fiction claim = one assertion the author makes, with
its reason when the text gives one.

**4 · What to record.** Each fact has a `type` from a closed list:

| Fiction | Non-fiction |
|---|---|
| `scene`, `person` (first appearance, role in the book's words), `relation`, `state` (feels, wants, knows, has), `cause` | `claim`, `evidence` (example, study, number), `term`, `bridge` (the author points to a later part) |
| Both: `concept` (defined concept, typology, contrast, views, indirect distinction, story concept: `references/concepts.md`) | |

**5 · Stated or inferred.** Every fact has `basis`: `stated` (the text says it) or `inferred`
(the closest paragraph supports it, the text does not say it). Feelings, motives, knowledge and
relations MUST be `stated` to go on a screen. This targets the error classes that FABLES found.

**6 · What to keep (must carry).** 5–8 items per chapter, chosen by tests, not by "importance": a
change of state, a cause of later events, a concept the book builds on, the main claim, a question
left open. At least one item from the first third and one from the middle third; at most half
from the last third. Each item has a cued question and a short answer.

**7 · State at the chapter's end (ledger).** Each entry is a change on one dimension. The
dimensions come from the event-indexing model (time, place, people, goal, cause), plus relation,
knowledge, possession and view. Non-fiction entries have a status: `established`, `open`,
`answered` or `promised`.

```json
{ "entity": "Elizabeth", "dimension": "view", "about": "Mr Darcy",
  "before": null, "after": "dislikes him", "cause": "he slighted her at the ball",
  "anchor": { "file": "005", "p": [11, 11], "quote": "…" } }
```

**8 · The spoiler gate.** Unchanged: with a limit, files after it move to `after-limit/` before
any model reads the text.

**9 · Pinned examples.** Each judgement rule has two worked examples, one right and one wrong,
taken from the public-domain fixtures (5.7). Prompts include them. This reduces drift between
models more than longer prose does.

### 5.5 · Intermediate outputs

JSON files with schemas replace the Markdown working files. A script renders each one as Markdown
for a person to read.

| File | Schema | Replaces |
|---|---|---|
| `intake.json`, `plan.json` | `intake`, `plan` | the plan in the chat |
| `facts/<ch>.json` | `facts` | `facts/<ch>.md` |
| `ledger/<ch>.json` | `ledger` | `ledger.md` |
| `concepts.json` | `concepts` | `concepts.md` |
| `styles/<ch>.json` | `styles-chapter` | one entry of `styles.json` (the script joins them) |
| `verdicts/<ch>.json` | `verdict` | the verifier's chat reply |
| `recall/<style>-<ch>.json` | `recall-score` | the score in the chat |
| `run.json` | `run` | nothing (new) |

A fact sheet, shortened:

```json
{
  "chapter": "ch3", "sources": ["005"], "words": 1722,
  "facts": [
    { "id": "F7", "type": "scene", "basis": "stated",
      "text": "Elizabeth overhears Mr Darcy refuse to dance with her",
      "when": "Later that night", "where": "the assembly",
      "with": ["Elizabeth", "Mr Darcy", "Mr Bingley"], "off": [],
      "anchor": { "file": "005", "p": [11, 11], "quote": "…" } }
  ],
  "must_carry": [
    { "id": "M1", "kind": "state", "facts": ["F7"],
      "text": "Elizabeth dislikes Mr Darcy, because she overheard him slight her",
      "question": "How does Elizabeth feel about Mr Darcy after the ball, and why?",
      "answer": "She dislikes him, because she overheard him slight her" }
  ]
}
```

A claim verdict, shortened:

```json
{ "chapter": "ch3",
  "claims": [
    { "style": "map", "where": "screens[0].text", "claim": "The town judges Darcy proud",
      "verdict": "supported", "anchor": "005 p6" } ],
  "must_carry": [
    { "id": "M1", "map": "screens[0]", "recap": "screens[1]", "recall": "screens[1]", "layers": "missing" } ],
  "resume": { "matches_ledger": true, "later_facts": [], "names_without_role": [] } }
```

### 5.6 · Final outputs

The four book files do not change. Three additions make them a contract any tool can use.

**1 · `schemas/book.schema.json`.** Generated from `src/model/types.ts`, so TypeScript stays the
one source. A test fails when the schema is out of date or when a book file in `src/books/` does
not validate. (Generator to confirm in phase 1, for example `ts-json-schema-generator`.)

**2 · The LLM profile.** Each model stage writes one chapter, so its schema is small. A script
derives a strict copy of every schema for model calls:

- `additionalProperties: false` on every object;
- every property in `required`; an optional field becomes `anyOf: [<type>, {"type": "null"}]`, and
  the runner removes the nulls after the call;
- closed sets as `enum`; screen types as `anyOf` of objects, each with a `const` `type`;
- no recursion; no `minLength`, `maxLength`, `minimum` or `maximum` (support differs; word and item
  limits are lint rules after the call).

**3 · A rule catalogue with IDs.** `spec/rules.md` lists every rule once: ID, rule, how it is
checked, severity. `lint.ts`, `check_guide.py` and the judges print the ID. Areas: S structure,
C content, I interpretation (5.4), W writing, V visuals, R resume screens, M must carry.

| ID | Rule | Check |
|---|---|---|
| GR-S01 | The guide's parts and chapters are the book's, in order, under the book's names | `validate`, plan gate |
| GR-C01 | Every claim is in the book | judge S9 |
| GR-C04 | No quotation of six words or more | `validate` |
| GR-W03 | No "and then"; no sentence that starts with "Then" | `validate` |
| GR-R01 | Every written chapter ends with "Where it stands" (four fixed titles), then "Still open" | `validate` |
| GR-M02 | Every must-carry item is on a screen that each style shows | judge S9, recall test |

A gate line then reads the same for every model:

```
GR-W03 nexus-summary-map ch3 screens[2].text: "and then" → write the cause ("so", "because")
```

`writing-style.md` becomes normative on its own. The Economist Style Guide is named as its
origin, not as a second source of rules (G10).

### 5.7 · Verification and conformance

**Judges.** S9 and S10 use fixed rubrics and write JSON (5.5). Rules:

- A judge MUST be an isolated run (5.3) and MUST NOT know which model wrote the guide.
- A judge SHOULD be from a different model family than the writer. When only one model is
  available, the run continues and `run.json` records `"judge_independent": false`.
- The recall reader gets the guide text only: no book, no key. It cites a screen for every answer;
  an answer with no citation scores zero (a model may know a famous book already).
- The scorer gets the answers and the key, not the book.

**Conformance suite.** Two public-domain books, so their text can live in the repository:

| Fixture | Type | Why |
|---|---|---|
| Pride and Prejudice, chapters 1–6 (with limit) | fiction | Already the running example; tests scenes, states, relations, the spoiler gate |
| John Stuart Mill, *On Liberty* (five chapters) | non-fiction | Short; defined concepts and contrasts; tests the concept inventory |

For each fixture, a reviewed gold set: must-carry items with questions and answers, the concept
inventory, the ledger at each chapter's end, and a list of known false claims for the judge to
catch.

| Metric | Pass |
|---|---|
| Schema-valid output on the first call | recorded (no pass mark) |
| All gates clean after at most two repairs | required |
| Anchors valid, quotes found | 100% |
| Gold must-carry recall (key-fact recall, as in HAMLET) | ≥ 80% |
| Gold concept recall | ≥ 90% |
| Planted false claims caught by the judge | ≥ 90% |
| Blind recall test, every style | ≥ 80% overall, ≥ 60% per chapter |
| Tokens and time per chapter | recorded |

A model, agent or runner is **conformant with spec 1.0** when it passes both fixtures.
`python3 tools/gr.py eval` runs the suite; Inspect MAY run it across many providers.

### 5.8 · Provenance

`work/<guide>/run.json` records every stage: prompt version, attempts, gate result. The book
file's `source` gains optional fields:

```json
"source": { "kind": "book-file", "file": "EPUB", "written": "2026-11-15", "skill": "1.6.0",
            "spec": "1.0.0",
            "checks": { "recall": { "map": 0.93, "recap": 0.93, "recall": 0.86, "layers": 0.84 },
                        "unsupported_claims": 0, "judge_independent": true } }
```

Whether the committed file also names the models is decision D3 (section 8).

### 5.9 · Packaging

| Item | Change |
|---|---|
| `AGENTS.md` (new, root) | What the repository is, the commands, the rule that `work/` is never committed, and "to add a book, follow `.agents/skills/ghostreader-book/SKILL.md`" |
| `CLAUDE.md` (new, root) | One line: `@AGENTS.md`, so Claude Code reads the same file. Other agents that use their own file name by default get the same one-line pointer, or a setting |
| Skill folder | Canonical at `.agents/skills/ghostreader-book/`. `.claude/skills/ghostreader-book` becomes a link to it. Test that Claude Code still finds it; if not, a sync script and a CI check |
| Scripts | Move to `tools/` at the root (CI and the runner use them too). Commands use `tools/…` paths (G15) |
| SKILL.md | Shorter: overview, inputs, the stage table, the isolation rule, links. The detail moves to the stage prompts and the spec (G12) |
| Runner `tools/gr.py` (new) | Level B. Reads a stage's prompt, gathers its inputs, calls an OpenAI-compatible endpoint with the LLM-profile schema, validates, runs the gate, repairs up to two times, writes the file and `run.json`. Configured by `base_url`, `model` and the name of the key's environment variable |
| MCP server (optional, later) | Exposes extract, checks, build and recall test as tools, for clients with no shell |

A prompt template, header only:

```markdown
---
stage: read
version: 1.0.0
output_schema: schemas/facts.schema.json
inputs: [chapter_text, plan, cast_so_far, concepts_so_far]
rules: [GR-C01, GR-C02, GR-I01, GR-I05, GR-M01]
examples: fixtures/pride-and-prejudice/examples/read-ch3.json
isolation: required
---
```

## 6 · Proposed layout

```
AGENTS.md                         new: cross-agent entry point
CLAUDE.md                         new: @AGENTS.md
spec/
  README.md                       the standard: stages, isolation, interpretation, versioning
  rules.md                        rule catalogue with IDs
schemas/                          JSON Schema 2020-12; *.llm.json = strict LLM profile
  book.schema.json  plan  facts  ledger  concepts  styles-chapter  verdict  recall-score  run
prompts/                          one model-neutral template per model stage
  plan.md  read-chapter.md  ledger.md  write-map.md  write-styles.md  verify.md  recall-reader.md  recall-scorer.md
fixtures/                         public-domain texts, gold sets, worked examples
  pride-and-prejudice/  on-liberty/
tools/                            extract_book.py  check_guide.py  build_styles.py  map.py  gr.py
.agents/skills/ghostreader-book/  SKILL.md + references (shorter)
.claude/skills/ghostreader-book   link to the folder above
```

## 7 · Migration plan

| Phase | Work | Size | Result |
|---|---|---|---|
| 1 · Open the door | `AGENTS.md`, `CLAUDE.md`; skill to `.agents/skills/` with a link; scripts to `tools/`; neutral wording (isolation rule, `progress.md`); `book.schema.json` with a test; rule IDs in `lint.ts` and `check_guide.py`; `--json` output for the checks | S | Level A works in other agents for the current process |
| 2 · Pin the contracts | JSON working files with schemas and Markdown renderers; anchor quotes; verdict and score files; stage prompts with pinned examples; `writing-style.md` normative | M | Same files, same checks, whatever the model |
| 3 · Measure | Fixtures and gold sets; runner `gr.py` (Level B); `gr eval`; cross-family judges; `run.json`; `source.spec` and `source.checks` | L | Conformance scores per model |
| 4 · Optional | MCP server; Inspect tasks; a spec version policy (semver: a new required field = major) | S | Clients with no shell |

Each phase ships on its own. Claude Code keeps working at every phase: a sub-agent is one way to
meet the isolation rule. The Nexus guide needs no rewrite; its files will validate against the
generated schema. Its old working files are gone, so the JSON working files apply from the next
run.

## 8 · Decisions for you

| # | Decision | Recommendation |
|---|---|---|
| D1 | Working files in JSON (with Markdown views) or keep Markdown with a strict grammar | JSON. Every provider can constrain JSON output; nothing constrains a Markdown grammar |
| D2 | Allow public-domain book text in the repository as fixtures (an exception to "book text is never committed") | Yes, public domain only, under `fixtures/`, with its source noted |
| D3 | Name the models in committed book files, or only in `work/<guide>/run.json` | Only in `run.json`; commit the spec version and the scores |
| D4 | Runner interface: OpenAI-compatible endpoint only, or native adapters too | OpenAI-compatible first (hosted and local servers expose it); add a native adapter only where schema output fails |
| D5 | Thresholds for conformance | Start with section 5.7; adjust after the first runs on two model families |

## 9 · Risks and limits

- **Quality differs between models.** A standard makes outputs comparable, not equal. HAMLET and
  BooookScore both found open models behind closed ones. The suite measures it; it does not fix it.
- **Constrained output is not a guarantee.** Strict modes fail at times. The runner always
  validates and repairs.
- **Judges are models too.** Blind, cross-family judging reduces bias; the planted false claims
  measure what judges miss.
- **Rules in two places.** Rules live in prose and in `lint.ts`. The rule catalogue with IDs, and
  a test that every ID in the code is in the catalogue, keep them together.
- **Links to skills.** Some clients may not follow a linked skill folder. Phase 1 tests it.
- **No study tests book recaps after long pauses** (styles.md already says so). The recall test
  is the project's own proxy.

## Sources

- [Agent Skills specification](https://agentskills.io/specification) and [client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)
- [OpenAI: Agentic AI Foundation](https://openai.com/index/agentic-ai-foundation/); [AAIF: measuring AGENTS.md](https://aaif.io/blog/measuring-agents-md-what-five-runs-show-that-one-doesn-t)
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28); [release post](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs.md); [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs); [Gemini structured outputs announcement](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/); [dottxt provider comparison](https://docs.dottxt.ai/providers-comparison.md); [structured output comparison](https://glukhov.org/post/2025/10/structured-output-comparison-popular-llm-providers)
- [FABLES (Kim et al., 2024)](https://arxiv.org/abs/2404.01261)
- [BooookScore (Chang et al., ICLR 2024)](https://arxiv.org/abs/2310.00785)
- [HAMLET (Deng et al., EMNLP 2025)](https://arxiv.org/abs/2508.19578)
- [Self-preference bias in LLM-as-a-judge (Wataoka et al., 2024)](https://arxiv.org/abs/2410.21819); [LLM evaluators recognize and favor their own generations (Panickssery et al., NeurIPS 2024)](https://arxiv.org/abs/2404.13076); [Findings of EMNLP 2026 paper on self-preference under blind evaluation](https://aclanthology.org/2026.findings-emnlp.1571.pdf)
- [W3C Web Annotation Extensions for Web Publications](https://www.w3.org/TR/wpub-ann/); [EPUB 3.4 annotations draft](https://w3c.github.io/epub-specs/epub34/annotations/)
- [Inspect (UK AI Security Institute)](https://inspect.aisi.org.uk)
