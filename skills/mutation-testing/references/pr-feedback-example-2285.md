# Example: PR feedback for TotalWineLabs/checkout-mfe#2285

Worked output of `references/pr-feedback.md` on PR head `69810bc4` (merge-base `580ee1cf`), Stryker 9.6.1 + jest-runner 9.6.1, 14 ranges in 7 files, 63 mutants.

## Runs

| Run | Result |
|---|---|
| A: `develop` tests on PR source | **Inconclusive.** 9 old tests fail because the PR intentionally changed this behavior: CartAction `updateTippingToCart` ×1, PlaceOrderAction `removeUnavailableCartItems` ×6, CheckoutPage "hydrates the order with one GET" ×2. |
| B: PR tests | 84.13% (53/63). The same 10 IDs as an earlier run on the same SHA (deterministic). |
| C: B + 4 proposed tests, affected ranges only | PlaceOrderAction.js and Summary.js 30/30. newlyKilled 4, noLongerKilled 0. Stable 3/3. |

```bash
# from the repo checkout
node scripts/summarize-mutants.mjs --report runB.json --findings mutation-findings.json --origin-ref 580ee1cf --credit src/client/test/
node scripts/summarize-mutants.mjs --report runC.json --compare runB.json
```

## Triage

| ID | Location | Origin | Class | State | Reason |
|---|---|---|---|---|---|
| MT-08d73f477f | Summary.js:774 `cart.type === DELIVERY` → true | pre-existing (Prettier re-wrap) | real-gap | verified | No test renders a non-delivery cart |
| MT-13501f1517 | Summary.js:776 `deliveryTipEligible === true` → true | pre-existing (Prettier re-wrap) | real-gap | verified | No test renders an ineligible cart |
| MT-b85c8a5a73 | Summary.js:775 `?.` | new | defensive | verified | `convertCartToOrder` normalizes `entries ?? []` |
| MT-e9bcddbd0d | PlaceOrderAction.js:104 `[]` default | pre-existing (moved) | defensive | verified | Same normalizer |
| MT-82d0c8a6a1, MT-8e5cf81660 | CheckoutAccordion.js:197 `?.` ×2 | new | defensive | wont-fix | Cart hydrated and normalized |
| MT-9ed0ce4cb8 | ConvertCartToOrderAction.js:40 `_get(res, 'data', '')` fallback | new | defensive | wont-fix | Used only if the response has no `data`; the other 6 mutants on the line are killed |
| MT-6ccda4cce7, MT-9fbb543c1a | CartAction.js:113, 284 | pre-existing (quote change) | equivalent | wont-fix | `OnlyNums` strips non-digits |
| MT-1b1d298524 | AllItemsUnavailableModal.js:28 | new | cosmetic | wont-fix | CSS class |

**Key lesson:** both real gaps were on lines this PR only re-wrapped. The first draft comment asked the author two questions about code he didn't write, both with obvious answers, and made him ask for the patch. The final comment below fixes that.

The first draft also said the empty-cart test "catches every mutation" of `!!cart.entries?.length`. The report showed the `?.` mutant survived, so the sentence was corrected before sharing (rule 8).

## Final feedback comment

````markdown
<!-- mutation-testing-skill -->
### Mutation testing notes (non-blocking)

Nice work on the tests for the new empty-cart guard. "does not mount delivery tipping after every item is removed" fails if `!!cart.entries?.length` in `Summary.js` is removed or inverted, and the reconcile and redirect tests in `PlaceOrderAction` are just as thorough.

**Optional, not caused by this PR:** the `cart.type === constantTypes.DELIVERY` and `cart.deliveryTipEligible === true` checks next to your guard have no negative tests. Replacing either with `true` still passes the suite. If you'd like to cover them while you're in this file, this `test.each` does it (it goes after the empty-cart test in `Summary.test.js`):

```js
test.each([
  ['the cart is not eligible', { type: 'DELIVERY', deliveryTipEligible: false }],
  ['the cart is not a delivery cart', { type: 'INSTORE_PICKUP', deliveryTipEligible: true }],
])('does not mount delivery tipping when %s', (_name, overrides) => {
  setup({
    progress: { activeSection: 4 },
    cart: { cart: { ...mockCart, isGiftEnable: false, ...overrides } },
  });

  expect(document.querySelector('[data-at="delivery-tipping-mock"]')).toBeNull();
});
```

If you'd rather keep this PR focused, I can open a follow-up ticket instead. Either way, nothing else here needs action.
````

## Final scorecard

````markdown
<!-- mutation-testing-skill:scorecard -->
### Mutation testing scorecard: PR #2285

**Verdict: ✅ The tests meet the bar.** Every changed file meets its target once survivors that need no test are excluded, and the logic this PR adds has no untested mutations.

Stryker 9.6.1 + Jest, changed lines only, head `69810bc4`. A mutation counts as caught when at least one test fails after the code is altered.

| File | Mutations | Caught | Raw score | Actionable score¹ | Target² | Result |
|---|---:|---:|---:|---:|---:|:---:|
| `actions/PlaceOrderAction.js` | 13 | 12 | 92.3% | 100% (12/12) | 80% | ✅ |
| `actions/ConvertCartToOrderAction.js` | 10 | 9 | 90.0% | 100% (9/9) | 80% | ✅ |
| `actions/CartAction.js` | 12 | 10 | 83.3% | 100% (10/10) | 80% | ✅ |
| `components/Summary.js` | 17 | 14 | 82.4% | 87.5% (14/16) | 80% | ✅ |
| `components/CheckoutAccordion.js` | 9 | 7 | 77.8% | 100% (7/7) | 80% | ✅ |
| `components/common/errorComponents/AllItemsUnavailableModal.js` | 2 | 1 | 50.0% | 100% (1/1) | 60% | ✅ |
| **Total** | **63** | **53** | **84.1%** | **96.4% (53/55)** | | ✅ |

¹ Excludes 8 survivors that don't need a test:
- 2 that behave the same as the original: `CartAction.js` empty-string defaults that `OnlyNums` strips anyway
- 5 guards against inputs that can't happen, because cart entries are normalized upstream
- 1 CSS class name

² Guidance targets: 80% for checkout logic, 60% for presentational components.

**Remaining 2 survivors (optional, not caused by this PR):** the existing `cart.type === DELIVERY` and `deliveryTipEligible === true` checks in `Summary.js:774-776` have no tests for the cases where they should hide tipping. See my other comment for a ready-to-paste `test.each`. Adding it brings `Summary.js` to 100%.

**Strongest tests:**
- "does not mount delivery tipping after every item is removed" catches 9 mutations.
- "hydrates the order with one GET" catches 8.
- "keeps the availability modal open when a successful retry empties the cart" catches 7.

_Caveats: this covers changed lines only, and the score is for the mutations generated, not all possible bugs. It couldn't be compared with the `develop` tests: 9 of them fail against the new behaviour, which is expected, and you updated them._
````
