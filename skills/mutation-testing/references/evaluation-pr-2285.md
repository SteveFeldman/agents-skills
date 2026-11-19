# Evaluation: `mutation-testing` skill vs. checkout-mfe PR #2285

PR: [TotalWineLabs/checkout-mfe#2285](https://github.com/TotalWineLabs/checkout-mfe/pull/2285) – *DIG-137061 fix blank screen crash on oos order reconciliation* (branch `DIG-137061-all-items-unavailable`, base `develop`).
Run date: 2026-11-15. Stack: Jest 29 (jsdom), Babel 7 + Flow, Node 22.17.

## Procedure (followed the skill as written)
1. Scope: `diff-mutate-ranges.mjs --base develop` → 14 ranges in 7 production files (tests/CSS/lockfile excluded).
2. Baseline: relevant suites green (3 suites, 115 passed, 2 skipped).
3. Stryker 10.1.1 → failed (`BABEL_VERSION_UNSUPPORTED`, Babel 8 vs repo Babel 7/Flow). Pinned **9.6.1** → works. (Now a documented gotcha.)
4. Dry run: 1,111–1,500 tests in ~21–27 s. Real run: **63 mutants, 3 m 02 s**, 4 workers, `perTest` coverage.
5. Triage survivors, wrote tests, reran affected ranges only.
6. Restored repo: no tracked-file changes remain (`git status` identical to start).

## Result (PR as submitted)
**Mutation score 84.13 %** — 53 killed, 0 timeout, 9 survived, 1 no-coverage, 0 errors.

| File | Score | Killed | Survived | NoCov |
|---|---|---|---|---|
| actions/CartAction.js | 83.33 | 10 | 1 | 1 |
| actions/ConvertCartToOrderAction.js | 90.00 | 9 | 1 | 0 |
| actions/PlaceOrderAction.js | 92.31 | 12 | 1 | 0 |
| components/CheckoutAccordion.js | 77.78 | 7 | 2 | 0 |
| components/Summary.js | 82.35 | 14 | 3 | 0 |
| common/errorComponents/AllItemsUnavailableModal.js | 50.00 | 1 | 1 | 0 |

## Triage of the 10 non-killed mutants
| # | Location | Mutant | Class | Notes |
|---|---|---|---|---|
| 1 | PlaceOrderAction.js:104 | `_get(state,'cart.cart.entries', [])` → `["Stryker was here"]` | **Real gap** | No test where the refreshed order lacks `entries`. This is the exact blank-screen scenario; with the mutant the flow proceeds to payment instead of the availability modal. |
| 2 | Summary.js:775 | `cart.entries?.length` → `cart.entries.length` | **Real gap** | No test with `entries` undefined, the crash class the PR fixes. |
| 3 | Summary.js:774 | `cart.type === DELIVERY` → `true` | **Real gap** | Tipping never asserted hidden for non-delivery carts. |
| 4 | Summary.js:776 | `deliveryTipEligible === true` → `true` | **Real gap** | Tipping never asserted hidden when ineligible. |
| 5–6 | CheckoutAccordion.js:197 (×2) | `cart?.entries?.length` → `cart?.entries.length` / `cart.entries` | **Real gap** (not yet closed) | No test with `entries` or `cart` undefined at the modal decision. Needs a mock-store scenario; left open. |
| 7 | CartAction.js:113 (NoCoverage) | `\|\| ''` → string | Equivalent-ish | `OnlyNums` strips non-digits; the line is a quote-style-only change from the PR and `handleThirdPartyPickup` path isn't tested. Low value. |
| 8 | CartAction.js:284 | `\|\| ''` → string | Equivalent-ish | Same as #7. |
| 9 | ConvertCartToOrderAction.js:40 | `_get(..., '')` default → string | Low value | Both `_get` fallbacks are string defaults before `\|\|`; difference only when neither `data.cart` nor `data` exists. |
| 10 | AllItemsUnavailableModal.js:28 | class template → `` | Cosmetic | CSS-module class names. |

## Closing the gaps (verification)
Added 4 cases (patch saved outside the repo, not committed): 1 in `PlaceOrderAction.test.js` (refreshed order without `entries` keeps the availability modal) and a 3-row `test.each` in `Summary.test.js` (tipping hidden when entries missing / ineligible / non-delivery). Existing and new tests all passed (Summary 98, PlaceOrderAction 54 incl. skipped).

Rerun on the two affected ranges: **PlaceOrderAction.js 92.31 → 100 %**, **Summary.js 82.35 → 100 %**, 30/30 mutants killed. Gaps #1–#4 were therefore real, and fixed by small targeted tests. Gaps #5–6 remain open (recommended follow-up).

## Effectiveness assessment
**What worked**
- The diff-scoped approach turned a repo-wide multi-hour job into ~3 minutes, with every mutant relevant to the PR.
- Survivors concentrated on the PR's central risk (missing `entries` guards), so output was actionable, not noise. 4 of 10 mutants → verified real gaps closed by 4 tests; 2 more real gaps identified.
- Findings are things line coverage cannot show: the new lines were already *covered* (the PR touches them with tests), yet guards like `entries?.length` could be removed without any test failing.
- The two-phase triage (class + "why it matters") kept cosmetic/equivalent survivors from becoming busywork.

**Limits / what the evaluation did not prove**
- Single PR, single run: no false-negative measurement (bugs Stryker would not generate). Mutation score is for generated mutants only.
- `perTest` coverage was used; static mutants run all tests, so timings aren't a general guide.
- Quote-style and import-only diffs generate StringLiteral noise (#7–8, #10); the skill classifies them but cannot auto-filter them.
- The skill required a version workaround (Stryker 9.x) for Babel 7 + Flow. Teams on Babel 8 can use 10.x.
- CheckoutAccordion survivors need component-level test setup; the skill identifies but does not write those.

**Recommended follow-ups for the PR author**
1. Add tests for `CheckoutAccordion` with `cart.entries` undefined (mutants #5–6).
2. Optionally merge the 4 added cases (patch kept in the session files: `pr2285-mutation-gap-tests.patch`).
3. If adopting in CI: run diff-scoped Stryker on PRs touching `src/client/actions` and `components/Summary*`, report-only first (`break: null`), then set `break: 60`.
