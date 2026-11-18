# Playwright audit: {{repo}}

**Profile:** testDir `{{testDir}}` | test-id attr `{{testIdAttr}}` | auth: {{authApproach}} | env: {{env}}
**Scope:** {{specs}} specs, {{pageObjects}} page-object files, {{tests}} tests | scanner `scan.js` {{date}}

## Scorecard

**Overall: {{grade}} ({{score}})** {{capNote}}

| Category | Weight | Score | Grade | Driver |
|---|---|---|---|---|
| Reliability | 30 | | | |
| Locators | 20 | | | |
| Assertions | 15 | | | |
| Structure | 15 | | | |
| Determinism | 10 | | | |
| Config | 10 | | | |

Judgment adjustments: {{none, or "category: +/-1 letter because ..."}}

## Top fixes (ranked)

| # | Fix | Rule | Occurrences | Effort | Where |
|---|---|---|---|---|---|

## Per-file findings

| File | Tests | Crit | High | Med | Low | Top fix |
|---|---|---|---|---|---|---|

## Detail (high and critical, plus verified mediums)

### `path/to/file.js:LINE` - PWxxx (severity)
```js
// offending code
```
**Why:** ...
**Fix:**
```js
// replacement
```

## Non-blocking positional locator risks (PW105)
List only evidence-backed risks where position substitutes for a specific target. Group repeated uses by root cause; omit intentional ordering. Do not include PW105 in the scorecard or ranked fixes.

## Dismissed as false positives
- `file:line` PWxxx: reason

## Accepted deviations (not penalized)
- Rule/practice: reason

## Not assessable
- e.g. CI pipeline in shared library, cannot verify retries/sharding.

## Rubric fit
Parts of the rubric that did not apply to this repo and why.

## Sources
For each rule cited above, link its docs and state its backing (official / partial / none) from `references/sources.json`. Distinguish audit conventions from Playwright guidance. Label `general-reviewer` items as general reviewer guidance and `engineering-best-practice` items as engineering best practice, not Playwright requirements.
