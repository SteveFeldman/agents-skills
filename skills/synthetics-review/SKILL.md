---
name: synthetics-review
description: "Review PRs in twm-synthetics (Playwright + Checkly synthetic checks): flaky/false-alert risk, assertion quality, alerting and cadence changes, UAT vs. PROD. Use instead of the generic PR review skill for this repo."
---

# Synthetics PR Review

Review a changeset in the twm-synthetics repository (Playwright + Checkly synthetic monitoring). This is production monitoring, not ordinary test code: a flaky check pages a human for nothing, and a weak check stays green while the site is down.

Core question for every change: **will this check produce reliable signal in both PROD and UAT?**

## 1. Establish Context

- Read the repo's own rubric first; it is the source of truth and overrides anything below:
  - `.claude/copilot-code-review-prompt.md`
  - Project conventions: whichever of `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` exist.
  - If the rubric file is missing, rely on the conventions files plus the checklist below.
- The prompt is long. Read first: the file-to-deployment mapping, Review Priorities, Severity Framework, Repository Conventions, and the section matching each changed file's check type. Skim the rest only if the diff touches it (CWV, alerting, logging). The file is large: read it in ranges until you have covered those sections, and do not rely on a truncated first read.
- Do not duplicate or restate those rules. Do not flag code that follows documented repo conventions.
- Check that the PR title and non-merge commits carry the repo's ticket prefix (`DIG-#####`); flag a missing one as LOW. Ignore auto-generated merge commits.
- Do not comment on formatting Prettier handles; verify it with the deterministic format check in checklist item 12.

## 2. Determine Scope

- PR number or URL provided: `gh pr diff <n>`, plus `gh pr view <n>` for the title, description, and commits. Read the description before judging whether a change is justified.
- Otherwise check for an open PR on the current branch: `gh pr view --json number,url`.
- Branch named: diff against `develop`, this repo's base branch.
- No scope given: review `git diff` and `git diff --cached`.

Then map each changed file to what it deploys:

- `tests/<area>/*.spec.js` goes live via `tests/<area>.check.ts` with that folder's check type, frequency, and alert channels. A misplaced spec is a deployment error.
- `*.check.ts` and `channel.check.ts` changes alter schedules, locations, retries, or paging.
- `constants.js`, `utils/`, `tests/pages/` changes affect many checks; find the blast radius.

## 3. Review Priorities (in order)

1. Secrets exposure
2. Reliability (false alarms, missed outages)
3. Assertion quality (can the check fail meaningfully?)
4. Alerting impact (who is paged, how often, for what)
5. Consistency with repo conventions
6. Hygiene and style

## 4. Synthetics Checklist

Answer each item pass/fail with a one-line reason:

1. **Secrets:** no tokens, passwords, or credentials committed or logged.
2. **Placement:** spec folder matches its nature, so check type, frequency, and alert channels are correct.
3. **Environment:** PROD specs use PROD variables, UAT specs use `_UAT` variables; no hardcoded URLs or tokens.
4. **Assertions:**
   - The check can fail meaningfully: at least one real assertion and no swallowed errors. If not, CRITICAL.
   - Every step whose purpose is to verify behavior contains an assertion with a custom message. A verification step that only records state and always passes is HIGH. Setup, navigation, and degraded-reporting steps (`markCheckAsDegraded`, `checkApiPerformance`) are exempt.
   - If failures are collected into an array and asserted once at the end, suggest `expect.soft(value, 'message')` inside each step. It keeps the loop going and marks the failing step red.
   - Before flagging an assertion-less step, check whether a page object or helper it calls asserts internally.
5. **Waits:** web-first auto-retrying assertions; no `networkidle`; `waitForTimeout` only after a selector wait fails.
6. **Test data:** no single hardcoded entity without a fallback; reserved or hardcoded data is documented and lives in `constants.js`.
7. **Reuse:** shared helpers, page objects, and constants used instead of reimplemented.
8. **Degraded vs. dead:** slow-but-working behavior is degraded, critical failures page.
9. **Alerting and cadence:** any change to frequency, retries, locations, or channels is justified.
10. **Naming and logging:** titles are human-readable and unique (they appear in alerts); no flow-narration logs; inputs that vary per run are logged.
11. **Helper options:** every option a spec passes to a shared helper is actually consumed by it (open the helper's source by following the spec's import, e.g. under `utils/`); an ignored option such as `isUat` or `timeout` is MEDIUM.
12. **Formatting (deterministic):** Prettier is the only enforced linter. Check each changed `.js`/`.ts` file at the PR head without checking out the branch:
    `git fetch -q origin pull/<n>/head` then, per file, `git show FETCH_HEAD:<path> | npx prettier --stdin-filepath <path> --check` (non-zero exit means it is not formatted). For local changes, run `npx prettier --check <changed files>`. Report failing files as LOW; do not rewrite files.
13. **Static verification (no execution):** this review is static analysis only. Do not run the checks, specs, or `npx checkly test`; their logs are not available here. Instead, trace the code: follow the data flow through helpers, confirm the env vars a spec reads are defined for its environment, and confirm referenced constants and exports exist. If a spec budgets per-request time (e.g. `test.setTimeout`), confirm the helpers it calls enforce that timeout; a budget the helper does not enforce is MEDIUM. State in the review that the check was not executed.

Also note, without a checklist line: read every changed line; flag dead code, unused imports or variables, and work worth a follow-up ticket; recommend a second reviewer when a change touches shared helpers, alert channels, or many checks; and check for command injection or unsafe interpolation in helpers and newly added dependencies with known CVEs.

## 5. Severity and Evidence

Use the repo's severity framework (CRITICAL / HIGH / MEDIUM / LOW). Reachability is required for CRITICAL and HIGH: trace a realistic path where the behavior occurs. An unverified observation is a question, not a finding.

For these recurring cases, use the severity below. It overrides the repo prompt's general "cap fragility at Medium" rule:

| Case | Severity |
|---|---|
| Check has no meaningful assertion, or assertions are swallowed | CRITICAL |
| Verification step only records state and always passes (including collect-then-assert) | HIGH |
| Frequency, retries, locations, or alert-channel change with no justification in the PR or ticket, in a production folder | HIGH |
| The same change in `tests/uat/` (uses `uatAlertChannels`: staging channel plus two shared webhooks, not the full production set) | LOW |
| Spec option ignored by the helper it is passed to | MEDIUM |
| Missing ticket prefix on PR title or commits | LOW |

## 6. Output Format

**Summary:** 2-3 sentences on what the change does and your overall assessment.

**Findings** by severity (CRITICAL, HIGH, MEDIUM, LOW). For each:
- File and line reference (e.g. `tests/uat/uat.api.check.ts:42`)
- What the issue is, stated without judgment
- Why it matters (reliability, alerting, repo convention)
- Suggested fix, concrete
- Trade-offs, when several valid approaches exist, with your recommendation

**Checklist Results:** pass/fail for each checklist item.

**What Looks Good:** specific things the author did well.

**Verdict:** Approve, Approve with suggestions, or Request changes. Default rule:
- Any CRITICAL or HIGH finding: Request changes.
- Only MEDIUM or LOW findings: Approve with suggestions.
- No findings: Approve.
- Deviate only when you state why.

**PR-comment version:** after the full review, also print a short version ready to paste into the PR: one line per finding prefixed with its severity tag (`[HIGH]`, `[MEDIUM]`, ...), in what / why / fix form, plus the verdict. Print both locally only.

**Never write to the PR.** Do not run `gh pr comment`, `gh pr review`, or any API call that posts, unless the user explicitly asks you to add a comment to the PR.

## 7. Tone

- Ask questions rather than make demands; assume the author is well-meaning.
- Avoid judgmental language; offer alternatives instead of gatekeeping.
- Signal conviction ("I feel strongly that..." versus "Nit:").
- Explain the why; acknowledge reasonable trade-offs.
- Pair every criticism with a path forward.

## 8. Checkly References and Safe Verification

- Defer to `/checkly` for construct, plan, and limit details; do not restate them here.
- When a PR introduces a check type, construct, or option not already used in the repo's `*.check.ts` files, fetch current docs with `npx checkly@latest skills configure <construct>`. If it only reuses existing constructs and patterns (new spec in an existing folder, changed values, entries in existing override maps), skip the fetch.
- Reviews are read-only. Never run `deploy`, `destroy`, `skills install`, or any write command, and never add `--force`.
- If `npm outdated checkly` shows a newer version, mention it as a LOW suggestion.
