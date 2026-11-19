# Scoring

## Basis

The rules, severities, category weights and caps are our design; the official docs do not define a scoring model. Individual rules are backed by the Playwright docs to varying degrees: see "Backing and sources" in [rules.md](rules.md). A finding on a rule with `backing: none` is a team convention. Report it as such and do not present it as Playwright guidance.

## Category weights

| Category | Weight |
|---|---|
| reliability | 30 |
| locators | 20 |
| assertions | 15 |
| structure | 15 |
| determinism | 10 |
| config | 10 |

## Per-category score

```
deduction(rule) = min( rule.cap, severityWeight * count * scale )
category score  = max(0, 100 - sum(deduction of rules in category))
overall         = sum(category score * weight / 100)
```

- `scale = min(1, 60 / tests)`. Suites up to 60 tests take full deductions; larger suites are scaled down so size alone is not punished. Config rules are never scaled.
- `cap` stops one repeated rule from zeroing a category.
- A `critical` finding (PW005) caps the overall grade at **C**.

## Grades

| Score | Grade |
|---|---|
| 90-100 | A |
| 80-89 | B |
| 70-79 | C |
| 60-69 | D |
| < 60 | F |

## Judgment adjustments

You may move a category by at most one letter, and must state the reason in the report. Typical reasons:
- A finding cluster is a documented, justified design (move up).
- The scanner cannot see a systemic problem such as tests that share state or assertions that check the wrong thing (move down).

Never adjust the overall grade directly.

## PR mode has no letter grade

PR mode reports a verdict (see SKILL.md) and counts only findings on added lines. Legacy debt in touched files is reported separately and never blocks.

## Calibration

The eval corpus in `evals/cases` pins the expected grade for each fixture (clean A, reliability C, locators B, config-missing B, profile A). Run `node scripts/run-evals.js` after any change to `scan.js` rules or weights; calibrate against a manual audit of a real suite before changing weights.
