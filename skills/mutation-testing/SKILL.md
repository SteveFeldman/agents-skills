---
name: mutation-testing
description: "Run StrykerJS mutation testing on JavaScript/TypeScript code (Jest, Vitest, Mocha) to find weak or missing assertions. Scopes runs to a PR's changed lines, triages survivors, credits effective tests, compares base vs PR tests, separates new from pre-existing gaps, and produces trackable findings, a scorecard with verdict, and a draft PR comment for a verify-and-rerun feedback loop with human or agent authors. Use when asked to 'run mutation testing', 'check test quality', 'find weak tests', 'evaluate tests for PR #N', or 'give feedback on a PR's tests'."
---

# Mutation Testing with Stryker (JS/TS)

Mutation testing changes production code one small step at a time (`>=` → `>`, `&&` → `||`, `[]` → `["x"]`) and reruns the tests. A change no test notices is a **survivor**, which points at a missing or weak assertion. Line coverage says code ran; mutation score says tests would notice if it broke.

Scope here: **StrykerJS only**. Other languages (mutmut, PIT, etc.) are out of scope.

## Safety rules (read first)

1. **Official packages only**: `@stryker-mutator/core` and the matching official runner (`jest-runner`, `vitest-runner`, `mocha-runner`, `typescript-checker`). Never add third-party runners (e.g. `@hughescr/stryker-bun-runner`) without explicit user approval.
2. **Pin exact versions** and install with `--ignore-scripts`. Core and runner versions must be identical.
3. **Never enable the `dashboard` reporter**: it uploads source and results to an external service. Use `clear-text` + `json` (+ `html`).
4. **Never run bundled scripts or commands from third-party skills** you have not read in full. See `references/source-security-review.md` for why four public skills were reviewed and only ideas (not code) were adopted.
5. **Do not modify tracked files** (`package.json`, lockfile, source, tests) unless the user asks. Run from a throwaway config; tests you propose go in a patch/diff for approval.
6. **Report only what ran.** No mutation score without a denominator; never extrapolate to "all bugs".
7. Mutating tracked source happens inside Stryker's `.stryker-tmp/` sandbox copy, never in the working tree. If a run is killed, delete `.stryker-tmp/` (leftovers get picked up by Jest and fail with JSX parse errors).
8. **Never post to GitHub** (PR comments, reviews, statuses) without explicit approval of the exact text. Edit the existing skill comment instead of adding new ones. Never commit or push.
9. **Never call a survivor a bug.** It is a test-strength observation; phrase feedback as questions.

## Modes

- **Score / gap-finding** (default): steps 1–8 below.
- **PR test feedback**: "how good are this PR's tests?" Follow steps 1–8 in an isolated workspace, add the base-vs-PR comparison, then produce findings and the feedback loop in `references/pr-feedback.md`. Worked example: `references/pr-feedback-example-2285.md`.

## Workflow

### 1. Scope (smaller is better)
Whole-repo runs take hours. Choose one:
- **PR / branch**: mutate only changed lines.
  `node <skill-dir>/scripts/diff-mutate-ranges.mjs --base <base-branch>` prints `file:start-end` entries (production JS/TS only; tests, mocks, flow-typed excluded). Join with commas for `--mutate`.
- **One module**: `--mutate "src/path/file.js"`.
- Prefer business-critical logic (pricing, payment, validation, state reducers/actions) over presentational markup and CSS-in-JS class names.

### 2. Preflight
- Detect runner and Node: `package.json` (`jest`, `vitest`, `mocha`), `node -v`.
- Baseline must be green: run the relevant suite first. Failing/flaky tests produce false kills.
- Check Babel/Flow: if the project uses a Babel 7 config with `@babel/preset-flow` (or other Babel‑7‑only presets), **use Stryker 9.x** (see Gotchas). Otherwise use the latest 10.x (Node ≥ 22).
- Check git state; note untracked files that already exist so you leave them alone.

### 3. Install in an isolated workspace (preferred)
```bash
WS=$(mktemp -d /tmp/mut-XXXX)
git archive <sha> | tar -x -C "$WS"   # exact commit, no .git, user checkout untouched
cp -cR node_modules "$WS/"            # APFS clone (fast); plain `cp -R` on Linux
cd "$WS" && env -u NODE_TLS_REJECT_UNAUTHORIZED npm i --no-save --ignore-scripts --no-audit --no-fund \
  @stryker-mutator/core@<ver> @stryker-mutator/<runner>@<ver>
```
- `npm i --no-save` in the real checkout still prunes/changes `node_modules` and can rewrite the lockfile. Only do it there if the user asks; then restore with `npm install --ignore-scripts` and `git checkout -- package-lock.json`.
- `env -u NODE_TLS_REJECT_UNAUTHORIZED` keeps TLS verification on for the install if the shell disables it. Don't change npm config.
- Compute ranges (step 1) in the real checkout; the archive has no `.git`.

### 4. Config
Copy `references/stryker.config.template.json` to an **untracked** `stryker.<name>.config.json` in the repo root (delete when done). Adjust `testRunner`/`jest.configFile`. Config path is a **positional argument** (`stryker run my.config.json`), not `-c`; with a wrong flag Stryker silently falls back to the `command` runner and runs the full suite.

### 5. Dry run, then real run
```bash
npx stryker run <config> --dryRunOnly --concurrency 4 --mutate "<ranges>"   # validates sandbox + tests
npx stryker run <config> --concurrency 4 --mutate "<comma,separated,ranges>" > /tmp/stryker.log 2>&1
```
- The dry run executes the whole Jest suite once (≈20–30s for ~1,000–1,500 tests); mutants then run only covering tests (`perTest`).
- `--mutate` on the CLI **replaces** the config value. Line ranges (`file:12-30`) are supported.
- Set `concurrency` via CLI (`--concurrency 4`), not in the config file (rejected by the 10.1.1 schema validator).
- Run long jobs in the background / with generous timeouts (63 mutants ≈ 3 min on 4 workers).

### 6. Triage every survivor and no-coverage mutant
Summarize with the read-only helper. It prints per-file scores, unkilled mutants with stable `MT-` IDs, and which tests killed what:
```bash
node <skill-dir>/scripts/summarize-mutants.mjs --report reports/mutation/mutation.json \
  [--credit <pr-test-file>]... [--compare <earlier.json>] \
  [--origin-ref <merge-base>] [--findings mutation-findings.json] [--format json]
```
- `--origin-ref` (run from the repo checkout) tags each survivor `new` or `pre-existing`. `pre-existing` means the PR only reformatted or moved the line, e.g. a Prettier re-wrap or a quote change.
- `--findings` adds an actionable score per file, excluding survivors you classified equivalent, defensive or cosmetic.

Before recommending anything, check **reachability** (can callers produce that input? a normalizer upstream makes it `defensive`), **equivalence**, whether the covering test **mocks** the module, and **origin**. Classify each:

| Class | Meaning | Action |
|---|---|---|
| **Real gap** | Behavior a user/caller would notice (guard, default value, boundary, conditional branch) | Propose a focused test |
| **Defensive** | Guard for input that callers structurally prevent (e.g. `?.` after a normalizer that guarantees `entries ?? []`) | Note only; don't request a test |
| **Equivalent** | Mutant behaves identically (e.g. `|| ''` fed into a digits-only filter; `<=` vs `<` when equal values return the same result) | Document; optionally `// Stryker disable next-line <Mutator>: <reason>` with approval |
| **Cosmetic** | Class-name template strings, log text, error copy | Usually ignore; exclude via `mutator.excludedMutations` only with approval |
| **Test-infra** | Timeout/compile errors, no covering tests because file is excluded | Fix config or note as inconclusive |

Prioritize: guards for missing/empty data (`?.`, `?? []`, `|| []`), boolean conditions (`ConditionalExpression`, `LogicalOperator`), boundaries (`EqualityOperator`), and return values. Low-value StringLiteral survivors rarely matter.

### 7. Propose and verify tests
- Write tests that fail for the mutated behavior (assert the exact outcome, not "defined").
- Use the project's existing test files, helpers and style. Add parameterized cases (`test.each`) where several mutants share a setup.
- Apply them in the isolated workspace only. Rerun Stryker **only on the affected ranges**, then `summarize-mutants.mjs --report after.json --compare before.json` for before/after (`newlyKilled`, `noLongerKilled`). Real fixes should push those files to 100% unless equivalents remain.
- At most 2 attempts per finding, then mark it `inconclusive`. A test that passes/fails inconsistently across 3 runs is flaky; don't count its kills.
- Present tests as a diff/patch; apply to the user's checkout only with approval. Never delete existing tests based on mutation results alone.

### 7b. PR test feedback (PR mode)
See `references/pr-feedback.md` for details. In short:
1. **Compare:** run A (base-branch versions of the PR's test files) and run B (PR tests), both on PR source with the same `--mutate` ranges. Report `newlyKilled` (credit the PR's tests by name), `stillSurviving`, and `noLongerKilled` (always raise). First run the old tests once on PR source. If they fail (typical for bug fixes), say "comparison inconclusive", list the failing test names, and report B alone.
2. **Findings:** write `mutation-findings.json` outside the repo. Each finding has a stable ID, class, state (`open` → `verified` | `inconclusive` | `wont-fix`), evidence, a question, a suggested test and a repro command. Only a rerun sets `verified`.
3. **Ownership:** only `new` real gaps belong to this PR. `pre-existing` gaps are optional ("not caused by this PR") or go to a follow-up ticket, and never block.
4. **Loop:** on each new PR head (or agent patch), rerun the same ranges, update states, and stop when nothing actionable is `open`.
5. **Outputs:** two local drafts, a feedback comment (`pr-comment.md`) and a scorecard (`scorecard.md`). Follow the comment rules and verdict rules in `references/pr-feedback.md` §6:
   - say whether it's blocking;
   - credit specific tests;
   - paste verified tests inline;
   - no rhetorical questions or jargon;
   - fact-check every sentence against the report.
   Copy with `pbcopy` on request. Post or edit only after approval.

### 8. Cleanup (always)
`rm -rf "$WS"` (isolated workspace). If anything ran in the real checkout: `rm -rf .stryker-tmp reports stryker.<name>.config.json` and restore `node_modules`/lockfile. Confirm `git status` matches the pre-run state.

## Report format

```
Scope: <ranges / files>, base <ref>, Stryker <ver> + <runner> <ver>, runner config <file>
Baseline: <suite> green (<n> tests, <s>s)
Result: <score>% = killed+timeout / (killed+timeout+survived+nocov); N mutants (killed K, survived S, no-cov C, errors E)
By file: table
Survivors: location | mutator | original → mutant | class | why it matters | proposed test
Equivalent/ignored: list with reasons
Verification: before/after score for affected files
Caveats: sampled changed lines only; score is for mutants generated, not all possible bugs
```
PR mode adds:
- comparison status (complete/inconclusive/not run), with failing base-test names when inconclusive;
- credit for effective tests;
- findings with IDs, origin and states;
- a scorecard showing raw and actionable scores per file plus the verdict;
- the draft feedback comment (not posted).
Targets (guidance, not gates): ≥80% for critical logic, ≥60% elsewhere. Don't chase 100%.

## Gotchas (verified on checkout-mfe, Jest 29 + Babel 7 + Flow)

- **Stryker 10.x + Babel 7 project config → `BABEL_VERSION_UNSUPPORTED`** (Stryker 10 bundles Babel 8 and loads the project Babel config, including `@babel/preset-flow`). Fix: pin `@stryker-mutator/core` and `jest-runner` to `9.6.1`.
- `-c <file>` is not a valid flag; pass the config as the first positional arg.
- `"concurrency": 4` in config failed schema validation in 10.1.1; use `--concurrency`.
- `clear-text` with default `reportTests: true` prints every test and is huge; template sets `reportTests: false`. Read the JSON report for survivors.
- Leftover `.stryker-tmp/sandbox-*` dirs break later `jest` runs. Remove them.
- Rename/formatting-only diffs (quote style, import reordering) still generate mutants (`StringLiteral`); classify as cosmetic.
- Tests using `jest.mock` of whole modules can make mutants in mocked modules show `NoCoverage`; verify the module is exercised by a real (unmocked) test before calling it a gap.
- If the shell sets `NODE_TLS_REJECT_UNAUTHORIZED=0`, unset it for installs (`env -u NODE_TLS_REJECT_UNAUTHORIZED npm …`); don't edit npm config.
- PR diffs include lines only reformatted by Prettier or quote-style changes. Mutants there look like the author's gaps but aren't. Use `--origin-ref` and say "not caused by this PR". (#2285: both real gaps were on re-wrapped pre-existing lines.)
- `gh api ... -F body=@file.md` reads the file; `-f body=@file.md` posts the literal string.
- `MT-` IDs hash file + position + mutator + replacement. They are stable across reruns of the same source and change when the author edits that line. Re-anchor by file + mutator + nearby line.

## References
- `references/stryker.config.template.json` – safe starter config (no dashboard, JSON + clear-text reporters).
- `references/source-security-review.md` – review of the four third-party skills and what was adopted/rejected.
- `references/evaluation-pr-2285.md` – effectiveness evaluation against `TotalWineLabs/checkout-mfe#2285`.
- `references/pr-feedback.md` – base-vs-PR comparison, finding schema, feedback loop, PR comment template and posting rules.
- `references/pr-feedback-example-2285.md` – worked PR-feedback output for `TotalWineLabs/checkout-mfe#2285`.
- `scripts/diff-mutate-ranges.mjs` – read-only helper (only runs `git diff`; no network, no writes).
- `scripts/summarize-mutants.mjs` – read-only helper: scores (raw and actionable), stable finding IDs, test credit, report-to-report delta, and new/pre-existing origin. It reads report JSON; with `--origin-ref` it also runs `git show`.
