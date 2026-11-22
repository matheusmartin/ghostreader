# Stage prompts

One prompt per model stage of the guide workflow (`docs/proposal-model-neutral-guides.md`,
section 5.2). They are model-neutral: plain instructions, the exact inputs, the output schema,
and one right and one wrong example from `fixtures/sample/` (a short story written for the
tests, not a real book). An agent with a shell can follow them by hand; the runner
`tools/gr.py` fills them in and calls any model behind an OpenAI-compatible API.

| Prompt | Stage | Role | Output |
|---|---|---|---|
| `plan.md` | S2 Plan | writer | `work/<guide>/plan.json` |
| `read-chapter.md` | S3 Read | writer | `work/<guide>/facts/<chapter-id>.json` |
| `ledger.md` | S4 Ledger | writer | `work/<guide>/ledger/<chapter-id>.json` |
| `write-map.md` | S6 Write Map | writer | one chapter of `src/books/<guide>-map.json` |
| `write-styles.md` | S7 Write styles | writer | one chapter entry of `work/<guide>/styles.json` |
| `verify.md` | S9 Verify claims | judge (isolated) | `work/<guide>/verdicts/<chapter-id>.json` |
| `recall-reader.md` | S10 Recall test | reader (isolated) | `work/<guide>/recall-test/<style>-<chapter>-answers.json` |
| `recall-scorer.md` | S10 Recall test | scorer (isolated) | `work/<guide>/recall-test/<style>-<chapter>-score.json` |

## Format

Each file starts with a header between `---` lines, then the prompt text.

| Field | Meaning |
|---|---|
| `stage`, `version` | The stage and the prompt's version (semver: a change to the output or the inputs is a new major version) |
| `role` | `writer`, `judge`, `reader` or `scorer` |
| `isolation` | `required`: a new model context with only the inputs below (`references/verify.md`, "Isolated run"); `none`: the writer's own context may continue |
| `inputs` | `name: source`, one per line; the text uses each as `{{name}}` |
| `include` | Skill reference files to append after the prompt text, in this order: the rules the stage needs, and no others |
| `output` | The file to write and its schema; the model replies with that JSON only |
| `check` | The command that accepts or rejects the output; on problems, send the problem lines back with the same inputs, at most two times |

Placeholders: `{{guide}}`, `{{chapter}}` (a chapter id), `{{style}}`, and the input names. Paths
in `include` are relative to `.claude/skills/ghostreader-book/`; paths elsewhere are relative to
the repository root.
