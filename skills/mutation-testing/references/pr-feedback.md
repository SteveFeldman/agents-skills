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

If run A can't execute (old tests import renamed modules, snapshots differ, suite fails on PR source), mark the comparison **inconclusive** and report run B alone. Do not patch old tests to make them run.

## 3. Triage before any recommendation

For every survivor/no-coverage mutant, before writing a suggestion:
1. **Reachability**: trace callers. Can the mutated input (`undefined` entries, empty list, non-delivery cart) actually arrive? If a normalizer upstream guarantees it can't, classify **defensive** (no test request; optional note).
2. **Equivalence**: does the mutant produce identical observable output? (e.g. `|| ''` fed into a digits-only filter). Classify **equivalent**.
3. **Mocks**: is the module mocked in the covering test? Then the survivor says little about the real path.
4. Only then classify **real gap** and write a suggested test with the exact assertion that would fail on the mutant.

Classifications: `real-gap` | `defensive` | `equivalent` | `cosmetic` | `test-infra` | `untriaged`.

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

**Human author:**
1. Show a draft PR comment (template below) locally. Post nothing without explicit approval.
2. On new commits: rerun the same ranges at the new head, update states, and edit the existing comment.
3. Stop when every finding is `verified`, `wont-fix`, `equivalent`, or `defensive`. Don't open new rounds for low-value mutators (StringLiteral, class names).

## 6. PR comment (only with approval)

- Find an existing comment containing the marker `<!-- mutation-testing-skill -->` and **edit** it (`gh api -X PATCH repos/{owner}/{repo}/issues/comments/{id} -f body=@body.md`). Otherwise `gh pr comment <n> --body-file body.md`. Never post one comment per finding.
- Tone: test-strength observations phrased as questions. Never "bug", never "must". Credit what the tests do well first.
- Never include absolute local paths, tokens, or env output.

```markdown
<!-- mutation-testing-skill -->
### Mutation testing: test-strength notes (Stryker <ver>, changed lines only)

**Score on changed lines:** 84% (53/63). Base-test comparison: <complete | inconclusive: reason | not run>.

**What the new tests do well**
- `Summary.test.js` "does not mount delivery tipping after every item is removed" catches 9 mutations in the tipping guard.

**Questions about untested behavior** (no claim these are bugs)
| ID | Where | If this changed… | Question |
|---|---|---|---|
| MT-08d73f477f | Summary.js:774 | `cart.type === constantTypes.DELIVERY` → `true` passes all tests | Should tipping stay hidden for non-delivery carts? |

**Not requested:** 3 equivalent, 3 defensive/unreachable, 1 cosmetic (details in thread on request).

_Reproduce:_ `npx stryker run <config> --mutate "<ranges>"`. Status updates on each push.
```
