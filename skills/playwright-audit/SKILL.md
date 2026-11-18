---
name: playwright-audit
description: >-
  Audit a Playwright E2E suite, either the whole repository or a pull request.
  Runs a deterministic scanner (file:line evidence, weighted scorecard, A-F grade)
  and then applies judgment for flakiness, locator strategy, assertions, test
  structure, network determinism and config. Use when asked to audit, review,
  grade or health-check Playwright tests, or to review a PR that touches
  Playwright specs, page objects, fixtures or playwright.config.
---

# Playwright Audit

Two modes, one rubric. **Repo mode** grades the whole suite. **PR mode** reviews only what a pull request changes and gives a merge verdict.

Never grade from memory or from grep counts you eyeballed. Run the scanner, read the flagged code, then report. The scanner finds candidates; you confirm or dismiss them.

## Step 0 - Pick the mode

| User says | Mode |
|---|---|
| "audit the Playwright tests", "grade/health-check the suite" | **Repo** |
| "review this PR", "review my branch", a PR number/URL, or a diff touching `*.spec.*`, `pages/`, `fixtures/`, `playwright.config.*` | **PR** |

If unclear, ask once.

## Step 1 - Establish the project profile (both modes)

A suite can legitimately differ from generic advice. Detect before judging:

1. Locate the suite: `playwright.config.*`, then its `testDir`.
2. Read the config. Note `baseURL`, `webServer`, `projects`, `storageState`, `globalSetup`, `retries`, `workers`.
3. Read `.pw-audit.json` at the repo root if present (see [references/profile.md](references/profile.md)). It declares the test-id attribute and accepted deviations.
4. Detect the custom test-id attribute (`data-qa`, `data-cy`, ...). The scanner auto-detects it and reports it under `profile.testIdAttribute`.
5. Detect how auth/session is established (fixture, API-created session, `storageState`, UI login). A working equivalent to `storageState` is **not** a gap.
6. Detect the environment: local `webServer` vs a deployed QA. Tests against shared live environments get leniency on mocking (see PW302) but not on waits.

State the profile in one line at the top of the report. Anything you treat as an accepted deviation must be named there.

## Step 2 - Run the scanner

```bash
# Repo mode (JSON for you, md for the user)
node <skill-dir>/scripts/scan.js --root <repo> --tests <testDir> --format json

# PR mode: findings on lines added vs the base branch
node <skill-dir>/scripts/scan.js --root <repo> --tests <testDir> --diff origin/<base> --format json
```

`<skill-dir>` is where this SKILL.md was loaded from. Requires Node 18+. No install step. In PR mode the exit code is 1 when a critical/high finding sits on an added line.

Rule IDs, severities and rationale: [references/rules.md](references/rules.md). Scoring formula: [references/scoring.md](references/scoring.md).

## Step 3 - Verify findings (do not skip)

The scanner is regex-based. For every `high`/`critical` finding and a sample of the rest, open the file and confirm:

- **False positive?** e.g. `waitForTimeout` inside a documented retry backoff in a non-UI helper, or a `setTimeout` used as a race timeout. Dismiss and say why.
- **Intentional?** Look for a comment or doc header explaining the choice. If it is justified, record it as an *accepted deviation*, not a defect, and suggest an inline `// pw-audit-ignore PWxxx <reason>`.
- **Real?** Quote `file:line` and give the concrete fix from the rules reference.

For **PW105**, review the positional candidates in context: read the locator definition, the test or helper's intent, and the asserted outcome. Report only cases where a specific target is intended and a reorder could select another; cite the evidence and suggest a unique scope or identity. Collapse repeats of the same root cause. Omit intentional ordering from the findings; no adjacent comment is required. PW105 never affects the score, including judgment adjustments, and never blocks a PR.

Then do the checks a scanner cannot (see [references/judgment-checklist.md](references/judgment-checklist.md)): assertion quality, test independence, over-broad tests, missing coverage of error paths, flaky-by-design flows, page-object bloat, secrets, CI wiring.

Optional runtime evidence when the environment allows it:

```bash
npx playwright test --list                       # true test count
npx playwright test --repeat-each=5 <changed spec>   # flake probe for PR mode
```

Only run these if the user permits executing tests against their environment; they may hit shared QA.

## Step 4 - Report

Use the templates, do not invent a new format:

- Repo mode: [templates/repo-report.md](templates/repo-report.md)
- PR mode: [templates/pr-review.md](templates/pr-review.md)

### Repo mode output
- Project profile line.
- Overall grade and weighted category scorecard (copy scanner numbers; adjust a category only with a stated reason, max one letter).
- Per-file table: file, tests, findings by severity, top fix.
- Top 5 fixes ranked by (severity x frequency / effort).
- Accepted deviations (what you deliberately did not penalize).
- Rubric fit: which parts of the rubric did not apply to this repo.

### PR mode output
- Verdict: **Approve / Approve with comments / Request changes**.
  - Request changes: any `critical`, any `high` on an added line, a new test with no assertion, or a test added with `.only`.
  - Approve with comments: only `medium`/`low` or actionable non-blocking suggestions on added lines.
  - Approve: no actionable findings.
- Findings only on **added lines**, each with `file:line`, rule, and a suggested replacement snippet.
- A separate, non-blocking "legacy debt in touched files" count. Do not block a PR for debt it did not introduce.
- Coverage note: does the PR add or change behavior without a test, or tests without behavior?
- Before/after, if the PR improves the suite (e.g. removes a `waitForTimeout`), say so.

## Verifiers and evals

- `verifiers/*.json` are checklists (assertions, locators, reliability, structure, determinism, config, pr-review). Each item has `rule_ids` (scanner-backed; already covered by Step 2) or `"judgment": true` (you must assess it in Step 3). In PR mode apply `pr-review.json` to added lines only.
- `references/sources.json` maps rules and verifier items to sources and backing levels (`official`, `partial`, `none`). Cite the docs link for each finding. Label `general-reviewer` items as general reviewer guidance and `engineering-best-practice` items as engineering best practice, not Playwright requirements. For `partial` backing, distinguish what the docs say from the audit convention. Rules and items still needing a source are listed under "Needs backing" in `references/rules.md`.
- `evals/cases/*` with `expected.json` pin scanner behavior. Run `node scripts/run-evals.js [case]` after changing the scanner or rules; it exits non-zero on any mismatch.

## Rules for the reviewer

- Evidence or it did not happen: every finding has `file:line`.
- Do not penalize an accepted deviation. Do not silently skip it either; list it.
- Do not recommend a rewrite where a one-line fix works.
- Keep severity honest. A `.first()` with a comment is not a defect.
- Never print secrets found in test code; cite the location and rotate advice only.
- This skill audits. It does not edit tests unless the user then asks for fixes.
