# Playwright review: {{PR title / branch}}

**Verdict: {{Approve | Approve with comments | Request changes}}**
**Base:** `{{base}}` | **Changed Playwright files:** {{n}} | **Tests added/changed:** {{n}}

## Blocking (must fix)

| # | Rule | Location (added line) | Problem | Suggested change |
|---|---|---|---|---|

```js
// suggested replacement for the most important item
```

## Non-blocking suggestions

| Rule | Location | Note |
|---|---|---|

For PW105, report only evidence-backed risks where position substitutes for a specific target. Group repeated uses by root cause; omit intentional ordering.

## Coverage and intent
- Behavior changed without a test? / Test added without behavior?
- Does each new test assert what its title claims?
- Evidence the new test is stable (run log or `--repeat-each` result), or a request for it.

## Config / shared-code blast radius
- Changes to `playwright.config.*`, fixtures, or page objects used by other specs, and what they affect.

## Legacy debt in touched files (informational, does not block)
{{count}} pre-existing findings in files this PR touches. Highest: {{rule}} at {{file:line}}.

## Improvements in this PR
- e.g. removes a `waitForTimeout`, replaces XPath with role locator.

## Verdict rules
- **Request changes:** any critical; any high on an added line; a new test with no assertion; `.only` added.
- **Approve with comments:** only medium/low or actionable non-blocking suggestions on added lines.
- **Approve:** no actionable findings on added lines.

## Sources
For each rule cited above, link its docs and state its backing (official / partial / none) from `references/sources.json`. Distinguish audit conventions from Playwright guidance. Label `general-reviewer` items as general reviewer guidance and `engineering-best-practice` items as engineering best practice, not Playwright requirements.
