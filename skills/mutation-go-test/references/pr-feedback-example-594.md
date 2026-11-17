# Worked example: PR test feedback for `TotalWineLabs/account#594`

PR: "DIG-136349 Buyer contact information is override with delivery recipient and vice versa" (head `c941d850`, base `develop`, merge-base `422885d1`). Changed production files: `service/kibo/{order,session,updateguestuser,user}.go`; changed tests: `service/kibo/session_more_test.go`. This is what the skill actually produced with Gooze v1.6.1 on Go 1.27.

## Commands that ran

```bash
SHA=c941d850411032d15799b65e5b85f0c63b9ab85b; BASE=422885d1c6a44f3446c1fb8a05446c5ced987b20
WS=$(mktemp -d /tmp/gooze-pr-XXXX)
git clone -q --local --no-checkout . "$WS" && git -C "$WS" checkout -q $SHA
GOBIN=/tmp/gooze-bin go install gooze.dev/pkg/gooze@v1.6.1
cd "$WS" && go test ./service/kibo                                  # baseline: ok (27 s cold)
cp <skill-dir>/references/gooze.config.template.yaml gooze.yaml

gooze run --estimate --diff $BASE ./...                             # preview: 8 mutants with the 9 default mutagens
gooze run --diff $BASE -o /tmp/gooze-B ./...                        # run B, template mutagens (adds branch, statement): 26 mutants, 41 s
```

## Run A: base tests (comparison inconclusive)

Old `session_more_test.go` (from `$BASE`) on PR source: Gooze exits `7`:

```
tests fail without any mutation in 1 package, so 26 mutants were not tested:
  service/kibo/session_more_test.go:163:38: not enough arguments in call to svc.replaceCartWithGuestCart
        have (..., *KiboCommerceCartUserResp, string)  want (..., *KiboCommerceCartUserResp, *kiboOrderSnapshot, string)
```
Comparison = **inconclusive: old tests do not compile against the new `replaceCartWithGuestCart` signature**, which shows the author updated tests for the new behavior. Report B alone; no tests patched.

## Run B result (PR tests, changed lines)

`gooze run` printed `Mutation score: 92.00% (23 killed, 2 survived, 1 error; … changed lines since 422885d1)`.

| File | Mutations | Killed | Survived | Error | Raw score |
|---|---:|---:|---:|---:|---:|
| `service/kibo/order.go` | 1 | 1 | 0 | 0 | 100% |
| `service/kibo/session.go` | 24 | 22 | 1 | 1 | 95.65% |
| `service/kibo/user.go` | 1 | 0 | 1 | 0 | 0% |

The 26 mutants are 12 `branch`, 6 `comparison`, 6 `statement`, 1 `logical`, 1 `numbers`. The one `error` is the `branch` mutant that deletes the `if orderErr != nil` block (does not compile; excluded from the score). `updateguestuser.go` produced no mutants.

## Survivors and triage

```bash
go run <skill-dir>/scripts/summarize-mutants.go --report /tmp/gooze-B/run --origin-ref $BASE --repo .
```

| ID | Location | Mutagen | Original → mutated | Origin | Class |
|---|---|---|---|---|---|
| `MT-bfe19366d9` | `session.go:341` | `branch` | `if orderErr != nil {` → `if false {` | new | **real-gap** (small) |
| `MT-84f2b3f8f9` | `user.go:45` | `statement` | `err = s.replaceCartWithGuestCart(…)` → line removed | new line (PR only added a `nil` argument to an existing call) | **real-gap**, optional |

- **session.go:341:** `TestGetLoginDataFromCheckout_RequiresOrderSnapshot` covers the upstream-failure and invalid-JSON cases but only asserts `require.Error`. With the guard removed, the zero-value order still fails the next check, so the test sees *an* error and passes. It does not prove the caller gets the upstream error instead of "fulfillment information is missing".
- **user.go:45:** the `CreateUser` test stubs `/replace-cart` (`user_operations_more_test.go:432`) but never asserts the call happens, and the error is deliberately swallowed. Deleting the cart swap on account creation goes unnoticed. The swap is pre-existing behavior; the PR only changed its arguments, so treat it as optional.

## Verification loop (in the workspace only)

Proposed test for `MT-bfe19366d9`: in the upstream-failure and invalid-JSON subtests, also assert the error is not the fulfillment-missing one.

```go
require.Error(t, err)
if tt.status != http.StatusOK || tt.body == `{` {
    assert.NotContains(t, err.Error(), "fulfillment information is missing")
}
```
`go test ./service/kibo -run TestGetLoginDataFromCheckout_RequiresOrderSnapshot -count=3` passed on unmutated source. Rerun (`gooze run --diff $BASE -o /tmp/gooze-after ./...`) then:

```bash
go run <skill-dir>/scripts/summarize-mutants.go --report /tmp/gooze-after/run --compare /tmp/gooze-B/run
# Compare score: 92% -> current: 96%
# newlyKilled: 1 (MT-bfe19366d9)   stillSurviving: 1 (MT-84f2b3f8f9)   noLongerKilled: 0
```
`MT-bfe19366d9` → `verified`. `MT-84f2b3f8f9` stays `open` (optional).

## Not assessable by Gooze

No mutants were generated for most added lines of `order.go` (struct, URL string, renamed function), `session.go:338, 391, 548`, `updateguestuser.go:105` and the new payload assignments. The `numbers`/`statement` mutants cover only some of them. Confirm by reading the tests: `TestGetLoginDataFromCheckout` decodes the `/replace-cart` payload and asserts `guestOrderFulfillment`, `guestOrderBuyerContact` and `guestOrderEmail`.

## findings (`mutation-findings.json`)

```json
{
  "pr": "TotalWineLabs/account#594",
  "headSha": "c941d850411032d15799b65e5b85f0c63b9ab85b",
  "tool": "gooze v1.6.1",
  "mutate": ["service/kibo/{order,session,updateguestuser,user}.go (changed lines)"],
  "comparison": "inconclusive: base tests do not compile against PR source",
  "findings": [
    {"id": "MT-bfe19366d9", "file": "service/kibo/session.go", "line": 341, "mutagen": "branch",
     "original": "if orderErr != nil {", "mutated": "if false {",
     "classification": "real-gap", "origin": "new", "state": "verified", "attempts": 1,
     "evidence": "survived; tests only require.Error on order lookup failure",
     "suggestedTest": "assert the upstream/invalid-JSON error is not the 'fulfillment information is missing' error"},
    {"id": "MT-84f2b3f8f9", "file": "service/kibo/user.go", "line": 45, "mutagen": "statement",
     "original": "err = s.replaceCartWithGuestCart(ctx, req.Authorization, r.Authorization, \"\", nil, nil, req.AccessToken)", "mutated": "(line removed)",
     "classification": "real-gap", "origin": "new", "state": "open", "attempts": 0,
     "evidence": "survived; CreateUser test stubs /replace-cart but does not assert it is called",
     "suggestedTest": "count /replace-cart hits in the CreateUser test and assert exactly 1"}
  ]
}
```

## Drafted outputs (not posted)

**pr-comment.md**
```markdown
<!-- mutation-go-test-skill -->
### Mutation testing notes (non-blocking; 1 optional item)

Nice work on the login-from-checkout order snapshot: 22 of the 23 changed-logic checks in `session.go` fail the suite when altered, including the fulfillment check, its `||`, and the `guestOrder != nil` branch in `replaceCartWithGuestCart`.

Small gap: removing the `if orderErr != nil` check on line 341 still passes the suite, because `TestGetLoginDataFromCheckout_RequiresOrderSnapshot` only asserts that some error comes back. Adding this after `require.Error` closes it (verified; the suite fails with the check removed):

<snippet above>

**Optional, not caused by this PR:** deleting the cart swap in `CreateUser` (`user.go:45`) still passes the suite, because the test stubs `/replace-cart` without asserting it is called. If you'd rather keep this PR focused, I can open a follow-up ticket instead.
```

**scorecard.md** (verdict: ✅ meets the bar after the verified test; before it, `session.go` was 95.65%, still above target, with one small `new` gap open)
```markdown
<!-- mutation-go-test-skill:scorecard -->
### Mutation testing scorecard: PR #594

**Verdict: ✅ The tests meet the bar.** Targets met; the one `new` gap has a verified test; the remaining survivor is optional and not behavior this PR introduced.

Gooze v1.6.1, changed lines only, head `c941d85`, mutagens: nine defaults plus `branch`, `statement`.

| File | Mutations | Killed | Raw score | Actionable score | Target | Result |
|---|---:|---:|---:|---:|---:|:---:|
| `service/kibo/session.go` | 24 | 22 (23 with proposed test) | 95.7% | 100% | 80% | ✅ |
| `service/kibo/user.go` | 1 | 0 | 0% | n/a (1 optional, pre-existing behavior) | 80% | ⚠️ optional |
| `service/kibo/order.go` | 1 | 1 | 100% | 100% | 60% | ✅ |

**Excluded (did not compile):** 1. **Not assessable (no mutants):** most of `order.go:169-209`, `updateguestuser.go`.

_Caveats: changed lines only; `user.go` has a single mutant, so its score alone is not meaningful; score is for mutations generated, not all possible bugs. Comparison with base tests: inconclusive (old tests don't compile against the new signature)._
```
