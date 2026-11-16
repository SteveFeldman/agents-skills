# PR test feedback: comparison, findings, and the feedback loop

Use this when the question is "how good are the tests in this PR?" rather than "what is the mutation score?". The output is feedback an author (human or agent) can act on, re-verify, and close.

## 1. Isolated workspace (never the user's checkout)

```bash
SHA=$(git rev-parse <pr-head>)            # or gh pr view <n> --json headRefOid -q .headRefOid
WS=$(mktemp -d /tmp/mut-pr-XXXX)
git archive "$SHA" | tar -x -C "$WS"
cp -cR node_modules "$WS/"                 # APFS clone on macOS; use `cp -R` (slower) elsewhere
cd "$WS" && env -u NODE_TLS_REJECT_UNAUTHORIZED npm i --no-save --ignore-scripts --no-audit --no-fund \
  @stryker-mutator/core@<ver> @stryker-mutator/<runner>@<ver>
```
- The user's checkout, `node_modules`, and lockfile are untouched; delete `$WS` at the end.
- Compute ranges in the real checkout (`diff-mutate-ranges.mjs --base <base>`), since the archive has no `.git`.

## 2. Two runs, same source, same mutants

| Run | Source | Tests | Answers |
|---|---|---|---|
| **A: base tests** | PR head | test files from the merge-base (`git show <base>:<path>` for each test file the PR changed; delete files the PR added) | What did the old tests already catch? |
| **B: PR tests** | PR head | PR head | What do the tests now catch? |

Then `node scripts/summarize-mutants.mjs --report B.json --compare A.json --credit <pr-test-file>...`:
- **newlyKilled**: credit to the PR's tests (name them via `killedBy`).
- **stillSurviving**: candidate findings (triage first).
- **noLongerKilled**: a test was weakened or removed. Always raise these.

Before run A, run the old test files once against PR source. If they fail (common for bug-fix PRs: the old tests pinned behavior the PR intentionally changed), mark the comparison **inconclusive**, list the failing test names as evidence that the author updated tests for the new behavior, and report run B alone. Do not patch or skip old tests to make them run.

## 3. Triage before any recommendation

For every survivor/no-coverage mutant, before writing a suggestion:
1. **Reachability**: trace callers. Can the mutated input (`undefined` entries, empty list, non-delivery cart) actually arrive? If a normalizer upstream guarantees it can't, classify **defensive** (no test request; optional note).
2. **Equivalence**: does the mutant produce identical observable output? (e.g. `|| ''` fed into a digits-only filter). Classify **equivalent**.
3. **Mocks**: is the module mocked in the covering test? Then the survivor says little about the real path.
4. **Origin**: did this PR write the mutated code, or only reformat/move it? Run from the repo checkout:
   `node scripts/summarize-mutants.mjs --report B.json --origin-ref <merge-base>`. A mutant is `pre-existing` when its whole line(s) already existed in the base file, ignoring whitespace, quotes, commas and semicolons. Prettier re-wraps, quote changes and moved lines all count. Spot-check with `git show <merge-base>:<file>` before telling an author something is not theirs.
5. Only then classify **real gap** and write a suggested test with the exact assertion that would fail on the mutant.

Classifications: `real-gap` | `defensive` | `equivalent` | `cosmetic` | `test-infra` | `untriaged`. Origin: `new` | `pre-existing`.

**Who owns what:** only `new` real gaps are the author's to address in this PR. `pre-existing` real gaps are optional ("not caused by this PR") or become a follow-up ticket. Never block a PR on them.

## 4. Finding record (machine-readable)

Write `mutation-findings.json` in the session/workspace (not the repo):

```json
{
  "pr": "owner/repo#123",
  "headSha": "69810bc4…",
  "stryker": "9.6.1 + jest-runner 9.6.1",
  "mutate": ["src/x.js:10-20"],
  "comparison": "complete | inconclusive: <reason> | not-run",
  "findings": [
    {
      "id": "MT-08d73f477f",
      "file": "src/client/components/Summary.js",
      "line": 774,
      "mutator": "ConditionalExpression",
      "original": "{cart.type === constantTypes.DELIVERY &&",
      "replacement": "true",
      "classification": "real-gap",
      "origin": "pre-existing",
      "state": "open",
      "attempts": 0,
      "evidence": "Survived; covered by 3 tests, none render a non-delivery cart",
      "question": "Should tipping stay hidden for non-delivery carts? No test currently asserts that.",
      "suggestedTest": "render Summary with cartType PICKUP and assert DeliveryTipping is absent",
      "repro": "npx stryker run stryker.pr.config.json --mutate \"src/client/components/Summary.js:774-776\""
    }
  ]
}
```
- `id` comes from `summarize-mutants.mjs` (hash of file, position, mutator, replacement). It is stable across reruns **of the same source**. If the author edits that line, the ID changes: match by file + mutator + nearby line and note "re-anchored".
- `state`: `open` → `verified` (rerun shows killed) | `inconclusive` (flaky, timeout, cannot run) | `wont-fix` (author/maintainer decision, with reason). Only a rerun can set `verified`.

## 5. Feedback loop

**Agent author (or this agent proposing tests):**
1. Apply the suggested test **in the isolated workspace only**.
2. Run the test file alone (must pass on unmutated source), then Stryker on **only the finding's range**.
3. Killed → `verified`. Still survives → `attempts += 1`, refine once. Max **2 attempts per finding**, then `inconclusive` with the reason.
4. Run the affected test file 3 times; differing results → `inconclusive (flaky)`. Never count a flaky kill.
5. Hand back a patch plus updated `mutation-findings.json`. Never push or commit.
6. Put tests for `new` gaps in the PR patch. Tests for `pre-existing` gaps go in a separate optional patch or a follow-up ticket, so the PR stays focused.

**Human author:**
1. Show the draft feedback comment and scorecard (section 6) locally. Post nothing without explicit approval.
2. Before sharing, review the draft as the author would: is it clear what to do, whether it blocks, and whose code it is? Then revise.
3. On new commits: recompute ranges, rerun at the new head, re-anchor IDs, update states, and edit both existing comments.
4. Stop when every finding is `verified`, `wont-fix`, `equivalent`, or `defensive`. Don't open new rounds for low-value mutators (StringLiteral, class names).

## 6. Author-facing outputs (draft locally; post only with approval)

Produce two separate Markdown files in the session folder, not the repo. On request, copy one with `pbcopy < file.md` (macOS) and confirm with `pbpaste | diff -q - file.md`.

| File | Marker | Purpose |
|---|---|---|
| `pr-comment.md` | `<!-- mutation-testing-skill -->` | What, if anything, the author should do |
| `scorecard.md` | `<!-- mutation-testing-skill:scorecard -->` | Numbers and verdict |

**Posting:** find an existing comment with the same marker and edit it: `gh api -X PATCH repos/{owner}/{repo}/issues/comments/{id} -F body=@file.md` (`-F` reads the file; `-f` would post the literal text). Otherwise use `gh pr comment <n> --body-file file.md`. Never post one comment per finding. Never include local paths, tokens, or env output.

### Feedback comment rules (lessons from #2285)
1. **Say whether it's blocking** in the heading. With no `new` real gaps open, it is non-blocking.
2. **Credit first, specifically**: name the tests and what they catch.
3. **Separate ownership.** Say "not caused by this PR" for `pre-existing` gaps, and offer a follow-up ticket as the alternative.
4. **Paste the verified test inline** (only tests that killed the mutant in a rerun and passed 3/3). "Available on request" costs the author a round trip.
5. **No rhetorical questions.** If the answer is obvious from the code (e.g. "should tipping stay hidden for pickup carts?"), state the gap plainly instead. Ask only when intent is genuinely unclear.
6. **No jargon or scores** in the feedback comment ("mutant", "survivor", score %). Say "replacing X with `true` still passes the suite". Numbers go in the scorecard.
7. **Leave out non-actionable survivors** (equivalent, defensive, cosmetic). At most add one closing line: "nothing else here needs action".
8. **Verify every factual sentence against the report** before showing it. For example, "catches every mutation of line N" must match the per-mutant statuses for line N. Prefer precise claims such as "fails if the guard is removed or inverted".

```markdown
<!-- mutation-testing-skill -->
### Mutation testing notes (non-blocking)

Nice work on <specific new logic>. "<test name>" fails if `<new code>` is removed or inverted, and <other tests> are just as thorough.

**Optional, not caused by this PR:** <pre-existing code> has no test for <case>. Replacing <expr> with `true` still passes the suite. If you'd like to cover it while you're in this file, this does it (goes after "<neighbor test>" in `<test file>`):

<verified test snippet>

If you'd rather keep this PR focused, I can open a follow-up ticket instead. Either way, nothing else here needs action.
```

For a `new` real gap, use the heading "(1 item to address)", describe the uncovered behavior the PR introduced, and include the verified snippet.

### Scorecard and verdict
Generate the numbers with `summarize-mutants.mjs --report B.json --findings mutation-findings.json --origin-ref <merge-base>`. Show both the raw score and the actionable score; the actionable score drops equivalent, defensive and cosmetic survivors from the denominator.

**Verdict "meets the bar"** requires all of the following:
- every file's actionable score meets its target (80% for logic: actions, reducers, pricing/payment, state; 60% for presentational components);
- no `new` real gap is `open`;
- no `noLongerKilled` mutants in a complete comparison.

Otherwise the verdict is "needs work", listing which condition failed. Never give a verdict from the raw score alone, and never hide the raw score.

```markdown
<!-- mutation-testing-skill:scorecard -->
### Mutation testing scorecard: PR #<n>

**Verdict: ✅ The tests meet the bar.** <one sentence: actionable targets met; new logic has no untested mutations>

Stryker <ver> + <runner>, changed lines only, head `<sha7>`. A mutation counts as caught when at least one test fails after the code is altered.

| File | Mutations | Caught | Raw score | Actionable score¹ | Target² | Result |
|---|---:|---:|---:|---:|---:|:---:|
| `<file>` | 13 | 12 | 92.3% | 100% (12/12) | 80% | ✅ |
| **Total** | | | | | | |

¹ Excludes N survivors that don't need a test: <counts and one-line reasons>.
² Guidance targets: 80% for logic, 60% for presentational components.

**Remaining survivors:** <pre-existing gaps, optional, link to feedback comment>
**Strongest tests:** <top 3 by kills from --credit>

_Caveats: changed lines only; the score is for mutations generated, not all possible bugs. Comparison with base tests: <complete | inconclusive: reason>._
```
