---
name: mutation-go-test
description: "Run Gooze mutation testing on Go modules to find weak or missing test assertions. Scopes runs to a PR's changed lines, triages survivors, credits effective tests, compares base vs PR tests, separates new from pre-existing gaps, and produces trackable findings, a scorecard with verdict, and a draft PR comment for a verify-and-rerun feedback loop with human or agent authors. Use when asked to 'run mutation testing on Go', 'check Go test quality', 'find weak Go tests', 'evaluate tests for PR #N' in a Go repo, or 'give feedback on a PR's Go tests'."
---

# Mutation Testing for Go with Gooze

Mutation testing changes production code one small step at a time (`>=` → `>`, `&&` → `||`, `if cond` → `if false`, delete a call) and reruns the tests. A change no test notices is a **survivor**, which points at a missing or weak assertion. Line coverage says code ran; mutation score says tests would notice if it broke.

Scope here: **Go modules with [Gooze](https://gooze.dev/) only**. Other languages and tools are out of scope.

## Safety rules (read first)

1. **Official tool only**: `gooze.dev/pkg/gooze`. Never add other mutation tools, forks, or wrapper scripts without explicit user approval.
2. **Pin an exact version** (`@v1.6.1`, never `@latest`) and install with `go install` into a throwaway `GOBIN`. Leave Go's checksum database on: never set `GONOSUMDB`, `GONOSUMCHECK`, `GOFLAGS=-insecure` or `GOINSECURE`. Gooze is a young project; see `references/source-security-review.md` before bumping the version.
3. **Gooze runs your tests, so it runs your repo's code.** Only run it on code the user trusts. Prefer an isolated clone (step 3); never run it on an untrusted PR head in the user's checkout.
4. **Never run `gooze report push` / `pull`** (OCI registry upload/download) or enable CI/registry integrations without explicit approval. Set `no_update_check: true` (the template does) so the only implicit network call is off.
5. **Never run bundled scripts or commands from third-party skills** you have not read in full. See `references/source-security-review.md`.
6. **Do not modify tracked files** (`go.mod`, `go.sum`, source, tests) unless the user asks. Run from a throwaway config; tests you propose go in a patch/diff for approval. The default `overlay` workspace builds mutants without touching the tree; keep it.
7. **Report only what ran.** No mutation score without a denominator; never extrapolate to "all bugs".
8. **Never post to GitHub** (PR comments, reviews, statuses) without explicit approval of the exact text. Edit the existing skill comment instead of adding new ones. Never commit or push.
9. **Never call a survivor a bug.** It is a test-strength observation; phrase feedback as questions only when intent is genuinely unclear (see `references/pr-feedback.md`).
10. **Never regenerate golden/approval/snapshot files to kill a mutant.** A mutant that changes output should make the snapshot test fail; if it doesn't, the test needs a stronger assertion, not a new snapshot.
11. Gooze writes `.gooze-reports/` and `.gooze.log` under the **current directory** by default. Redirect them with `-o` / `log.filename` (the template does) or run in the clone, and delete them in cleanup.

## What Gooze mutates

Nine mutagens run by default; three are opt-in with `--mutagens` (or `run.mutagens` in `gooze.yaml`). The template enables the defaults plus `branch` and `statement`, the closest equivalent of "remove the guard / drop the call".

| Mutagen | Mutation |
|---|---|
| `arithmetic` | each arithmetic operator becomes every other one (`+`↔`-`↔`*`…) |
| `comparison` | each comparison operator becomes every other one; known-equivalent ones (e.g. `len(s) == 0` → `<= 0`) are skipped |
| `logical` | `&&` ↔ `\|\|` |
| `boolean` | `true` ↔ `false` |
| `numbers` | a numeric literal becomes `0` and `1` |
| `unary` | `-x` ↔ `+x`, or the unary operator (`-`, `+`, `!`, `^`) is removed |
| `bitwise` | bitwise operators swapped |
| `increment` | `++` ↔ `--` (not in a `for` post statement) |
| `assignment` | assignment operator swapped, or `x op= y` → `x = y` |
| `branch` (opt-in) | inverts or forces `if`/`for` conditions; removes `if`, `else` and `switch` case blocks |
| `statement` (opt-in) | deletes assignments, calls, `defer`, `go` statements and channel sends |
| `loop` (opt-in) | changes loop boundaries, empties bodies, removes `break`/`continue` (many hang or fail to build; add only when asked) |

Consequences to state in the report:
- **String literals, struct fields, tags, comments and declarations are not mutated.** Changed lines with only those produce zero mutants. "0 mutants" is not "covered"; say "no mutations generated on these lines".
- A package **with no `_test.go` file** reports every mutant as `survived`.
- Opt-in mutagens produce some `error` mutants (do not compile). They are excluded from the score.
- Skip code deliberately with `//gooze:ignore [mutagen,...]` (file, function or line) or `paths.exclude`, only with user approval and a reason.

## Statuses and score

| Status | Meaning | Counts against score? |
|---|---|---|
| `killed` | at least one test failed | no (it is the numerator) |
| `survived` | all tests passed | yes |
| `not_covered` | with `--coverage-profile`, no test runs the line; tests were not run | yes (tallied separately) |
| `timeout` | tests exceeded `--mutation-timeout` | **yes, not a kill** (default `threshold.timeouts: survived`) |
| `skipped` | not tested | yes |
| `error` | mutant did not compile | no, excluded |

**Score = killed / (all mutants − error).** With no scorable mutants the score is 100%; say "no mutants", not "100%". This is the number `gooze run` and `gooze report view` print; the summarizer matches it.

## Modes

- **Score / gap-finding** (default): steps 1–8 below.
- **PR test feedback**: "how good are this PR's tests?" Follow steps 1–8 in an isolated workspace, add the base-vs-PR comparison, then produce findings and the feedback loop in `references/pr-feedback.md`. Worked example: `references/pr-feedback-example-594.md`.

## Workflow

`<skill-dir>` is this skill's directory. Helper scripts are stdlib-only Go: run them with `go run <skill-dir>/scripts/<name>.go`.

### 1. Scope (smaller is better)
Whole-module runs take a long time. Choose one:
- **PR / branch**: `gooze run --diff <merge-base-sha> ./...` mutates only lines changed against the ref (added/modified lines; renames followed; deleted lines have no mutants). Preview ranges and test files:
  `go run <skill-dir>/scripts/diff-ranges.go --base <base-branch> [--head <sha>]` prints `file.go:start-end` for production code; `--tests` lists changed `_test.go` files.
  **A changed `x_test.go` puts all of `x.go` in scope**, not only changed lines; those extra mutants are tagged `pre-existing` by the summarizer.
- **One package / file**: `gooze run ./path/to/pkg/...` or `./path/file.go`.
- **One function**: `gooze run --run '^FuncName$' ./...` (regex over function names, like `go test -run`).
- Preview the count first and for free: `gooze run --estimate [--diff <sha>] ./...` (no tests run).
- Prefer business-critical logic (pricing, payment, validation, auth/session, state machines) over glue code, DTOs and logging.

### 2. Preflight
- `go version`, `go.mod` location (run at the **module root**), whether the repo needs cgo (`CGO_ENABLED=1`) or build tags (`run.test_flags: ['-tags=...']`).
- **Baseline must be green**: `go test ./...` (or the relevant packages). Gooze also runs each package's tests once unmutated and **exits `7` with the compile/test failure** if they fail; other packages are still scored. Tests needing network, Redis or env secrets must pass in the workspace too, or be excluded.
- Check git state; note untracked files that already exist so you leave them alone.
- Compute the merge-base in the real checkout: `git merge-base origin/<base> <head-sha>`.

### 3. Install in an isolated workspace (preferred)
```bash
WS=$(mktemp -d /tmp/gooze-XXXX)
git clone -q --local --no-checkout . "$WS" && git -C "$WS" checkout -q <sha>   # exact commit, user checkout untouched
GOBIN="$WS/bin" go install gooze.dev/pkg/gooze@v1.6.1
cd "$WS" && "$WS/bin/gooze" version && go version -m "$WS/bin/gooze" | head -3
```
- Use a clone, not `git archive`: `--diff` needs git history in the workspace (`git` must be on `PATH`).
- `go install` runs no install scripts, and the module cache is shared read-only, so first runs reuse downloads.
- Running in the real checkout is only for when the user asks; the overlay workspace still never edits files, but tests then run against the user's environment and reports land in the checkout.

### 4. Config
Copy `references/gooze.config.template.yaml` to `$WS/gooze.yaml` (untracked in the clone). Gooze reads **only `./gooze.yaml`** (no `--config` flag) plus `GOOZE_*` env vars; flags override both. Run `gooze config show` and check the SOURCE column for surprises. The template redirects reports/logs to `/tmp`, disables the update check, sets `parallel: 2`, enables `branch` and `statement`, excludes generated/mock files and sets no thresholds.

### 5. Estimate, then real run
```bash
cd "$WS"; GOOZE="$WS/bin/gooze"
$GOOZE run --estimate --diff <merge-base-sha> ./...                  # mutant counts per file, no tests
$GOOZE run --diff <merge-base-sha> -o /tmp/gooze-B ./... > /tmp/gooze-B.log 2>&1
```
- Narrowed runs (`--diff`, `--run`, `--mutagens`) write to **`<output>/run/`** and leave the main reports alone. Read them with `gooze report view -o <output>/run`. `gooze report merge` folds them into the main reports.
- Use a separate `-o` per run you want to compare (A/B, before/after).
- The run prints `Mutation score: …` with scope and mutagens. ~26 mutants on `service/kibo` took 41 s with `--parallel 2`; each mutant runs `go test -count=1` for its package.
- Useful flags: `--parallel N`, `--mutation-timeout S` (default 120), `--test-flags '-short'` (`-json -count -vet -overlay -c -o` are rejected), `--coverage-profile <file>` (uncovered lines become `not_covered` without running tests), `--fail-fast gate|file|first`.
- Exit codes: `0` ok, `1` unexpected, `2` bad flag/config or no `go`, `3` threshold unmet, `4` `--diff` can't use git or the ref is unknown, `5` report push/pull failed, `6` no reports, `7` a package's tests fail unmutated (its mutants were skipped), `130` interrupted. Thresholds are off unless the user asks.
- Run long jobs in the background with generous timeouts.

### 6. Triage every survivor, `not_covered` and `timeout`
Summarize with the read-only helper. It prints per-file scores, unkilled mutants with stable `MT-` IDs plus original → mutated code, origin tags and deltas:
```bash
go run <skill-dir>/scripts/summarize-mutants.go --report /tmp/gooze-B/run \
  [--credit <pr-test-file>]... [--compare /tmp/gooze-A/run] \
  [--origin-ref <merge-base>] [--repo <real-checkout>] [--findings mutation-findings.json] [--only <path>] [--format json]
```
- Equivalent built-in views: `gooze report view -o <dir> [--by-line] [--summary]`; `--all` lists every mutation with its diff.
- The report YAML stores statuses as integers and diffs as byte lists; use the summarizer or `gooze report view`, not a YAML tool.
- `--origin-ref` tags each unkilled mutant `new` or `pre-existing`: `pre-existing` means the PR only reformatted or moved the line (gofmt re-alignment, reordering). A renamed identifier counts as `new`; spot-check with `git show <merge-base>:<file>`.
- `--findings` adds an actionable score per file, excluding survivors you classified equivalent, defensive or cosmetic.

Before recommending anything, check **reachability** (can callers produce that input? an upstream validator makes it `defensive`), **equivalence**, whether the covering test **fakes** the code path (an `httptest` stub or interface mock that never exercises the real logic), and **origin**. Classify each:

| Class | Meaning | Action |
|---|---|---|
| **Real gap** | Behavior a caller would notice (guard, boundary, branch, error path, dropped call) | Propose a focused test |
| **Defensive** | Guard for input callers structurally prevent | Note only; don't request a test |
| **Equivalent** | Mutant behaves identically (`i < len(x)` vs `i != len(x)` in a loop that ends either way; a literal that is overwritten; `>=` vs `>` where equal values give the same result) | Document; optionally `//gooze:ignore <mutagen>` with approval |
| **Cosmetic** | Log text, error-message formatting, metric labels | Usually ignore |
| **Test-infra** | `timeout` storms, `not_covered` because tests live in another package, package without tests | Fix config or mark inconclusive |

Prioritize: removed/forced guards (`branch`, `statement` on `err != nil`, `== nil`, `len(...) == 0`), boundaries (`comparison`), `&&`/`||` in access/validation checks, dropped calls with side effects, arithmetic in money/quantity math. `arithmetic` in log/duration formatting rarely matters.

### 7. Propose and verify tests
- Write tests that fail for the mutated behavior (assert exact outcomes, not "no error"). Follow the repo's existing style (table-driven tests, its assertion library, `httptest` helpers, approval tests).
- Apply them in the isolated workspace only. Run the new test alone first (`go test ./pkg -run '^TestX$' -count=1`): it must pass on unmutated source. Then rerun Gooze on the same scope into a new `-o` dir (a changed test file makes Gooze re-test that file; `--no-cache` forces everything) and compare: `summarize-mutants.go --report after/run --compare before/run` shows `newlyKilled` / `noLongerKilled`.
- Gooze does not report **which test** killed a mutant (it records only the sibling `_test.go` it preferred). To name killing tests, hand-apply the mutant in the workspace (diff from `gooze report view -o <dir> --all`), run `go test ./pkg -count=1 -json`, list tests with `"Action":"fail"`, then restore the file (`git -C "$WS" checkout -- <file>`).
- At most 2 attempts per finding, then mark it `inconclusive`. Run affected tests `-count=3` (add `-race` if the repo uses it); inconsistent results are flaky and don't count as kills.
- Present tests as a diff/patch; apply to the user's checkout only with approval. Never delete existing tests based on mutation results alone.

### 7b. PR test feedback (PR mode)
See `references/pr-feedback.md`. In short:
1. **Compare:** run A (base-branch versions of the PR's `_test.go` files) and run B (PR tests), both on PR source with the same `--diff`, separate `-o` dirs. Report `newlyKilled` (credit the PR's test files; name individual tests only when verified by hand), `stillSurviving`, and `noLongerKilled` (always raise). If the old tests don't build or pass on PR source (typical for refactors and bug fixes), Gooze exits `7` with the failures: say "comparison inconclusive", list them, and report B alone.
2. **Findings:** write `mutation-findings.json` outside the repo. Each finding has a stable ID, class, state (`open` → `verified` | `inconclusive` | `wont-fix`), evidence, a question, a suggested test and a repro command. Only a rerun sets `verified`.
3. **Ownership:** only `new` real gaps belong to this PR. `pre-existing` gaps are optional ("not caused by this PR") or go to a follow-up ticket, and never block.
4. **Loop:** on each new PR head (or agent patch), rerun the same scope, update states, and stop when nothing actionable is `open`.
5. **Outputs:** two local drafts, a feedback comment (`pr-comment.md`) and a scorecard (`scorecard.md`). Follow the comment rules and verdict rules in `references/pr-feedback.md` §6.

### 8. Cleanup (always)
`rm -rf "$WS"` (isolated workspace), the `-o` report dirs (`/tmp/gooze-*`) and `/tmp/gooze.log`. Gooze also keeps a reusable build cache in your user cache dir (`~/Library/Caches/gooze` on macOS, `~/.cache/gooze` on Linux; capped by `--go-cache-size`, default 2 GiB); it speeds later runs, so leave it unless the user wants it removed. If anything ran in the real checkout: remove `.gooze-reports/`, `.gooze.log` and any `gooze.yaml` you added. Confirm `git status` matches the pre-run state.

## Report format

```
Scope: <diff ranges / packages>, base <ref>, Gooze <ver>, config <file>, mutagens: <list>
Baseline: go test <scope> green (<n> packages, <s>s)
Result: <score>% = killed / (all mutants - errors); N mutants (killed K, survived S, not covered C, timeout T, skipped X; error E excluded)
By file: table
Survivors: location | mutagen | original → mutated | class | why it matters | proposed test
Equivalent/ignored: list with reasons
Lines with no mutations generated: <files/ranges>   (state this; it is not "covered")
Verification: before/after score for affected files
Caveats: sampled changed lines only; score is for mutants generated, not all possible bugs; mutagens enabled
```
PR mode adds:
- comparison status (complete/inconclusive/not run), with failing base-test names or build errors when inconclusive;
- credit for effective tests (file-level from the comparison; test names only when hand-verified);
- findings with IDs, origin and states;
- a scorecard showing raw and actionable scores per file plus the verdict;
- the draft feedback comment (not posted).
Targets (guidance, not gates): ≥80% for critical logic, ≥60% elsewhere. Don't chase 100%.

## Gotchas (verified with Gooze v1.6.1, Go 1.27, on TotalWineLabs/account PR #594)

1. **Narrowed runs write to `<output>/run/`.** `gooze report view` without `-o <output>/run` shows an empty main report (100%, no survivors). Always point the summarizer and `view` at the `run/` directory.
2. **Exit `7` = baseline failure, not a mutation result.** The message names the package and the compile/test errors (e.g. `not enough arguments in call to …`). Never patch tests to force it; mark the base comparison inconclusive.
3. **`--diff` includes whole sibling source files when their `_test.go` changed.** Expect `pre-existing` mutants outside the changed lines; do not blame the author for them.
4. **Timeouts are not kills.** They lower the score. If most mutants time out, the run is inconclusive: raise `--mutation-timeout` or lower `--parallel`.
5. **Default mutagens are not the whole story.** On PR #594, the nine defaults produced 8 mutants; adding `branch` and `statement` produced 26 and exposed both survivors (a removed `if err != nil` guard and a deleted call). Say which mutagens ran.
6. **Per-package test execution.** A mutant runs only its own package's tests (`go test -count=1`). A function exercised only by another package's tests shows `survived`/`not_covered`. A package without any `_test.go` reports every mutant `survived`.
7. **Cache is per file.** A file is re-tested when its source or its test file changes; otherwise results are reused. Use `--no-cache` for a clean A/B and separate `-o` dirs per run.
8. **`MT-` IDs are `MT-` + the first 10 hex chars of Gooze's mutation ID, a hash of the whole mutated file.** They are stable across reruns of the same source (adding tests does not change them) and **all change when anything in that file changes**. Re-anchor by file + mutagen + original text + nearby line.
9. **Opt-in mutagens add `error` mutants** (do not compile); they are listed under "Build errors" and excluded from the score. `loop` and `branch` can also hang → `timeout`.
10. **Config is `./gooze.yaml` only**, plus `GOOZE_*` env vars; there is no `--config`. Check `gooze config show` for source of each value. `--workspace overlay` (default) never edits files; `deep-copy` copies the module.
11. **`--test-flags` rejects** `-json`, `-count`, `-vet`, `-overlay`, `-c`, `-o`. Use it for `-short`, `-race`, `-tags=…`, `-skip=…`.
12. **`--mutation-memory` is Linux only**; `--parallel` multiplies test load (database, port or file collisions in non-hermetic tests cause false kills).
13. **Snapshot/approval tests** (e.g. `go-approval-tests`) can launch a diff reporter or write `*.received.*` files when a mutant makes them fail. Run in the isolated workspace, set the library's CI/quiet reporter if needed, and delete `*.received.*` files afterwards.
14. **Tests that hit real services** (network, Redis, Kafka) must be hermetic in the workspace; otherwise they produce false kills or hangs.
15. Rename/gofmt-only diffs still generate mutants. Classify as cosmetic or `pre-existing`.
16. `gooze run --diff` needs `git` on `PATH`, a git repo, and the base ref present (shallow clones fail with exit `4`/`1`; fetch the ref).

## References
- `references/gooze.config.template.yaml`: safe starter `gooze.yaml` (reports/logs in `/tmp`, update check off, `branch`+`statement` on, no thresholds, generated code excluded).
- `references/source-security-review.md`: supply-chain notes for installing and running Gooze.
- `references/pr-feedback.md`: base-vs-PR comparison, finding schema, feedback loop, PR comment template and posting rules.
- `references/pr-feedback-example-594.md`: worked PR-feedback output for `TotalWineLabs/account#594`.
- `scripts/diff-ranges.go`: read-only helper (only runs `git diff`; no network, no writes).
- `scripts/summarize-mutants.go`: read-only helper: scores (raw, actionable), stable finding IDs, original → mutated code, file-level test credit, report-to-report delta, and new/pre-existing origin. Reads report YAML; with `--origin-ref` it also runs `git show`.
