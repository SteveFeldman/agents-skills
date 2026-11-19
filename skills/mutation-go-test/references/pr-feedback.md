# PR test feedback (Go / Gooze): comparison, findings, and the feedback loop

Use this when the question is "how good are the tests in this PR?" rather than "what is the mutation score?". The output is feedback an author (human or agent) can act on, re-verify, and close.

## 1. Isolated workspace (never the user's checkout)

```bash
SHA=$(gh pr view <n> --json headRefOid -q .headRefOid)     # or git rev-parse <pr-head>
BASE=$(git merge-base origin/<base-branch> "$SHA")          # run in the real checkout
WS=$(mktemp -d /tmp/gooze-pr-XXXX)
git clone -q --local --no-checkout . "$WS" && git -C "$WS" checkout -q "$SHA"
GOBIN="$WS/bin" go install gooze.dev/pkg/gooze@v1.6.1
cp <skill-dir>/references/gooze.config.template.yaml "$WS/gooze.yaml"
```
- The user's checkout, `go.mod` and `go.sum` are untouched; delete `$WS` and the `/tmp/gooze-*` reports at the end.
- A local clone (not `git archive`) keeps history so `--diff` works. The PR head must be fetched in the real checkout first (`git fetch origin <branch>`).
- Compute ranges and changed test files in the real checkout: `go run <skill-dir>/scripts/diff-ranges.go --base <base> --head $SHA [--tests]`.
- Baseline first: `go test ./<affected pkgs>` in `$WS` must be green (Gooze also checks this per package and exits `7` otherwise).

## 2. Two runs, same source, same mutants

| Run | Source | Tests | Answers |
|---|---|---|---|
| **A: base tests** | PR head | `_test.go` files from the merge-base (`git show <base>:<path>` for each test file the PR changed; delete test files the PR added) | What did the old tests already catch? |
| **B: PR tests** | PR head | PR head | What do the tests now catch? |

```bash
cd "$WS"
$WS/bin/gooze run --diff $BASE -o /tmp/gooze-B ./...       # run B (PR tests); reports land in /tmp/gooze-B/run
# swap in the base test files, then:
$WS/bin/gooze run --diff $BASE -o /tmp/gooze-A ./...       # run A (base tests)
```
Use separate `-o` directories so A's cache does not feed B.

Then `go run <skill-dir>/scripts/summarize-mutants.go --report /tmp/gooze-B/run --compare /tmp/gooze-A/run --credit <pr-test-file>...`:
- **newlyKilled**: credit to the PR's test files. Gooze records the test file it chose for each mutant (`testFileChosenByGooze` in JSON output) but not which test killed it, and that file is only the sibling `_test.go` it prefers, not attribution. Name individual tests only after hand-applying the mutant in the workspace (take the diff from `gooze report view -o <dir> --all`), listing failing tests (`go test ./pkg -count=1 -json`, `"Action":"fail"`), then restoring the file (`git -C "$WS" checkout -- <file>`).
- **stillSurviving**: candidate findings (triage first).
- **noLongerKilled**: a test was weakened or removed. Always raise these.

Before run A, run the old test files once against PR source (`go test ./<pkg>`). If they don't compile or fail (common for refactors and bug-fix PRs: old tests pinned a signature or behavior the PR intentionally changed), Gooze exits `7` ("tests fail without any mutation in N package(s), so M mutants were not tested") and writes no usable reports. Mark the comparison **inconclusive**, list the compile errors/failing test names from that message as evidence that the author updated tests for the new behavior, and report run B alone. Do not patch or skip old tests to make them run.

**`--diff` scope rule:** a changed or new `x_test.go` puts its sibling `x.go` in scope **in full**, not only the changed lines. Those extra mutants sit on unchanged code; origin tagging (step 3.4) marks them `pre-existing`.

## 3. Triage before any recommendation

For every `survived`, `not_covered`, `timeout` (and `skipped`) mutant, before writing a suggestion:
1. **Reachability**: trace callers. Can the mutated condition actually flip (`nil` pointer, empty slice, zero value, error from a dependency)? If a validator upstream guarantees it can't, classify **defensive** (no test request; optional note).
2. **Equivalence**: does the mutant produce identical observable output? (A boundary where equal values take either branch with the same result; `i < n` vs `i != n` in a loop with a single increment; a `numbers` mutant on a value that is immediately overwritten.) Classify **equivalent**; if the user approves, suppress with `//gooze:ignore <mutagen>` and a reason.
3. **Fakes**: does the covering test stub the very function being mutated (interface fake, `httptest` handler that returns canned output)? Then the survivor says little about the real path. For `not_covered`, check whether the covering test lives in another package: Gooze runs only the mutant's own package tests.
4. **Origin**: did this PR write the mutated code, or only reformat/move it? Run from the repo checkout:
   `go run <skill-dir>/scripts/summarize-mutants.go --report /tmp/gooze-B/run --origin-ref $BASE --repo .`. A mutant is `pre-existing` when its whole line already existed in the base file, ignoring whitespace, trailing commas and semicolons (gofmt re-alignment and moved lines count). A renamed variable counts as `new`; spot-check with `git show $BASE:<file>` before telling an author something is not theirs.
5. **Timeouts**: a `timeout` is not a kill. Rerun with a larger `--mutation-timeout` or lower `--parallel`; if it still hangs, the mutant probably created an infinite loop (common with `loop`/`branch` mutagens). Classify **test-infra** or **equivalent** and say which.
6. Only then classify **real gap** and write a suggested test with the exact assertion that would fail on the mutant.

Classifications: `real-gap` | `defensive` | `equivalent` | `cosmetic` | `test-infra` | `untriaged`. Origin: `new` | `pre-existing`.

**Who owns what:** only `new` real gaps are the author's to address in this PR. `pre-existing` real gaps are optional ("not caused by this PR") or become a follow-up ticket. Never block a PR on them.

**Lines Gooze generated no mutants for:** changed lines such as comments, struct fields, imports, declarations and plain identifiers have nothing to mutate. List changed ranges with no mutants (use `diff-ranges.go` output minus the report's lines). Never describe them as covered; say "no mutations generated here, so the result says nothing about these lines".

**Opt-in mutagens:** `branch` and `statement` are on in the template because they are what catches a removed guard or dropped call. They may add `error` (does not compile) mutants; those are excluded from the score and listed as "build errors" by Gooze.

## 4. Finding record (machine-readable)

Write `mutation-findings.json` in the session/workspace (not the repo):

```json
{
  "pr": "owner/repo#123",
  "headSha": "c941d850…",
  "tool": "gooze v1.6.1",
  "mutate": ["service/kibo/session.go:340-347"],
  "comparison": "complete | inconclusive: <reason> | not-run",
  "findings": [
    {
      "id": "MT-bfe19366d9",
      "file": "service/kibo/session.go",
      "line": 341,
      "mutagen": "branch",
      "original": "if orderErr != nil {",
      "mutated": "if false {",
      "classification": "real-gap",
      "origin": "new",
      "state": "open",
      "attempts": 0,
      "evidence": "survived; no test makes the order lookup fail",
      "question": "What should happen when the order lookup fails during login-from-checkout? No test asserts the returned error.",
      "suggestedTest": "stub the order endpoint to return 500 and assert the login call returns that error",
      "repro": "gooze run --diff <base-sha> ./...   # run in the workspace, module root"
    }
  ]
}
```
- `id` comes from `summarize-mutants.go`: `MT-` plus the first 10 hex characters of Gooze's own mutation ID, which is a hash of the **entire mutated file**. It is stable across reruns of the same source (including after you only add tests). Any edit anywhere in that file changes every ID in it: re-anchor by file + mutagen + original text + nearby line and note "re-anchored".
- `state`: `open` → `verified` (rerun shows killed) | `inconclusive` (flaky, timeout, cannot run) | `wont-fix` (author/maintainer decision, with reason). Only a rerun can set `verified`.

## 5. Feedback loop

**Agent author (or this agent proposing tests):**
1. Apply the suggested test **in the isolated workspace only**.
2. Run the test alone (`go test ./pkg -run '^TestX$' -count=1`; must pass on unmutated source), then Gooze at the new head with the same `--diff` scope. Gooze re-tests a file when its source or test file changed; add `--no-cache` if you changed neither. For a single function, `--run '^FuncName$'` is faster.
3. Killed → `verified`. Still survives → `attempts += 1`, refine once. Max **2 attempts per finding**, then `inconclusive` with the reason.
4. Run the affected tests `-count=3` (plus `-race` if the repo uses it); differing results → `inconclusive (flaky)`. Never count a flaky kill.
5. Hand back a patch plus updated `mutation-findings.json`. Never push or commit.
6. Put tests for `new` gaps in the PR patch. Tests for `pre-existing` gaps go in a separate optional patch or a follow-up ticket, so the PR stays focused.

**Human author:**
1. Show the draft feedback comment and scorecard (section 6) locally. Post nothing without explicit approval.
2. Before sharing, review the draft as the author would: is it clear what to do, whether it blocks, and whose code it is? Then revise.
3. On new commits: recompute ranges, rerun at the new head, re-anchor IDs, update states, and edit both existing comments.
4. Stop when every finding is `verified`, `wont-fix`, `equivalent`, or `defensive`. Don't open new rounds for low-value mutants (arithmetic in log text).

## 6. Author-facing outputs (draft locally; post only with approval)

Produce two separate Markdown files in the session folder, not the repo. On request, copy one with `pbcopy < file.md` (macOS) and confirm with `pbpaste | diff -q - file.md`.

| File | Marker | Purpose |
|---|---|---|
| `pr-comment.md` | `<!-- mutation-go-test-skill -->` | What, if anything, the author should do |
| `scorecard.md` | `<!-- mutation-go-test-skill:scorecard -->` | Numbers and verdict |

**Posting:** find an existing comment with the same marker and edit it: `gh api -X PATCH repos/{owner}/{repo}/issues/comments/{id} -F body=@file.md` (`-F` reads the file; `-f` would post the literal text). Otherwise use `gh pr comment <n> --body-file file.md`. Never post one comment per finding. Never include local paths, tokens, or env output.

### Feedback comment rules
1. **Say whether it's blocking** in the heading. With no `new` real gaps open, it is non-blocking.
2. **Credit first, specifically**: name the tests and what they catch (only tests you verified by hand-applying the mutant).
3. **Separate ownership.** Say "not caused by this PR" for `pre-existing` gaps, and offer a follow-up ticket as the alternative.
4. **Paste the verified test inline** (only tests that killed the mutant in a rerun and passed 3/3). "Available on request" costs the author a round trip.
5. **No rhetorical questions.** If the answer is obvious from the code, state the gap plainly instead. Ask only when intent is genuinely unclear.
6. **No jargon or scores** in the feedback comment ("mutant", "survived", score %). Say "replacing the `orderErr != nil` check on line 341 with `false` still passes the suite". Numbers go in the scorecard.
7. **Leave out non-actionable survivors** (equivalent, defensive, cosmetic). At most add one closing line: "nothing else here needs action".
8. **Be honest about what Gooze didn't generate.** If part of the PR's change produced no mutants (struct fields, declarations, config), say the analysis didn't cover it. If `loop` was off, don't imply loop logic was checked.
9. **Verify every factual sentence against the report** before showing it. "Fails if the guard is removed" must match the per-mutant statuses for that line. Prefer precise claims only when the report or a hand-applied mutant shows them.

```markdown
<!-- mutation-go-test-skill -->
### Mutation testing notes (non-blocking)

Nice work on <specific new logic>. `<TestName>` fails if `<new code>` is inverted, and <other tests> are just as thorough.

**Optional, not caused by this PR:** <pre-existing code> has no test for <case>. Replacing <expr> still passes the suite. If you'd like to cover it while you're in this file, this does it (goes after `<neighbor test>` in `<test file>`):

<verified test snippet>

If you'd rather keep this PR focused, I can open a follow-up ticket instead. Either way, nothing else here needs action.
```

For a `new` real gap, use the heading "(1 item to address)", describe the uncovered behavior the PR introduced, and include the verified snippet.

### Scorecard and verdict
Generate the numbers with `summarize-mutants.go --report <B>/run --findings mutation-findings.json --origin-ref <merge-base>`. Show both the raw score (the one `gooze run` prints) and the actionable score; the actionable score drops equivalent, defensive and cosmetic survivors from the denominator.

**Verdict "meets the bar"** requires all of the following:
- every file's actionable score meets its target (80% for logic: auth/session, pricing/payment, state, validation; 60% for glue, handlers and DTO mapping);
- no `new` real gap is `open`;
- no `noLongerKilled` mutants in a complete comparison;
- no unexplained `timeout` mutants (they lower the score and are not kills);
- at least one mutant was generated for the PR's logic. If the PR's changed lines produced **no mutants**, the verdict is "not assessable by Gooze" (say so), never "meets the bar".

Otherwise the verdict is "needs work", listing which condition failed. Never give a verdict from the raw score alone, and never hide the raw score.

```markdown
<!-- mutation-go-test-skill:scorecard -->
### Mutation testing scorecard: PR #<n>

**Verdict: ✅ The tests meet the bar.** <one sentence: actionable targets met; new logic has no untested mutations>

Gooze <ver>, changed lines only, head `<sha7>`, mutagens: <list>. A mutation counts as caught when at least one test fails after the code is altered.

| File | Mutations | Killed | Raw score | Actionable score¹ | Target² | Result |
|---|---:|---:|---:|---:|---:|:---:|
| `<file>` | 24 | 22 | 95.7% | 100% (22/22) | 80% | ✅ |
| **Total** | | | | | | |

¹ Excludes N survivors that don't need a test: <counts and one-line reasons>.
² Guidance targets: 80% for logic, 60% for glue code.

**Excluded (did not compile):** <N error mutants>
**Not assessable (no mutants generated):** <files:ranges>
**Remaining survivors:** <pre-existing gaps, optional, link to feedback comment>
**Strongest tests:** <test files / names verified by hand-applying mutants>

_Caveats: changed lines only (plus whole sibling source files when their `_test.go` changed); the score is for mutations generated, not all possible bugs; mutagens enabled: <list>. Comparison with base tests: <complete | inconclusive: reason>._
```
