# Judgment checklist (what the scanner cannot see)

Work through these after verifying scanner findings. Each item is a question to answer with evidence from the code.

## Assertion quality
- Does each test assert the behavior in its title, or only that something rendered?
- Any `expect(...).toBeTruthy()` on a locator or promise (always true)?
- Do page-object `expect*` helpers actually contain `expect`?
- Are negative cases asserted (`not.toBeVisible`) with a positive precondition so they cannot pass vacuously?

## Independence and state
- Can each test run alone and in any order? Look for shared mutable module state, `describe.serial`, tests that depend on data created by a previous test.
- Does a test leave server-side state behind (cart, address, session) with no cleanup?
- Does `fullyParallel` plus shared accounts cause collisions?

## Flakiness by design
- Tests pinned to one product/store/SKU with no fallback (stock and price drift).
- Time, date, locale or timezone dependent assertions.
- Dependence on third-party scripts (analytics, chat); is tracking blocked?
- Long fixed timeouts that hide slowness (`timeout: 120_000`, `setTimeout(600_000)`).

## Network and determinism
- Which error/edge states exist only as skipped tests because they cannot be forced on live data? That is the case for mocks.
- Is `waitForResponse` registered before the trigger? (PW301)
- Do tests assert on API payloads they could instead verify through UI?

## Structure and architecture
- Page objects: locators in constructors, actions as methods, no assertions leaking business logic? Any page object over ~300 lines that should be split into sections/components?
- Fixtures: shared setup in fixtures rather than copy-pasted `beforeEach`? Is teardown automatic?
- Are tests one flow each, or mega-tests spanning many flows? (Scan-style tests with `test.step` are acceptable when documented.)
- Test titles describe behavior, with tags (`@smoke`, `@regression`) used consistently?

## Auth and sessions
- Is login repeated per test (slow) or established once/through an API fixture?
- `storageState` is one valid approach. An API-created session injected by fixture is equivalent. Do not penalize either; penalize repeated UI login.

## Security
- Credentials/tokens in test code, config, or committed `.env`? (Cite location only; never echo the value.)
- Traces/videos/HAR retained on CI that could contain tokens or PII?

## CI and operability
- Reporters, artifact upload, retries, sharding/worker settings visible in the pipeline file?
- Browser install includes system deps on Linux runners?
- Does the pipeline fail on `test.only`?
- If CI config lives in a shared library and cannot be seen, mark "not assessable". Do not guess.

## Coverage fit
- Which critical user journeys have no test at all?
- Which tests duplicate what a unit/integration test already covers more cheaply?
- Cross-browser/mobile: are the configured projects actually exercised by the tests, or only declared?

## PR-only checks
- Does the PR change app behavior without touching a test, or the reverse?
- Does a new test fail without the change (or is it vacuous)? Prefer asking for evidence: a run log or `--repeat-each` result.
- New locators: do they use the project's accepted strategy?
- New helper/page object: is there already an equivalent one?
- Does the PR add `test.skip`/`fixme` without a ticket?
- Does it alter `playwright.config.*` (retries, timeouts, workers, projects)? Call out blast radius.
