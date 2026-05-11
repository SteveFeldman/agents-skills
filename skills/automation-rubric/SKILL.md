---
name: automation-rubric
description: Use when auditing an existing test suite for quality and coverage gaps, evaluating Playwright migration readiness, scoring automation against a world-class e-commerce standard, or guiding the creation of new tests. Applicable to Selenium, WebdriverIO, and Playwright suites.
user_invocable: true
---

# Automation Rubric

World-class e-commerce test automation rubric across 18 categories — 10 core quality dimensions and 8 Playwright-specific capabilities. Two modes: **Audit** an existing suite or **Create** new tests.

---

## Determine Your Mode

| Mode | Trigger |
|---|---|
| **Audit** | "review", "evaluate", "score", "audit", "rate", or user points to existing test files |
| **Create** | "write tests", "create automation", "add coverage", or user describes a feature to test |

---

## Mode 1: Audit

### Step 1 — Gather Evidence

Read in this order:
1. All scenario/spec files (`.feature`, `.spec.ts`, `.test.ts`)
2. Page Object Model files
3. Step definitions, helpers, fixtures
4. Runner config (`playwright.config.ts`, `wdio.conf.js`)
5. CI config (`Jenkinsfile`, `.yml`)

### Step 2 — Score All 18 Categories

For each category, assign a score 1–5. For every score below 4, record:
- **Finding** — specific file, line number, or pattern
- **Impact** — why this matters for a production e-commerce platform
- **Recommendation** — the exact fix

### Step 3 — Produce the Report

Use the Report Format section at the bottom of this skill.

---

## Mode 2: Create

Before writing any test, run this pre-flight checklist:
- [ ] Single business rule per scenario
- [ ] State established via API, not UI
- [ ] Assertions verify exact values, not just presence
- [ ] Multi-condition UI blocks use `expect.soft()`
- [ ] Auth via `storageState` or fixture, not login flow
- [ ] Scenario tagged for correct device/browser project
- [ ] No credentials or environment-specific data in test files

After writing, self-audit the test against categories 1–10. Revise anything scoring below 4 before delivering.

---

## The 18-Category Rubric

### Scoring Scale

| Score | Meaning |
|---|---|
| **5** | World-class. No material gaps. Survives external audit. |
| **4** | Strong. Minor gaps that don't affect production confidence. |
| **3** | Adequate. Identifiable gaps a real bug could slip through. |
| **2** | Weak. Significant gaps or patterns that produce false confidence. |
| **1** | Insufficient. Missing, broken, or actively misleading. |

---

## Core Categories

### 1. Coverage & Journey Fidelity
Do scenarios reflect real user journeys? Are golden path, failure paths, and business-rule edge cases all present?

| Score | Evidence |
|---|---|
| 5 | Critical paths, failure paths, and edge cases (compliance thresholds, quantity limits, state rules) all covered |
| 3 | Golden path covered; failure paths sparse or absent |
| 1 | Happy path only; no negative or edge case coverage |

**Red flags:** `@skip` on critical flows · no negative test cases · only one scenario per feature area · placeholder/dummy scenarios

---

### 2. Assertion Quality & Depth
Do assertions verify *what* something is, not just *that* it exists? Do failures produce a useful diff?

| Score | Evidence |
|---|---|
| 5 | `toHaveText()`, `toHaveValue()`, exact strings throughout; failures show expected vs. actual |
| 3 | Mix of exact and presence-only assertions |
| 1 | `isDisplayed().toBe(true)` dominant; failures show only `true` / `false` |

**Red flags:** `.isDisplayed().toBe(true/false)` · `.includes(CONST).toBe(true)` · `expect(bool).toBe(true)` · no text content verified

---

### 3. Financial & Compliance Accuracy
Are prices, fees, taxes, discounts, and compliance messages asserted to exact values?

| Score | Evidence |
|---|---|
| 5 | Exact dollar amounts asserted; compliance copy verified against string constants; no tolerance |
| 3 | Some exact values; financial totals use tolerance or flag pattern |
| 1 | `±$0.01` tolerance baked in; compliance messages only verified as visible, not readable |

**Red flags:** `let flag = false` pattern · `difference === 0.01` tolerance · `.includes(COMPLIANCE_MSG).toBe(true)` instead of `.toContain()` · "non-zero" as the only financial assertion

---

### 4. Test Design & Maintainability
Single responsibility per scenario, domain-split POMs, no mixed concerns.

| Score | Evidence |
|---|---|
| 5 | One business rule per scenario; POMs split by domain; teardown in hooks not steps |
| 3 | Most scenarios focused; some mixing of unrelated concerns |
| 1 | Monolithic scenarios; god-class POMs over 1000 lines; cleanup in scenario body |

**Red flags:** Scenarios over 20 steps · POM files over 1000 lines · commented-out steps · unrelated assertions in same scenario · teardown steps in feature file

---

### 5. Test Data Strategy
API-first setup, dynamic data, no hardcoded credentials, clean teardown in hooks.

| Score | Evidence |
|---|---|
| 5 | All preconditions via API; credentials in environment variables; teardown in `after` hooks |
| 3 | Mostly API-driven; occasional UI navigation for setup; constants file for test data |
| 1 | UI-driven preconditions; credentials in test/feature files; no teardown |

**Red flags:** Plaintext credentials in feature files · hardcoded SKU IDs without fallbacks · `beforeEach` doing UI navigation · shared user accounts across parallel runs

---

### 6. Reliability & Determinism
Tests fail for the right reasons only. No timing dependencies or external service coupling.

| Score | Evidence |
|---|---|
| 5 | No explicit sleeps; all external services mocked or irrelevant to test; isolated test state |
| 3 | Occasional explicit waits; some external dependency tags present |
| 1 | `wait(N)` / `waitForTimeout()` patterns; `@PaypalDependent`, `@FedExDependent` tags; shared mutable state |

**Red flags:** `wait(WaitTime.LARGE)` · `@FedExDependent` · `@PaypalDependent` · `I wait for 120 seconds` · shared test accounts across tests

---

### 7. Cross-Platform Coverage
Desktop and mobile have assertion-level parity, not just `@desktop @mobile` tags.

| Score | Evidence |
|---|---|
| 5 | Mobile POM assertions match desktop depth; device-specific behaviors explicitly verified |
| 3 | Mobile tagged but assertions shallower than desktop counterpart |
| 1 | `@mobile` tagged but mobile POM contains zero `expect()` calls |

**Red flags:** Mobile page object with no assertions · single POM serving both desktop and mobile with no differentiation · `@desktop @mobile` on every scenario but only one viewport tested

---

### 8. Suite Health & Active Maintenance
Low skip rate, no dead code, accurate titles, bugs trigger test re-enablement.

| Score | Evidence |
|---|---|
| 5 | Zero permanent skips; no placeholder tests; all scenario titles accurately describe behavior |
| 3 | 1–2 skipped scenarios with active linked bug tickets |
| 1 | Multiple permanent skips; dummy scenarios; commented-out steps; typos in titles |

**Red flags:** `@skip` with no associated ticket · placeholder/dummy feature files · commented-out test steps · scenario title doesn't match what the scenario does · steps referencing products not added in setup

---

### 9. CI/CD Integration & Observability
A failing test is diagnosable from CI artifacts alone, without a local re-run.

| Score | Evidence |
|---|---|
| 5 | Traces, video, screenshots, and HTML report published as CI artifacts; failures gate deployment |
| 3 | JUnit XML output present; some artifacts; not all failures block pipeline |
| 1 | No artifact configuration; test results not surfaced in CI; failures don't gate anything |

**Red flags:** No `reporter` config · no trace or screenshot on failure · tests run but results not published · CI passes even when tests fail

---

### 10. Accessibility Coverage
A11y tested as a first-class concern, isolated from functional scenarios.

| Score | Evidence |
|---|---|
| 5 | Evinced/axe at key page states; focus management explicitly verified; isolated from functional tests |
| 3 | A11y scan present but fused with functional scenario steps |
| 1 | No a11y testing, or a11y scan embedded inside an unrelated functional journey |

**Red flags:** Accessibility test that also changes shopping methods · no keyboard navigation assertions on interactive components · no focus management verification on modals/overlays

---

## Playwright-Specific Categories

### 11. Network Interception & API Mocking
External services isolated via `page.route()`; outbound request payloads asserted where critical.

| Score | Evidence |
|---|---|
| 5 | All third-party dependencies mocked; payment, shipping, and promo APIs intercepted and controlled |
| 3 | Some mocking present; external dependency tags still active for some tests |
| 1 | No `page.route()` usage; tests coupled to live external services |

**Red flags:** `@PaypalDependent` / `@FedExDependent` with no mocking alternative · tests failing intermittently due to third-party downtime

---

### 12. Storage State & Session Management
Auth established once per worker via `storageState`; UI login never repeated per test.

| Score | Evidence |
|---|---|
| 5 | `storageState` saved in `globalSetup`; reused across all authenticated tests via fixture |
| 3 | Some `storageState` usage; occasional UI login flows still present |
| 1 | Every test authenticates through the UI; no `storageState` in config or fixtures |

**Red flags:** `I login with valid username and password` UI step in test body · no `storageState` in `playwright.config.ts` · repeated sign-in setup across scenarios

---

### 13. Fixture Architecture
Domain fixtures extend the base `test` object; setup is composable and dependency-injected.

| Score | Evidence |
|---|---|
| 5 | `fixtures/` directory with `test.extend()`; domain fixtures compose cleanly (`cartFixture`, `authFixture`) |
| 3 | Some fixtures exist; `beforeEach` still handles most setup |
| 1 | No fixtures; all setup in `beforeEach` blocks or scenario steps |

**Red flags:** Repeated `beforeEach` blocks across spec files · no `fixtures/` directory · setup logic duplicated across tests

---

### 14. Soft Assertion Coverage
`expect.soft()` used strategically for multi-condition UI verification blocks.

| Score | Evidence |
|---|---|
| 5 | Order summary line items, compliance message groups, and promo states use `expect.soft()` |
| 3 | Soft assertions present but used inconsistently or sparingly |
| 1 | No `expect.soft()` usage; hard stops on first failure in multi-element verification |

**Red flags:** Sequential hard assertions on order summary fields · hard stop in a compliance block that has 4+ conditions · no `expect.soft()` in the entire suite

---

### 15. Parallelization & Worker Strategy
Tests are independent and `playwright.config.ts` is configured for parallel execution.

| Score | Evidence |
|---|---|
| 5 | `workers` configured; test data scoped per test; no shared mutable state between workers |
| 3 | Parallel config present; some shared state risk identified but contained |
| 1 | No parallel config; tests must run serially or fail in parallel due to state conflicts |

**Red flags:** Shared user accounts reused across parallel workers · no `workers` setting in config · global state mutated by tests without isolation

---

### 16. Multi-Project Configuration
`playwright.config.ts` defines a deliberate browser and device matrix matching real user traffic.

| Score | Evidence |
|---|---|
| 5 | Projects defined for Chromium, Firefox, WebKit, and named mobile devices; smoke vs. full regression split |
| 3 | 2–3 projects configured; not all browsers covered |
| 1 | Single project or no `playwright.config.ts`; browser coverage is accidental |

**Red flags:** Only `chromium` project · no mobile device projects · `projects` array missing entirely

---

### 17. Visual Regression Coverage
`toHaveScreenshot()` used for high-stakes UI states with controlled baselines and a documented update workflow.

| Score | Evidence |
|---|---|
| 5 | Baselines for order summary, compliance messages, and promo states; update workflow documented |
| 3 | Some screenshots captured; no baseline strategy or update process defined |
| 1 | No visual regression tests; UI regressions caught only by human review |

**Red flags:** No `toHaveScreenshot()` calls · screenshots taken but not compared against baselines · no documented process for updating snapshots after intentional UI changes

---

### 18. Trace & Artifact Configuration
Every failing test produces artifacts sufficient to diagnose the failure without local reproduction.

| Score | Evidence |
|---|---|
| 5 | `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, HTML report published |
| 3 | Screenshots on failure; no trace viewer or video configured |
| 1 | No artifact configuration in `playwright.config.ts`; failures require local re-run to investigate |

**Red flags:** No `use` block in config · default reporter only · traces not published as CI artifacts · video disabled globally

---

## Report Format

Produce this markdown report at the end of every audit:

```markdown
# Automation Rubric Report
**Suite:** [MFE or suite name]
**Date:** [YYYY-MM-DD]
**Auditor:** Claude / Copilot
**Files Reviewed:** N scenario files · N POMs · N helpers · config: [yes/no]

---

## Summary

| Overall Score | X.X / 5.0 |
|---|---|
| Categories ≥ 4 (Strong) | N |
| Categories = 3 (Adequate) | N |
| Categories ≤ 2 (Critical Gap) | N |
| Permanently Skipped Tests | N |
| Top Priority | [single most impactful fix in one sentence] |

---

## Scorecard

| # | Category | Score | Status |
|---|---|---|---|
| 1 | Coverage & Journey Fidelity | X/5 | 🟢/🟡/🔴 |
| 2 | Assertion Quality & Depth | X/5 | |
| 3 | Financial & Compliance Accuracy | X/5 | |
| 4 | Test Design & Maintainability | X/5 | |
| 5 | Test Data Strategy | X/5 | |
| 6 | Reliability & Determinism | X/5 | |
| 7 | Cross-Platform Coverage | X/5 | |
| 8 | Suite Health & Active Maintenance | X/5 | |
| 9 | CI/CD Integration & Observability | X/5 | |
| 10 | Accessibility Coverage | X/5 | |
| 11 | Network Interception & API Mocking | X/5 | |
| 12 | Storage State & Session Management | X/5 | |
| 13 | Fixture Architecture | X/5 | |
| 14 | Soft Assertion Coverage | X/5 | |
| 15 | Parallelization & Worker Strategy | X/5 | |
| 16 | Multi-Project Configuration | X/5 | |
| 17 | Visual Regression Coverage | X/5 | |
| 18 | Trace & Artifact Configuration | X/5 | |

🔴 ≤ 2 · 🟡 = 3 · 🟢 ≥ 4

---

## Findings

### [Category Name] — X/5 🔴/🟡/🟢
**Finding:** [specific file:line or pattern observed]
**Impact:** [why this matters in production]
**Recommendation:** [exact fix — code pattern, config change, or structural change]

[Repeat for each category scoring below 4]

---

## Skipped / Dead Tests

| Test | File | Reason | Ticket | Days Skipped |
|---|---|---|---|---|
| [scenario name] | [file] | [reason] | [ticket or none] | [N] |

---

## Priority Action Plan

Ordered by impact × effort:

1. **[Fix]** — resolves categories [N, N] · estimated effort: [S/M/L]
2. **[Fix]** — resolves categories [N, N] · estimated effort: [S/M/L]
3. **[Fix]** — resolves categories [N, N] · estimated effort: [S/M/L]

---

## Path to World-Class

[3–5 sentences specific to this suite: what the team is doing right, what the migration or refactor should prioritize, and what world-class looks like for this specific domain.]
```
