# Rule reference

Every rule has an ID, a category, a severity, and a fix. The scanner emits these IDs. Severity weights: critical 15, high 5, medium 2, low 0.5, info 0.

## Backing and sources

Every rule is traced to the official Playwright documentation, and the strength of that backing is recorded in [sources.json](sources.json) (the scanner reads it and prints it in every report).

- **official**: the docs explicitly recommend or discourage the practice.
- **partial**: the docs describe the behavior or cover only part of the rule. The severity or threshold is our convention.
- **none**: team convention with no source yet. These are flagged **NEEDS BACKING** and the report labels them as convention, not as Playwright guidance.
- **general reviewer**: a tag on verifier items that are general code-review practice (PR verdict policy, duplicate helpers, vacuous negatives, the CI reporter check and similar). They have no Playwright source by design and are labeled that way in reports.
- **engineering best practice**: a tag on PW201. Verify the intended outcome explicitly; Playwright does not require an assertion in every test.
- **debugging best practice**: a tag on the failure-artifact rules (PW403 trace, PW404 screenshot, PW409 video) and on PW206 (attach or step instead of console output). We require all three on failure as one debugging standard. The docs back traces most strongly; screenshot and video are our addition.

| Rule | Backing | Docs | Evidence |
|---|---|---|---|
| PW001 | official | [api/class-page](https://playwright.dev/docs/api/class-page) | page.waitForTimeout: Discouraged. Never wait for timeout in production. Tests that wait for time are inherently flaky. |
| PW002 | official | [api/class-page](https://playwright.dev/docs/api/class-page), [api/class-elementhandle](https://playwright.dev/docs/api/class-elementhandle) | page.$ / page.$$: Discouraged, use locator-based page.locator() instead. page.waitForSelector: Discouraged, use web assertions or locator.waitFor(). |
| PW003 | official | [api/class-page](https://playwright.dev/docs/api/class-page) | waitUntil 'networkidle' - DISCOURAGED. |
| PW004 | official | [best-practices](https://playwright.dev/docs/best-practices), [api/class-locator](https://playwright.dev/docs/api/class-locator) | Use web first assertions; expect(await locator.isVisible()).toBe(true) will not wait. locator.isVisible: use expect(locator).toBeVisible() to avoid flakiness. |
| PW005 | official | [api/class-testconfig](https://playwright.dev/docs/api/class-testconfig) | forbidOnly: exit with an error if any tests are marked test.only(). Useful on CI. |
| PW006 | official (informational) | [test-annotations](https://playwright.dev/docs/test-annotations) | The docs describe skip and fixme as valid. PW006 is an informational notice, not scored, so skipped tests stay visible to the team. |
| PW007 | partial | [actionability](https://playwright.dev/docs/actionability) | force disables non-essential actionability checks; a raw `el.click()` in `evaluate()` skips them entirely (our inference). Descriptive only; severity is ours. |
| PW008 | partial | [api/class-page](https://playwright.dev/docs/api/class-page) | Extends the waitForTimeout guidance to hand-rolled sleeps. The docs do not name setTimeout explicitly. |
| PW010 | partial | [api/class-locator](https://playwright.dev/docs/api/class-locator) | isVisible does not wait; docs steer to expect(locator).toBeVisible(). Treating branch probes as low severity is our convention. |
| PW101 | official | [best-practices](https://playwright.dev/docs/best-practices), [locators](https://playwright.dev/docs/locators) | Prefer user-facing attributes to XPath or CSS selectors. |
| PW102 | official | [best-practices](https://playwright.dev/docs/best-practices), [locators](https://playwright.dev/docs/locators) | Prefer user-facing attributes to XPath or CSS selectors; a class change breaks the test. |
| PW103 | official | [best-practices](https://playwright.dev/docs/best-practices), [locators](https://playwright.dev/docs/locators) | Prefer user-facing attributes to CSS selectors; tests that depend on DOM structure break. `#id` selectors are folded in here (the docs do not name `#id` specifically). |
| PW105 | official (informational) | [locators](https://playwright.dev/docs/locators) | Playwright warns that positional locators may select the wrong target after a page change, but documents their use for lists distinguished by order. The audit reports candidates without scoring them. |
| PW201 | partial (engineering best practice) | [test-assertions](https://playwright.dev/docs/test-assertions) | Verify the intended outcome explicitly. The scanner can miss helper-based or other checks; Playwright does not require an assertion in every test. |
| PW203 | official | [api/class-test](https://playwright.dev/docs/api/class-test) | test.describe.serial: Discouraged. Using serial is not recommended. It is usually better to make your tests isolated. |
| PW204 | partial | [test-use-options](https://playwright.dev/docs/test-use-options) | baseURL allows navigating by using just the path, for example page.goto('/settings'). Descriptive; no explicit prohibition of absolute URLs. |
| PW205 | official (external standard) | [CWE-798](https://cwe.mitre.org/data/definitions/798.html), [OWASP](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password) | Hard-coded credentials. Not Playwright guidance; backed by CWE/OWASP. Scans every JS/TS file under the tests directory (data and helper files included), not only specs. |
| PW206 | partial (debugging best practice) | [testinfo](https://playwright.dev/docs/api/class-testinfo), [test](https://playwright.dev/docs/api/class-test) | The docs do not discourage `console.log`; they document `testInfo.attach` and `test.step` as the structured alternatives. Preferring them is our debugging best practice. Reporter markers like `[[KEY\|value]]` are exempt. |
| PW301 | official | [network](https://playwright.dev/docs/network) | Docs create the waitForResponse promise first ('Note no await'), then click, then await the response. |
| PW302 | partial | [best-practices](https://playwright.dev/docs/best-practices), [mock](https://playwright.dev/docs/mock) | Avoid testing third-party dependencies; use the Network API to guarantee the response needed. The docs do not require every suite to mock. Severity and the 'suite never mocks' heuristic are ours. |
| PW401 | official | [api/class-testconfig](https://playwright.dev/docs/api/class-testconfig) | forbidOnly: ... Useful on CI. |
| PW402 | partial | [test-retries](https://playwright.dev/docs/test-retries), [api/class-testconfig](https://playwright.dev/docs/api/class-testconfig) | Playwright documents retries. Requiring them in CI is a deliberate audit convention, not a Playwright requirement. |
| PW403 | official (debugging best practice) | [best-practices](https://playwright.dev/docs/best-practices), [trace-viewer](https://playwright.dev/docs/trace-viewer) | Traces run on CI on the first retry. We don't recommend setting this to 'on', it is very performance heavy. |
| PW404 | partial (debugging best practice) | [best-practices](https://playwright.dev/docs/best-practices), [api/class-testoptions](https://playwright.dev/docs/api/class-testoptions), [test-use-options](https://playwright.dev/docs/test-use-options) | Debugging best practice (ours): capture a screenshot on failure. The docs' own config example shows screenshot: 'only-on-failure' ('Capture screenshot after each test failure'), but the best-practices page ranks the trace viewer above screenshots and videos for CI debugging. Requiring it is our convention. |
| PW405 | partial | [best-practices](https://playwright.dev/docs/best-practices), [test-parallel](https://playwright.dev/docs/test-parallel) | Playwright runs tests in parallel by default; files are parallel, tests within a file are not unless fullyParallel or describe.configure({ mode: 'parallel' }). Recommending fullyParallel is our convention. |
| PW406 | partial | [test-use-options](https://playwright.dev/docs/test-use-options) | baseURL allows navigating by using just the path. Descriptive. |
| PW407 | none (general reviewer) | [test-reporters](https://playwright.dev/docs/test-reporters) | General reviewer guidance, not Playwright guidance. The docs say a config without a reporter is valid (`dot` is the CI default). PW407 only checks that a reporter is configured. |
| PW408 | partial | [ci](https://playwright.dev/docs/ci), [test-parallel](https://playwright.dev/docs/test-parallel) | The CI page recommends `workers` of 1 on CI and warns against exceeding the core count. Requiring an explicit setting is our convention. |
| PW409 | partial (debugging best practice) | [best-practices](https://playwright.dev/docs/best-practices), [api/class-testoptions](https://playwright.dev/docs/api/class-testoptions), [trace-viewer](https://playwright.dev/docs/trace-viewer) | Debugging best practice (ours): record video on failure. The docs document the video option (retain-on-failure, on-first-retry) but recommend the trace viewer over videos for CI debugging. Requiring it is our convention. |

### Needs backing

Rules with no Playwright source: PW407, which is tagged `general-reviewer` (general reviewer guidance by decision, not a gap to fill).
Checklist items tagged `general-reviewer` (general code-review practice authored for this skill, not Playwright guidance): no-vacuous-negatives, legacy-debt-not-blocking, behavior-change-has-test, no-duplicate-helpers, improvements-credited, ci-reporter, no-new-blocking-findings, config-blast-radius-stated.
Partial rules whose specific claim still needs a source: PW007, PW008, PW010, PW204, PW206, PW302, PW404, PW405, PW406, PW408, PW409.

## Reliability (weight 30)

| ID | Sev | Finding | Why | Fix |
|---|---|---|---|---|
| PW001 | high | `page.waitForTimeout(n)` | Fixed sleep: slow when the app is fast, flaky when it is slow | Assert the state: `await expect(locator).toBeVisible()` / `toHaveText` |
| PW002 | medium | `waitForSelector`, `page.$`, `page.$$` | Legacy; `$` returns immediately with no retry | Locator + web-first assertion |
| PW003 | medium | `waitForLoadState('networkidle')` | Never settles with analytics/polling; Playwright discourages it | Wait for a user-visible element |
| PW005 | critical | `test.only` / `describe.only` | Silently skips the rest of the suite | Remove; enforce `forbidOnly` |
| PW007 | medium | `{ force: true }` or `locator.evaluate(el => el.click())` | Skips actionability checks, hides real UX bugs | Fix the obstruction (overlay, animation) |
| PW008 | high | `setTimeout`/`sleep` as a wait in specs/pages | Same as PW001. Ignored in non-UI helpers and race-timeouts | Condition-based wait |

## Locators (weight 20)

Priority: role > label/placeholder/text > **project test-id** > aria attribute > id > class/structure > XPath.
A project-wide test-id attribute (e.g. `data-qa`) is accepted; it is not penalized.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| PW101 | high | XPath | Role/label/test-id |
| PW102 | medium | Class or hashed CSS-module class (`.foo`, `[class*=_x_]`) | Test-id, or role + name |
| PW103 | low | Tag/structural/`#id` CSS selector (`article h2 a`, bare `button`, `#submit`) | `getByRole` with name |
| PW105 | info (unscored, non-blocking) | Positional locator (`.first()`, `.nth()`, `.last()`) | Keep deliberate ordering. If the test needs a specific target and reordering could select another one, suggest scoping by identity. A nearby comment neither suppresses nor justifies a finding by itself. |

## Assertions (weight 15)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| PW004 | medium | One-shot read feeding an assertion/branch: `textContent`, `innerText`, `inputValue`, `isVisible`, `count()`, ...; includes `isVisible().catch()` issued right after a click/goto/fill with no wait | `expect(locator).toHaveText/toBeVisible/toHaveCount` or `expect.poll` |
| PW010 | low | `isVisible().catch(() => false)` used as an optional-element probe in a branch (a common, defensible idiom, but it reads state once). Escalates to PW004 when it directly follows an action | `locator.or()`, or `waitFor({ timeout }).then(() => true, () => false)` so the probe waits briefly |
| PW201 | high | No assertion or verification helper detected | Confirm whether the intended outcome is already checked. If not, add an observable check. For intentional exceptions, use `// pw-audit-ignore PW201 <reason>` |

## Structure (weight 15)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| PW006 | info (not scored) | Unconditional `test.skip/fixme('title', ...)` | Notice only. The finding says whether a ticket or comment is present. Conditional `test.skip(cond, reason)` is not reported |
| PW203 | medium | `describe.serial` | Make tests independent |
| PW204 | medium | Hardcoded absolute URL in `goto` | Use `baseURL` + relative path |
| PW205 | high | Hardcoded credential/secret literal | Environment variable / secret store |
| PW206 | low | `console.log` in specs (`[[…]]` reporter markers exempt) | `test.info().annotations`, `test.step`, or remove |

## Determinism (weight 10)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| PW301 | high | `waitForResponse/Request` awaited **after** the triggering click/goto | Start the wait first: `const r = page.waitForResponse(...)` then act, then `await r` (or `Promise.all`) |
| PW302 | medium | Suite never shapes responses (`route.fulfill`, HAR) | Add mocks for error/edge states that cannot be forced on live data. Accept via profile for live-env-only suites |

Counted as mocking: `route.fulfill`, `route.fetch`, `routeFromHAR`. `route.abort()` (tracker blocking) is hygiene, not mocking.

## Config (weight 10) - evaluated once per `playwright.config.*`

| ID | Sev | Check |
|---|---|---|
| PW401 | high | `forbidOnly` present (usually `!!process.env.CI`) |
| PW402 | medium | `retries` set for CI |
| PW403 | low | `trace` configured (`on-first-retry` / `retain-on-failure`), not `'on'` |
| PW404 | low | `screenshot` set and not `'off'` (use `'only-on-failure'`) |
| PW409 | low | `video` set and not `'off'` (use `'retain-on-failure'`) |
| PW405 | low | `fullyParallel: true` |
| PW406 | medium | `baseURL` set |
| PW407 | low | A CI-consumable reporter (junit/html/json) |
| PW408 | low | `workers` set explicitly (e.g. `process.env.CI ? 1 : undefined`) |

## Intentionally not rules (judgment, see checklist)

`storageState`, `webServer`, visual snapshots, cross-browser projects, sharding. These are valid only when they fit the project. Evaluate them in the judgment pass, never as automatic deductions.

## Suppression

- Inline: `// pw-audit-ignore PW201 reason` on the finding's line or the line above.
- Project-wide: `acceptedDeviations` in `.pw-audit.json`. Accepted counts are listed in the output (`acceptedDeviations`), never hidden.
