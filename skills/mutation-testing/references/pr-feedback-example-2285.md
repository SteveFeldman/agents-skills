# Example: PR feedback for TotalWineLabs/checkout-mfe#2285

Worked output of `references/pr-feedback.md` on PR head `69810bc4` (Stryker 9.6.1 + jest-runner 9.6.1, 63 mutants on changed lines).

**Not run:** the base-test comparison (run A). The delta below compares the original PR tests with the PR tests plus 4 proposed tests. Treat "credit" as "killed by these tests", not "newly caught by this PR".

## Commands

```bash
node scripts/summarize-mutants.mjs --report original-mutation.json --credit src/client/test/
node scripts/summarize-mutants.mjs --report verification-mutation.json --compare original-mutation.json
```

## Triage

| ID | Location | Mutator | Class | State | Reason |
|---|---|---|---|---|---|
| MT-08d73f477f | Summary.js:774 | ConditionalExpression → true | real-gap | verified | No test rendered a non-delivery cart; proposed test kills it |
| MT-13501f1517 | Summary.js:776 | ConditionalExpression → true | real-gap | verified | No test rendered an ineligible delivery cart; proposed test kills it |
| MT-b85c8a5a73 | Summary.js:775 | OptionalChaining | defensive | verified | `convertCartToOrder` normalizes `entries ?? []`; killed by a test using a missing `entries` field |
| MT-e9bcddbd0d | PlaceOrderAction.js:104 | ArrayDeclaration | defensive | verified | Same normalizer; test mocks `convertCartToOrder`, so reachability is uncertain |
| MT-82d0c8a6a1, MT-8e5cf81660 | CheckoutAccordion.js:197 | OptionalChaining ×2 | defensive | open | `cart`/`entries` absent only before hydration; no test asked for |
| MT-9ed0ce4cb8 | ConvertCartToOrderAction.js:40 | StringLiteral `''` default | untriaged | open | Needs API-contract check (can `data.cart` be missing?) |
| MT-6ccda4cce7, MT-9fbb543c1a | CartAction.js:113, 284 | StringLiteral `''` | equivalent | — | `OnlyNums` strips non-digits, so `"Stryker was here!"` → `''` |
| MT-1b1d298524 | AllItemsUnavailableModal.js:28 | StringLiteral | cosmetic | — | CSS class string |

Verification rerun (affected ranges only): PlaceOrderAction.js 92.31% → 100%, Summary.js 82.35% → 100%; newlyKilled 4, noLongerKilled 0.

## Credit (what the PR's tests already do well)

- `Summary.test.js:668` "does not mount delivery tipping after every item is removed" killed 9 mutants on lines 774–775.
- `CheckoutPage.test.js:474` "hydrates the order with one GET (nested response: false)" killed 8 mutants in ConvertCartToOrderAction.js:40–42.
- `PlaceOrderAction.test.js:238` "keeps the availability modal open when a successful retry empties the cart" killed 7 mutants on lines 105–106.
- `CheckoutAccordion.test.js:431` "shows the all-items-unavailable modal…" killed 5 mutants on lines 197–203.

## Draft PR comment (shown locally; not posted)

```markdown
<!-- mutation-testing-skill -->
### Mutation testing: test-strength notes (Stryker 9.6.1, changed lines only)

**Score on changed lines:** 84% (53/63). Base-test comparison: not run.

**What the tests do well**
- The empty-cart tipping test catches 9 mutations in the tipping guard; the retry-empties-cart test catches 7 in the redirect logic.

**Questions about untested behavior** (no claim these are bugs)
| ID | Where | If this changed… | Question |
|---|---|---|---|
| MT-08d73f477f | Summary.js:774 | `cart.type === constantTypes.DELIVERY` → `true` passes all tests | Should tipping stay hidden for pickup/shipping carts? A render with a non-delivery cart would pin that. |
| MT-13501f1517 | Summary.js:776 | `cart.deliveryTipEligible === true` → `true` passes all tests | Should an ineligible delivery cart hide tipping? |
| MT-9ed0ce4cb8 | ConvertCartToOrderAction.js:40 | `''` default changed passes all tests | Can the API omit `data.cart`? If not, this is fine as is. |

**Not requested:** 2 equivalent, 4 defensive/unreachable, 1 cosmetic.

A 4-test patch that covers the two questions above (plus two defensive cases) is available on request; with it, both files reach 100% on changed lines.
```
