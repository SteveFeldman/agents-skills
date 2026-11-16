---
name: mutation-testing
description: "Run StrykerJS mutation testing on JavaScript/TypeScript code (Jest, Vitest, Mocha) to find weak or missing assertions. Scopes runs to a PR's changed lines, triages survivors, and proposes targeted tests. Use when asked to 'run mutation testing', 'check test quality', 'find weak tests', or 'evaluate tests for PR #N'."
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

### 3. Install transiently
```bash
npm i --no-save --ignore-scripts --no-audit --no-fund \
  @stryker-mutator/core@<ver> @stryker-mutator/<runner>@<ver>
```
`--no-save` still prunes/changes `node_modules` entries. After the run, restore with `npm install --ignore-scripts` and then `git checkout -- package-lock.json` (npm may rewrite it). Or install in a scratch worktree.

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
Parse `reports/mutation/mutation.json` (statuses `Survived`, `NoCoverage`) and show original line + replacement. Classify each:

| Class | Meaning | Action |
|---|---|---|
| **Real gap** | Behavior a user/caller would notice (guard, default value, boundary, conditional branch) | Propose a focused test |
| **Equivalent** | Mutant behaves identically (e.g. `|| ''` fed into a digits-only filter; `<=` vs `<` when equal values return the same result) | Document; optionally `// Stryker disable next-line <Mutator>: <reason>` with approval |
| **Cosmetic** | Class-name template strings, log text, error copy | Usually ignore; exclude via `mutator.excludedMutations` only with approval |
| **Test-infra** | Timeout/compile errors, no covering tests because file is excluded | Fix config or note as inconclusive |

Prioritize: guards for missing/empty data (`?.`, `?? []`, `|| []`), boolean conditions (`ConditionalExpression`, `LogicalOperator`), boundaries (`EqualityOperator`), and return values. Low-value StringLiteral survivors rarely matter.

### 7. Propose and verify tests
- Write tests that fail for the mutated behavior (assert the exact outcome, not "defined").
- Use the project's existing test files, helpers and style. Add parameterized cases (`test.each`) where several mutants share a setup.
- Rerun Stryker **only on the affected ranges** and report before/after. Real fixes should push those files to 100% unless equivalents remain.
- Present tests as a diff/patch; apply only with approval. Never delete existing tests based on mutation results alone.

### 8. Cleanup (always)
`rm -rf .stryker-tmp reports stryker.<name>.config.json`, restore `node_modules`/lockfile as above, confirm `git status` matches the pre-run state.

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
Targets (guidance, not gates): ≥80% for critical logic, ≥60% elsewhere. Don't chase 100%.

## Gotchas (verified on checkout-mfe, Jest 29 + Babel 7 + Flow)

- **Stryker 10.x + Babel 7 project config → `BABEL_VERSION_UNSUPPORTED`** (Stryker 10 bundles Babel 8 and loads the project Babel config, including `@babel/preset-flow`). Fix: pin `@stryker-mutator/core` and `jest-runner` to `9.6.1`.
- `-c <file>` is not a valid flag; pass the config as the first positional arg.
- `"concurrency": 4` in config failed schema validation in 10.1.1; use `--concurrency`.
- `clear-text` with default `reportTests: true` prints every test and is huge; template sets `reportTests: false`. Read the JSON report for survivors.
- Leftover `.stryker-tmp/sandbox-*` dirs break later `jest` runs. Remove them.
- Rename/formatting-only diffs (quote style, import reordering) still generate mutants (`StringLiteral`); classify as cosmetic.
- Tests using `jest.mock` of whole modules can make mutants in mocked modules show `NoCoverage`; verify the module is exercised by a real (unmocked) test before calling it a gap.
- A restricted environment with `NODE_TLS_REJECT_UNAUTHORIZED=0` only prints warnings; do not "fix" it by editing npm config.

## References
- `references/stryker.config.template.json` – safe starter config (no dashboard, JSON + clear-text reporters).
- `references/source-security-review.md` – review of the four third-party skills and what was adopted/rejected.
- `references/evaluation-pr-2285.md` – effectiveness evaluation against `TotalWineLabs/checkout-mfe#2285`.
- `scripts/diff-mutate-ranges.mjs` – read-only helper (only runs `git diff`; no network, no writes).
