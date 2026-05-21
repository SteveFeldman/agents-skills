---
name: pr-evidence
description: Use when a code review finding needs proof — write a focused test in JavaScript or Go that either confirms the issue is real or exposes it as over-engineering hyperbole. Trigger after code-review or code-review-skill findings are presented and evidence is requested.
---

# PR Evidence

Turn a code review finding into a concrete, runnable test that either proves the concern is real or demonstrates it is exaggerated. Every claim in a review should be verifiable. This skill produces that verification.

## Core Principle

A finding without evidence is an opinion. Write the minimal test that settles the question — and be willing to conclude the reviewer was wrong.

**Non-negotiable rules:**
1. The hyperbole check and over-engineering check MUST be completed before writing any test.
2. Every test MUST be run. Do not report results without executing the test and observing the output.
3. A full Evidence Report MUST be produced at the end covering all findings evaluated.

---

## Step 1 — Read Before You Assume

Before evaluating any finding, verify every assumption the reviewer made about library behavior, runtime semantics, or framework internals:

- If the finding references a third-party library: **read the source** (`node_modules/<pkg>/src/` or the built file). Do not assume what a prop, method, or config key does.
- If the finding claims a runtime behavior (type coercion, NaN propagation, operator precedence): **write a minimal proof** before assuming it's correct.
- If the finding references a CMS, API contract, or external system: **trace the actual call path** in the codebase before concluding the integration breaks.

> Skipping this step caused two Critical findings in a real review to be completely wrong (a library `contentId` assumed to be a CMS key was actually an ARIA `id`; a subtraction assumed to produce `NaN` was actually coerced by the JS `-` operator).

---

## Step 2 — Hyperbole Check (MANDATORY — do for every finding)

Answer all four questions. Record your answers explicitly — do not skip.

| # | Question | If YES | If NO |
|---|----------|--------|-------|
| Q1 | Is this code in a measured hot path? | Performance concern may be real | Benchmark is likely premature |
| Q2 | Does the scale (data size, frequency, scenario) actually occur in production? | Test at realistic scale | Finding is probably hypothetical |
| Q3 | Does the framework, runtime, or language already handle this? | Finding is likely noise | Investigate further |
| Q4 | Does the recommended fix introduce new complexity (abstraction, guard, indirection)? | Weigh cost vs. gain carefully | Fix is low-risk |

**Scoring:**
- 2+ NO answers → **strong signal of hyperbole** — write a refuting test first
- Q3 = YES alone → **likely noise** — verify by reading the source, then refute
- All YES → finding is plausible — write a confirming test

Record your answers in the Evidence Report as: `Q1:Y Q2:N Q3:N Q4:Y`.

---

## Step 3 — Over-Engineering Check (MANDATORY — do for every finding)

Separately evaluate whether the **recommended fix** itself is over-engineered, independent of whether the finding is real.

Answer these questions about the fix:

| Question | Signal |
|----------|--------|
| Does the fix add a guard for a code path that callers already guarantee won't occur? | Fix may be unnecessary |
| Does the fix extract an abstraction used in fewer than 3 places? | DRY is premature |
| Does the fix add complexity to handle a scenario that has never occurred and has no test proving it can? | Fix may be speculative |
| Would a future reader be confused by the "fixed" code without the PR context? | Fix may obscure intent |
| Does the fix add lines of code without changing the observable output in any test? | Fix adds churn |

If 2+ signals are present: **the recommendation may be over-engineered even if the underlying observation is correct.** Note this in the report — a valid observation can still lead to a bad recommendation.

---

## Step 4 — Write the Test

Write one minimal, falsifiable test per finding. The test must be designed so it **can fail either way** — a test that can only confirm is not evidence.

### Decision Flow

```
Finding received
      │
      ▼
[Step 1] Read source / trace call path / verify runtime behavior
      │
      ▼
[Step 2] Hyperbole Check — answer Q1–Q4
      │
      ├─ 2+ NO → Write REFUTING test (try to prove reviewer wrong)
      │
      └─ Passes → Write CONFIRMING test (try to prove reviewer right)
                        │
                        ▼
              [Step 3] Over-Engineering Check on the fix
                        │
      ┌─────────────────┘
      ▼
Run the test — observe actual output
      │
      ▼
Record in Evidence Report
```

### Finding Categories and Test Strategy

**Performance Finding** — "This is O(n²) and will be slow."

Benchmark at **realistic production scale** (grep for actual limits in schema/config — never use worst-case academic n).

```javascript
test('nested loop perf at actual max scale (50 items)', () => {
  // actual max dataset size from codebase: 50 items (checked via grep/schema)
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i, value: `item-${i}` }));
  const start = performance.now();
  const results = items.flatMap(a => items.map(b => a.id === b.id));
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(5); // verdict: O(n²) at n=50 is 2500 ops, not a bottleneck
});
```

```go
func BenchmarkNestedLoopAtScale(b *testing.B) {
    items := make([]Item, 50) // realistic max from schema/config
    for i := range items { items[i] = Item{ID: i, Value: fmt.Sprintf("item-%d", i)} }
    b.ResetTimer()
    for range b.N {
        for _, a := range items {
            for _, bItem := range items { _ = a.ID == bItem.ID }
        }
    }
    // if ns/op < 10000 (10µs), claim is hyperbole at this scale
}
```

**Missing Abstraction Finding** — "This should be extracted into a reusable helper / design pattern."

Count actual call sites. If fewer than 3, DRY is premature.

```javascript
test('abstraction cost exceeds benefit at current call-site count', () => {
  const createUser = (name, role) => ({ name, role, createdAt: new Date() });
  class UserFactory {
    static create(name, role) { return { name, role, createdAt: new Date() }; }
  }
  const inline = createUser('alice', 'admin');
  const factored = UserFactory.create('alice', 'admin');
  expect(inline).toMatchObject({ name: 'alice', role: 'admin' });
  expect(factored).toMatchObject({ name: 'alice', role: 'admin' });
  // verdict: factory adds a class, import, and indirection for zero behavioral gain at 2 call sites
});
```

**Error Handling Finding** — "This function needs more defensive checks."

Trace all callers. If inputs are guaranteed by internal contracts, the validation is dead code.

```go
func TestParseConfigNeverReceivesNil(t *testing.T) {
    cfg := &Config{Host: "localhost", Port: 8080}
    result, err := parseConfig(cfg)
    require.NoError(t, err)
    require.NotNil(t, result)
    // verdict: nil guard would be unreachable — adds complexity for an impossible path
}
```

**Security / Input Validation Finding** — "User input here is not sanitized."

Trace the input source. If it originates from an auth-gated system or enum, it may not need sanitization.

```javascript
test('userId comes from verified JWT, not raw user input', () => {
  const mockReq = { user: { id: '123' } }; // set by auth middleware after JWT verification
  expect(mockReq.user.id).toMatch(/^\d+$/); // JWT sub claim is always numeric string
  // verdict: field is constrained by JWT structure — no sanitization attack surface
});
```

**Complexity / Coupling Finding** — "This is too tightly coupled."

Test the boundary in isolation. If it mocks cleanly, coupling is probably fine.

```go
func TestHandlerInIsolation(t *testing.T) {
    store := &stubUserStore{user: &User{ID: "1", Name: "Alice"}}
    handler := NewUserHandler(store)
    req := httptest.NewRequest("GET", "/users/1", nil)
    rec := httptest.NewRecorder()
    handler.GetUser(rec, req)
    assert.Equal(t, 200, rec.Code)
    // verdict: handler tests cleanly in isolation — coupling concern is overstated
}
type stubUserStore struct{ user *User }
func (s *stubUserStore) Get(id string) (*User, error) { return s.user, nil }
```

---

## Step 5 — Run the Test (MANDATORY)

**Do not report results without running the test.** Execute using the project's test runner:

- JavaScript/TypeScript: `npx jest --testPathPattern=<evidence-file> --verbose --no-coverage`
- Go: `go test -run TestFindingName ./...` or `go test -bench BenchmarkName ./...`

If dependencies are not installed, install them (`npm ci`, `go mod download`) before running. Confirm the test output before writing the verdict.

Paste or summarize the actual test output in the Evidence Report.

---

## Step 6 — Evidence Report (MANDATORY — produce at end)

After running all tests, produce this report. Every finding evaluated must appear in the table.

---

### Evidence Report

**PR:** [number and title]
**Findings evaluated:** [N]
**Tests written:** [N] | **Tests run:** [N] | **Tests passed:** [N]

#### Findings Summary

| Finding | Hyperbole Check | Over-Engineering Check | Test Result | Verdict | Severity Change |
|---------|----------------|----------------------|-------------|---------|----------------|
| #N — [title] | Q1:? Q2:? Q3:? Q4:? | [Pass / 🔴 Over-engineered] | ✅ Pass / ❌ Fail | CONFIRMED / REFUTED / NUANCED | Critical→Low / No change |

#### Confirmed Findings

For each CONFIRMED finding:

```
## Evidence: [Finding Title]

**Claim:** [exact reviewer claim]
**Hyperbole Check:** Q1:Y Q2:Y Q3:N Q4:N — passes
**Over-Engineering Check:** Fix is proportionate
**Verdict:** CONFIRMED

**Test:** [filename:line or inline snippet]
**Result:** [actual test output]

**Conclusion:** [1–2 sentences on what specifically makes this a real concern]
```

#### Refuted / Downgraded Findings

For each REFUTED or NUANCED finding:

```
## Evidence: [Finding Title]

**Claim:** [exact reviewer claim]
**Hyperbole Check:** Q1:N Q2:N Q3:Y Q4:Y — fails (2+ NO)
**What the reviewer got wrong:** [specific error — wrong assumption about library, operator, scale, etc.]
**Verdict:** REFUTED / NUANCED

**Test:** [filename:line or inline snippet]
**Result:** [actual test output]

**Conclusion:** [1–2 sentences. State what the reviewer assumed vs. what the evidence shows.
                 If nuanced, explain under what conditions the finding would become real.]
```

#### Checklist

- [ ] Step 1 completed: source/runtime verified for all library/framework assumptions
- [ ] Step 2 completed: hyperbole check answered (Q1–Q4) for every finding
- [ ] Step 3 completed: over-engineering check run on every recommended fix
- [ ] Step 4 completed: every finding has a falsifiable test (can fail either way)
- [ ] Step 5 completed: every test was executed and output observed
- [ ] Step 6 completed: Evidence Report produced with all findings in the summary table

---

## Common Reviewer Hyperbole Patterns

| Claim Pattern | Likely Verdict | Evidence Strategy |
|---------------|----------------|-------------------|
| "This will be slow at scale" | Refuted if n < 1000 | Benchmark at actual max n |
| "This needs a design pattern" | Refuted if < 3 call sites | Count call sites, show inline suffices |
| "This isn't reusable" | Refuted if only used once | Show single-use is intentional |
| "This should have error handling" | Refuted if caller guarantees valid input | Trace input origin |
| "This is too complex" | Context-dependent | Cyclomatic complexity metric + readability test |
| "This has a security risk" | Refuted if input is bounded | Trace input source to auth boundary |
| "This couples X to Y" | Refuted if mockable | Write isolation test |
| "This prop/key does X" | Refuted if source says otherwise | Read the library source |
| "This operator produces NaN/error" | Refuted if language coerces | Write a minimal arithmetic proof |

## Integration with Code Review Skills

This skill is the evidence layer on top of `code-review` and `code-review-skill`. Typical flow:

1. `code-review-skill` or `code-review` produces findings
2. Developer or reviewer disputes a finding, or a full evidence pass is requested
3. Invoke `pr-evidence` — run all 6 steps for every finding
4. Deliver the Evidence Report — severity changes are supported by test output, not opinion
