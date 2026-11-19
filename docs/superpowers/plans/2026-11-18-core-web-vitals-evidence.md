# Core Web Vitals: Evidence-Grade Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `skills/core-web-vitals` produce numbers that are honest about what they are (lab results under stated conditions, never presented as field data) and that explain *why* a metric is slow (LCP/INP phase breakdowns), while fixing the known collection bugs and slimming `SKILL.md` into progressive-disclosure references.

**Architecture:** Keep the Playwright + `web-vitals` measurement engine and its public API (`lib/cwv-collector.js` stays the entry point and re-exports everything). Split the 935-line collector into focused modules, vendor a pinned `web-vitals` build and inject it via `page.evaluate` (immune to CSP and CDN outages), add measurement-condition presets applied through CDP, add a breakdown module, and teach the three report renderers to show conditions, the lab-data label and breakdowns. `SKILL.md` shrinks to rules + core workflow; patterns and diagnosis guides move to `references/`.

**Tech Stack:** Node ≥18 (CommonJS), Playwright (resolved from the sibling `playwright-dev` skill), `web-vitals` 6.2.3 attribution IIFE build (vendored), Chrome DevTools Protocol via `context.newCDPSession`, `node:test` + `node:assert/strict`.

**Spec:** No separate spec file. Requirements come from the 2026-11-18 session comparing this skill with Addy Osmani's `web-quality-skills/core-web-vitals`, Cloudflare's `web-perf`, and secondsky's `web-performance-audit`; the decisions are recorded in **Design Decisions** below, which is the spec for this plan.

## Design Decisions

1. **Adapt ideas, don't merge files.** Addy's skill is MIT-licensed; we write our own text and credit it in `references/` (one line). No verbatim copying.
2. **Pin and vendor `web-vitals` 6.2.3.** 6.x fixed negative `resourceLoadDuration` (6.2.3) and `inputDelay` (6.2.1) — the exact fields the breakdowns use. v6's only attribution break (`includeProcessedEventEntries` default → false) does not affect us; soft-navigation reporting is opt-in and stays off.
3. **Inject by evaluation, not script tag.** `page.evaluate` runs through CDP and is not subject to page CSP; this removes the unpkg dependency and the CSP failure in one move.
4. **Conditions are always recorded.** Every result carries `conditions`. Pages created outside the skill get `preset: 'unspecified'` and a warning in every report. `createMeasuredPage` and `measureMultipleUrls` default to the `mobile` preset (Google is mobile-first). This is a deliberate behavior change for `measureMultipleUrls` — callers wanting old behaviour pass `preset: 'none'`.
5. **Lab ratings stay, but are labelled.** Reports keep good/needs-improvement/poor colouring, and every report states it is a single lab run, with fixed disclaimer copy (Global Constraints).
6. **No field-data collection.** The skill does not call CrUX or any other field-data API. Field data stays the user's to bring: the docs name PageSpeed Insights, Search Console's Core Web Vitals report and the user's own RUM as sources, and the evidence rules govern how lab results are described relative to them.
7. **Recommendations for LCP and INP are keyed by dominant phase**, not by rating. CLS/FCP/TTFB keep the existing rating-keyed table.

## Global Constraints

- Node `>=18.0.0`; CommonJS only; no new npm dependencies in `skills/core-web-vitals` (tests use `node:test`).
- Playwright is resolved from `skills/playwright-dev` (`cd skills/playwright-dev && npm run setup` once). Integration tests **fail**, never skip, when Playwright is missing.
- Pinned library: `web-vitals` **6.2.3**, file `lib/vendor/web-vitals.attribution.iife.js`, with `lib/vendor/LICENSE` (Apache-2.0, copied from the npm tarball).
- Public exports that must keep working: `collectCWV, printReport, assertCWV, measureMultipleUrls, printComparison, generateMarkdownReport, generateHtmlReport, saveReport, THRESHOLDS, WEB_VITALS_CDN, getRating, formatValue`.
- Thresholds unchanged: LCP 2500/4000 ms, INP 200/500 ms, CLS 0.1/0.25, FCP 1800/3000 ms, TTFB 800/1800 ms.
- Preset values (CDP `downloadThroughput`/`uploadThroughput` are bytes/s = kbps × 1024 / 8):
  - `mobile`: viewport 412×823, deviceScaleFactor 1.75, isMobile, hasTouch, UA `Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36`, latency 150 ms, down 1638.4 kbps, up 750 kbps, CPU 4×.
  - `desktop`: viewport 1350×940, deviceScaleFactor 1, latency 40 ms, down 10240 kbps, up 10240 kbps, CPU 1×.
  - `none`: no emulation, no throttling (explicitly unthrottled).
- Lab disclaimer copy (exact, all three report formats): `Lab data from a single run under the conditions above. Google's ranking signal uses field data (CrUX p75 over 28 days), so these values are not directly comparable.`
- Unspecified-conditions copy (exact): `Measurement conditions were not recorded — the page was created outside createMeasuredPage(), so results are likely unthrottled desktop.`
- `SKILL.md` ≤ 10,000 bytes after Task 6.

## Review Focus

1. **The page navigates or redirects by itself during collection** (`location.replace`, meta refresh) — expect a result with a warning and whatever metrics were captured, not an "Execution context was destroyed" crash. Test: Task 3, `self-navigating page returns warning instead of throwing`.
2. **Attribution missing or partial** (LCP is a text node with no resource, `web-vitals` omits phase fields) — expect `breakdown: null` or only the present phases, and reports that still render. Test: Task 5, `getBreakdown tolerates missing fields`.
3. **A URL fails under a throttled preset** (slow mobile load exceeds the 30 s `goto` timeout, or DNS fails) in `measureMultipleUrls` — expect an error entry that still carries the preset's `conditions`, and the remaining URLs measured. Test: Task 4, `measureMultipleUrls keeps going and records conditions on error entries`.
4. **A Firefox/WebKit browser is passed to `createMeasuredPage` with a throttled preset** — expect a clear error naming Chromium, not a CDP stack trace. Test: Task 4, `createMeasuredPage rejects non-chromium for throttled presets`.
5. **Old-shape results** (built by older scripts, or `measureMultipleUrls` error entries without `conditions`/`warnings`) fed to the report generators — expect them to render with the unspecified-conditions copy. Test: Task 4, `reports render legacy results without conditions`.

---

### Task 1: Test harness and module split (no behaviour change)

**Files:**
- Create: `skills/core-web-vitals/lib/thresholds.js` — `THRESHOLDS`, `RATING_ICONS`, `getRating`, `formatValue` (moved from `cwv-collector.js:19-46`)
- Create: `skills/core-web-vitals/lib/collect.js` — `injectWebVitals`, `setupCollectors`, `simulateInteractions`, `forceMetricFlush`, `collectCWV`, `assertCWV`, `measureMultipleUrls` (moved from `:55-361`)
- Create: `skills/core-web-vitals/lib/reports.js` — `printReport`, `_printAttribution`, `printComparison`, `RECOMMENDATIONS`, `getRecommendations`, `generateMarkdownReport`, `generateHtmlReport`, `_esc`, `saveReport` (moved from `:226-918`)
- Modify: `skills/core-web-vitals/lib/cwv-collector.js` — becomes a re-export barrel with the same `module.exports` keys
- Modify: `skills/core-web-vitals/package.json` — `"test": "node --test test/unit/*.test.js"`, `"test:integration": "node --test --test-concurrency=1 test/integration/*.test.js"`
- Create: `skills/core-web-vitals/test/helpers/results.js`
- Test: `skills/core-web-vitals/test/unit/thresholds.test.js`, `test/unit/assert.test.js`, `test/unit/reports.test.js`, `test/unit/exports.test.js`

**Interfaces:**
- Produces: `makeResult(overrides?: object) → CWVResult` in `test/helpers/results.js` — a result for `https://example.test/` with LCP 1823.4 ms (attribution `{target:'img.hero', url:'https://example.test/hero.webp', timeToFirstByte:300, resourceLoadDelay:200, resourceLoadDuration:900, elementRenderDelay:423.4}`), INP 156 (`{interactionTarget:'button#buy', interactionType:'pointer', inputDelay:20, processingDuration:100, presentationDelay:36}`), CLS 0.08214, FCP 1200, TTFB 300, each built with the real `getRating`/`formatValue`. `overrides.metrics` merges per metric.
- Produces: module boundaries above; every later task edits the module named, never the barrel.

- [ ] **Step 1: Write the characterization tests**

```js
// thresholds.test.js
test('getRating boundaries are inclusive of good/poor limits', () => {
  assert.equal(getRating('LCP', 2500), 'good');
  assert.equal(getRating('LCP', 2501), 'needs-improvement');
  assert.equal(getRating('LCP', 4000), 'needs-improvement');
  assert.equal(getRating('LCP', 4001), 'poor');
  assert.equal(getRating('CLS', 0.1), 'good');
  assert.equal(getRating('NOPE', 1), 'unknown');
  assert.equal(getRating('LCP', null), 'unknown');
});
test('formatValue rounds ms and fixes CLS to 4dp', () => {
  assert.equal(formatValue('LCP', 1823.4), '1823ms');
  assert.equal(formatValue('CLS', 0.08214), '0.0821');
  assert.equal(formatValue('LCP', null), 'N/A');
});
// assert.test.js
test('assertCWV reports every failure in one error', () => {
  const r = makeResult({ metrics: { LCP: { value: 3000 } } });
  delete r.metrics.CLS;
  assert.throws(() => assertCWV(r, { LCP: 2500, CLS: 0.1 }),
    (e) => /LCP: 3000ms exceeds threshold of 2500ms/.test(e.message) && /CLS: not captured/.test(e.message));
});
test('assertCWV passes when all within threshold', () => {
  assert.doesNotThrow(() => assertCWV(makeResult(), { LCP: 2500, INP: 200, CLS: 0.1 }));
});
// reports.test.js
test('markdown report renders the metric row', () => {
  const md = generateMarkdownReport(makeResult());
  assert.match(md, /\| \*\*LCP\*\* — Largest Contentful Paint \| 1823ms \| ✅ Good \|/);
});
test('html report escapes attribution selectors', () => {
  const html = generateHtmlReport(makeResult({ metrics: { LCP: { attribution: { target: 'img[alt="<x>"]' } } } }));
  assert.ok(!html.includes('<x>'));
});
// exports.test.js
test('public API keys are unchanged', () => {
  const api = require('../../lib/cwv-collector');
  for (const k of ['collectCWV','printReport','assertCWV','measureMultipleUrls','printComparison',
    'generateMarkdownReport','generateHtmlReport','saveReport','THRESHOLDS','WEB_VITALS_CDN','getRating','formatValue'])
    assert.ok(k in api, k);
});
```

- [ ] **Step 2: Run against the unsplit file to confirm the tests describe current behaviour**

Run: `cd skills/core-web-vitals && npm test`
Expected: PASS (these are characterization tests; any failure means the test is wrong — fix the test, not the code).

- [ ] **Step 3: Move code into `thresholds.js`, `collect.js`, `reports.js`; reduce `cwv-collector.js` to `module.exports = { ...require('./thresholds'), ...require('./collect'), ...require('./reports') }` filtered to the public keys plus `WEB_VITALS_CDN`**

Pure move: no edits to function bodies. `collect.js` and `reports.js` require `./thresholds`.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, same count as Step 2.

- [ ] **Step 5: Commit**

```bash
git add skills/core-web-vitals
git commit -m "refactor(cwv): split collector into modules and add unit tests"
```

---

### Task 2: Vendored, pinned `web-vitals` with CSP-proof injection

**Files:**
- Create: `skills/core-web-vitals/lib/vendor/web-vitals.attribution.iife.js` (from `npm pack web-vitals@6.2.3`, `package/dist/web-vitals.attribution.iife.js`, unmodified)
- Create: `skills/core-web-vitals/lib/vendor/LICENSE` (from the same tarball)
- Modify: `skills/core-web-vitals/lib/collect.js` — `injectWebVitals`
- Create: `skills/core-web-vitals/test/helpers/server.js`, `test/helpers/browser.js`
- Create: `skills/core-web-vitals/test/fixtures/basic.html`, `test/fixtures/hero.svg`
- Test: `skills/core-web-vitals/test/integration/inject.test.js`

**Interfaces:**
- Produces: `WEB_VITALS_VERSION = '6.2.3'` exported from `collect.js` and the barrel; `WEB_VITALS_CDN` becomes `https://unpkg.com/web-vitals@6.2.3/dist/web-vitals.attribution.iife.js` (kept for compatibility, no longer used internally).
- Produces: `startServer(routes?: Record<string, {headers?: object}>) → Promise<{ origin: string, close(): Promise<void> }>` serving `test/fixtures/` with optional per-path response headers.
- Produces: `launchChromium() → Promise<Browser>` — resolves `playwright` via `require.resolve('playwright', { paths: [path.join(__dirname, '../../../playwright-dev')] })`, launches headless Chromium; throws `Error('Playwright not found — run: cd skills/playwright-dev && npm run setup')` if unresolvable.

- [ ] **Step 1: Write the failing integration tests**

`basic.html`: an `<h1>`, a paragraph, and `<img class="hero" src="/hero.svg" width="800" height="400">`.

```js
test('collects LCP/FCP/TTFB on a page whose CSP forbids external and inline scripts', async () => {
  const srv = await startServer({ '/basic.html': { headers: { 'Content-Security-Policy': "script-src 'none'" } } });
  const browser = await launchChromium();
  try {
    const page = await (await browser.newContext()).newPage();   // note: no bypassCSP
    await page.goto(`${srv.origin}/basic.html`);
    const r = await collectCWV(page, { simulate: false, waitAfterLoad: 500 });
    assert.ok(r.metrics.LCP?.value > 0);
    assert.ok(r.metrics.FCP?.value > 0);
    assert.ok(r.metrics.TTFB?.value >= 0);
  } finally { await browser.close(); await srv.close(); }
});
test('injection makes no network request for web-vitals', async () => {
  // same setup without CSP; record page.on('request') URLs; assert none contain 'web-vitals'
});
test('WEB_VITALS_VERSION is pinned', () => assert.equal(WEB_VITALS_VERSION, '6.2.3'));
```

- [ ] **Step 2: Run to verify failure**

Run: `cd skills/playwright-dev && npm run setup && cd ../core-web-vitals && npm run test:integration`
Expected: FAIL — CSP test times out with `web-vitals library failed to load`; version test fails `WEB_VITALS_VERSION` undefined.

- [ ] **Step 3: Implement `injectWebVitals(page)` in `collect.js`**

Read the vendored file once at module load. When `window.webVitals` is undefined, inject with `page.evaluate(source + '\n;window.webVitals = webVitals; void 0;')`: a string is evaluated as a top-level CDP `Runtime.evaluate` expression, so the IIFE's `var webVitals` becomes global and page CSP does not apply. Do **not** call `eval()` inside the page: CSP `script-src` without `'unsafe-eval'` blocks it. If the CSP test still fails, fall back to `page.context().addInitScript({ content: source })`, documenting that it only takes effect on the next navigation. Keep the existing 15 s `waitForFunction` guard, but change its error to `web-vitals failed to initialise in the page`.

- [ ] **Step 4: Run tests**

Run: `npm run test:integration && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/core-web-vitals
git commit -m "feat(cwv): vendor web-vitals 6.2.3 and inject via evaluate (CSP-proof, no CDN)"
```

---

### Task 3: Safe interactions, navigation guard, custom interactions

**Files:**
- Modify: `skills/core-web-vitals/lib/collect.js` — `simulateInteractions`, `forceMetricFlush`, `collectCWV`
- Create: `skills/core-web-vitals/test/fixtures/link-cover.html` (a single `<a href="/basic.html">` absolutely positioned covering the full viewport except a 40px footer strip), `test/fixtures/self-navigate.html` (`setTimeout(() => location.replace('/basic.html'), 800)`), `test/fixtures/button.html` (`<button id="buy">` whose click handler busy-loops 120 ms)
- Test: `skills/core-web-vitals/test/integration/interactions.test.js`

**Interfaces:**
- Consumes: `startServer`, `launchChromium` (Task 2).
- Produces: `collectCWV(page, { simulate?: boolean = true, interact?: (page) => Promise<void>, waitAfterLoad?: number = 1500, includeAttribution?: boolean = true })`. When `interact` is given it runs instead of simulation.
- Produces: `CWVResult.warnings: string[]` (always present, possibly empty).

- [ ] **Step 1: Write the failing tests**

```js
test('simulation never clicks a link', async () => {
  // goto link-cover.html; collectCWV(page, { simulate: true })
  assert.match(page.url(), /link-cover\.html$/);
  assert.ok(r.metrics.INP, 'INP still captured from a safe click or key press');
});
test('self-navigating page returns warning instead of throwing', async () => {
  // goto self-navigate.html; r = await collectCWV(page, { simulate: true, waitAfterLoad: 1500 })
  assert.ok(r.warnings.some((w) => w.includes('navigated')));
  assert.equal(typeof r.metrics, 'object');
});
test('interact callback drives INP for a specific interaction', async () => {
  // goto button.html
  const r = await collectCWV(page, { interact: (p) => p.click('#buy') });
  assert.equal(r.metrics.INP.attribution.interactionTarget, 'button#buy');
  assert.ok(r.metrics.INP.value >= 100);
});
test('warnings is an empty array on a clean run', async () => { /* basic.html */ assert.deepEqual(r.warnings, []); });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:integration -- --test-name-pattern="simulation|self-navigating|interact|warnings"`
Expected: FAIL — link test ends on `basic.html`; self-navigate throws `Execution context was destroyed`; `interact` ignored; `warnings` undefined.

- [ ] **Step 3: Implement**

- In `collectCWV`: after the wait, `await page.waitForLoadState('load', { timeout: 15000 })`, pushing warning `Page did not reach the load event within 15s; LCP may be truncated by simulated input.` on timeout. (The browser stops LCP at first input, so input must come after load.)
- Record `page.url()` immediately after `setupCollectors`. Keep a `lastSnapshot` (deep copy of `window.__cwvData`, initially `{}`), and refresh it after the wait and again just before interactions.
- Run `options.interact(page)` if provided, else `simulateInteractions(page)` when `simulate`.
- Wrap every in-page step after `setupCollectors` (wait, load-state wait, snapshots, interactions, flush, final read) in one try/catch. The self-navigating fixture leaves during the initial wait, so the guard must cover that wait too. If any step throws, or `page.url()` no longer matches the recorded URL, return `lastSnapshot`, which may be empty, and push `Page navigated to <new url> during collection; metrics are from <original url> before the navigation (INP may be missing).` Non-navigation errors are rethrown.
- `simulateInteractions`: pick the click point in-page — scan a 5×5 grid over the inner 80% of the viewport, return the first point whose `document.elementFromPoint` has no `closest('a,button,input,select,textarea,label,summary,iframe,video,[role=button],[role=link],[onclick],[contenteditable]')`; if none, skip the click. Then `Tab`, then `Shift` (keyboard interactions count toward INP; scrolling does not — remove the PageDown/PageUp steps and the "scroll triggers" comment).

- [ ] **Step 4: Run tests**

Run: `npm run test:integration && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/core-web-vitals
git commit -m "fix(cwv): safe simulated input, navigation guard, interact callback, warnings"
```

---

### Task 4: Measurement-condition presets, recorded and shown in every report

**Files:**
- Create: `skills/core-web-vitals/lib/conditions.js`
- Modify: `skills/core-web-vitals/lib/collect.js` — `collectCWV` (record conditions), `measureMultipleUrls` (use presets)
- Modify: `skills/core-web-vitals/lib/reports.js` — `printReport`, `printComparison`, `generateMarkdownReport`, `generateHtmlReport` (conditions block, lab disclaimer, warnings, unspecified copy)
- Modify: `skills/core-web-vitals/lib/cwv-collector.js` — export `createMeasuredPage`, `PRESETS`
- Test: `skills/core-web-vitals/test/unit/conditions.test.js`, `test/unit/reports-conditions.test.js`, `test/integration/conditions.test.js`

**Interfaces:**
- Produces: `PRESETS: { mobile, desktop, none }`, each `{ name, label, context: object /* Playwright newContext options */, network: { latencyMs, downloadKbps, uploadKbps } | null, cpuSlowdown: number }` with Global Constraints values. Labels: `'Mobile (Moto G Power, Slow 4G, 4× CPU)'`, `'Desktop (1350×940, 40ms RTT, 10 Mbps)'`, `'No throttling (unthrottled host machine)'`.
- Produces: `createMeasuredPage(browser, preset = 'mobile', contextOptions = {}) → Promise<{ context, page, conditions }>`. Always sets `bypassCSP: true`. Throttling via `context.newCDPSession(page)` → `Network.enable`, `Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate`.
- Produces: `Conditions = { preset: 'mobile'|'desktop'|'none'|'unspecified', label: string, method: 'devtools'|null, network, cpuSlowdown, viewport: {width,height}|null, userAgent: string|null }`.
- Produces: `collectCWV(page, { conditions?: Conditions })` → `result.conditions`. If the option is omitted, the value is `{ preset: 'unspecified', label: 'Not recorded', method: null, network: null, cpuSlowdown: null, viewport: page.viewportSize(), userAgent: null }`. Nothing is added to `warnings`: the reports render the unspecified-conditions copy from `preset`, so Task 3's `warnings is an empty array on a clean run` keeps passing.
- Produces: `measureMultipleUrls(browser, urls, { preset = 'mobile', ...collectOptions })` creates each page with `createMeasuredPage`. Error entries have the shape `{ url, error, metrics: {}, warnings: [], conditions }`, using that preset's conditions.

- [ ] **Step 1: Write the failing tests**

```js
// conditions.test.js
test('presets carry the documented values', () => {
  assert.deepEqual(PRESETS.mobile.network, { latencyMs: 150, downloadKbps: 1638.4, uploadKbps: 750 });
  assert.equal(PRESETS.mobile.cpuSlowdown, 4);
  assert.deepEqual(PRESETS.mobile.context.viewport, { width: 412, height: 823 });
  assert.equal(PRESETS.desktop.network.latencyMs, 40);
  assert.equal(PRESETS.none.network, null);
});
test('createMeasuredPage rejects non-chromium for throttled presets', async () => {
  const fake = { browserType: () => ({ name: () => 'firefox' }) };
  await assert.rejects(createMeasuredPage(fake, 'mobile'), /requires Chromium/);
});
test('unknown preset name is rejected', async () => {
  await assert.rejects(createMeasuredPage({ browserType: () => ({ name: () => 'chromium' }) }, 'tablet'), /Unknown preset "tablet"/);
});
// reports-conditions.test.js
test('markdown shows conditions and lab disclaimer', () => {
  const md = generateMarkdownReport(makeResult({ conditions: { preset: 'mobile', label: PRESETS.mobile.label, method: 'devtools' } }));
  assert.match(md, /Mobile \(Moto G Power, Slow 4G, 4× CPU\)/);
  assert.ok(md.includes("Lab data from a single run under the conditions above. Google's ranking signal uses field data (CrUX p75 over 28 days), so these values are not directly comparable."));
});
test('reports render legacy results without conditions', () => {
  const legacy = makeResult(); delete legacy.conditions; delete legacy.warnings;
  for (const out of [generateMarkdownReport(legacy), generateHtmlReport(legacy)])
    assert.ok(out.includes('Measurement conditions were not recorded'));
  assert.doesNotThrow(() => generateMarkdownReport([legacy, { url: 'https://x.test/', error: 'boom', metrics: {} }]));
});
// integration/conditions.test.js
test('mobile preset emulates device and records conditions', async () => {
  const { context, page, conditions } = await createMeasuredPage(browser, 'mobile');
  await page.goto(`${srv.origin}/basic.html`);
  assert.equal(await page.evaluate(() => innerWidth), 412);
  const r = await collectCWV(page, { conditions, simulate: false, waitAfterLoad: 500 });
  assert.equal(r.conditions.preset, 'mobile');
  assert.equal(r.conditions.method, 'devtools');
  await context.close();
});
test('mobile throttling slows TTFB versus none', async () => {
  // measure basic.html with 'none' and 'mobile'; assert mobile TTFB >= none TTFB + 100 (150ms RTT)
});
test('measureMultipleUrls keeps going and records conditions on error entries', async () => {
  const rs = await measureMultipleUrls(browser, ['http://127.0.0.1:9/unreachable', `${srv.origin}/basic.html`], { preset: 'mobile', simulate: false, waitAfterLoad: 500 });
  assert.ok(rs[0].error);
  assert.equal(rs[0].conditions.preset, 'mobile');
  assert.ok(rs[1].metrics.LCP);
});
```

`makeResult` (Task 1) is extended here to include `conditions` (unspecified) and `warnings: []` by default.

- [ ] **Step 2: Run to verify failure**

Run: `npm test && npm run test:integration`
Expected: FAIL — `PRESETS`/`createMeasuredPage` not exported; reports lack the conditions copy.

- [ ] **Step 3: Implement `lib/conditions.js`, wire `collectCWV`/`measureMultipleUrls`, render in reports**

Reports: a "Conditions" line (label + method) at the top of each page section, the lab disclaimer directly under it, the unspecified copy when `preset` is `'unspecified'` or `conditions` is missing, and a "Warnings" list when `warnings` is non-empty. `printComparison` prints the preset label once in its header when all results share it, else per URL.

- [ ] **Step 4: Run tests**

Run: `npm test && npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/core-web-vitals
git commit -m "feat(cwv): measurement-condition presets recorded and labelled in reports"
```

---

### Task 5: LCP and INP phase breakdowns with phase-keyed recommendations

**Files:**
- Create: `skills/core-web-vitals/lib/breakdown.js`
- Modify: `skills/core-web-vitals/lib/collect.js` — attach `breakdown` to LCP and INP metrics in `collectCWV`
- Modify: `skills/core-web-vitals/lib/reports.js` — render breakdowns in all three formats; LCP/INP recommendations from `PHASE_RECOMMENDATIONS`; remove the `LCP`/`INP` entries from `RECOMMENDATIONS`
- Modify: `skills/core-web-vitals/lib/cwv-collector.js` — export `getBreakdown`
- Test: `skills/core-web-vitals/test/unit/breakdown.test.js`, `test/unit/reports-breakdown.test.js`

**Interfaces:**
- Produces: `getBreakdown(name: 'LCP'|'INP', attribution: object|null) → { phases: Array<{ key, label, ms, share }>, dominant: string } | null`.
  - LCP keys/labels, in order: `timeToFirstByte` "Time to first byte", `resourceLoadDelay` "Resource load delay", `resourceLoadDuration` "Resource load duration", `elementRenderDelay` "Element render delay".
  - INP: `inputDelay` "Input delay", `processingDuration` "Processing duration", `presentationDelay` "Presentation delay".
  - Missing keys are omitted; negative values clamp to 0; `share = ms / sum` (0 when sum is 0); `dominant` = key with largest `ms`; returns `null` for other metric names, null attribution, or no known keys.
- Produces: `metric.breakdown` on LCP and INP in `CWVResult` (null when unavailable).
- Produces: `PHASE_RECOMMENDATIONS: Record<phaseKey, string[]>` in `reports.js` — 2–3 specific items per phase, written fresh (e.g. `resourceLoadDelay`: put the LCP image in the initial HTML as an `<img>` with `fetchpriority="high"`; preload only if it is otherwise discovered late; `processingDuration`: break up the event handler and yield with `scheduler.yield()`). Shown only when the metric is not `good` and only for phases with `share >= 0.1`, dominant first.

- [ ] **Step 1: Write the failing tests**

```js
test('LCP breakdown orders phases and picks dominant', () => {
  const b = getBreakdown('LCP', { timeToFirstByte: 300, resourceLoadDelay: 200, resourceLoadDuration: 900, elementRenderDelay: 100 });
  assert.deepEqual(b.phases.map((p) => p.key), ['timeToFirstByte','resourceLoadDelay','resourceLoadDuration','elementRenderDelay']);
  assert.equal(b.dominant, 'resourceLoadDuration');
  assert.equal(b.phases[2].share, 0.6);
});
test('getBreakdown tolerates missing fields', () => {
  const b = getBreakdown('LCP', { timeToFirstByte: 500, elementRenderDelay: 50 });   // text LCP, no resource
  assert.deepEqual(b.phases.map((p) => p.key), ['timeToFirstByte', 'elementRenderDelay']);
  assert.equal(getBreakdown('LCP', null), null);
  assert.equal(getBreakdown('LCP', { target: 'h1' }), null);
  assert.equal(getBreakdown('CLS', { largestShiftValue: 0.2 }), null);
});
test('negative phases clamp to zero', () => {
  assert.equal(getBreakdown('INP', { inputDelay: -4, processingDuration: 80, presentationDelay: 20 }).phases[0].ms, 0);
});
test('markdown shows INP breakdown and phase-keyed advice for a poor INP', () => {
  const md = generateMarkdownReport(makeResult({ metrics: { INP: { value: 600, attribution: { inputDelay: 20, processingDuration: 500, presentationDelay: 80 } } } }));
  assert.match(md, /Processing duration \| 500ms \| 83%/);
  assert.ok(md.includes('scheduler.yield()'));
});
test('no phase advice for a good LCP', () => {
  assert.ok(!generateMarkdownReport(makeResult()).includes('#### Recommendations'));
});
```

(`makeResult` recomputes `breakdown` with `getBreakdown` when attribution is overridden.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `getBreakdown` is not a function.

- [ ] **Step 3: Implement `breakdown.js`, attach in `collectCWV`, render breakdown tables (`| Phase | Time | Share |`) in markdown, a stacked bar in HTML, indented lines in `printReport`**

- [ ] **Step 4: Run tests**

Run: `npm test && npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/core-web-vitals
git commit -m "feat(cwv): LCP/INP phase breakdowns with phase-keyed recommendations"
```

---

### Task 6: Slim `SKILL.md`, evidence rules, and progressive-disclosure references

**Files:**
- Modify: `skills/core-web-vitals/SKILL.md` (rewrite)
- Create: `skills/core-web-vitals/references/patterns.md` — Patterns 1–8 updated to `createMeasuredPage`; Pattern 6 rewritten to use `collectCWV(page, { interact })` (no duplicate requires); averaged-runs pattern reports median alongside mean
- Create: `skills/core-web-vitals/references/conditions.md` — presets, why mobile is default, DevTools-applied vs Lighthouse-simulated throttling, headless caveats (no `--disable-gpu` advice), and a short "Lab vs field" section: field data is p75 of real visits over 28 days, where the user can find it (PageSpeed Insights, Search Console, their RUM), and why a lab number is never subtracted from a field number
- Create: `skills/core-web-vitals/references/lcp.md`, `references/inp.md`, `references/cls.md` — diagnosis organised by phase (LCP/INP) and by shift source vs shifted element (CLS); our own wording; footer `Approach informed by Addy Osmani's web-quality-skills (MIT) and web.dev.`
- Create: `skills/core-web-vitals/references/troubleshooting.md` — moved and corrected troubleshooting section
- Modify: `README.md:165` — skill row text
- Test: `skills/core-web-vitals/test/unit/docs.test.js`

**Interfaces:**
- Consumes: every name exported in Tasks 2–5 (`createMeasuredPage`, `PRESETS`, `getBreakdown`, `WEB_VITALS_VERSION`, `collectCWV` options `interact`, `conditions`).

`SKILL.md` contents, in order: frontmatter (description adds "measure under mobile/desktop conditions, diagnose LCP/INP phases"); path-resolution note; **Evidence & Reporting Rules** (below, verbatim); workflow (write script to `/tmp/cwv-check-*.js`, run via `playwright-dev/run.js`); Pattern 1 (snapshot with `createMeasuredPage(browser, 'mobile')`) and Pattern 2 (assertions) only; API summary table; "When to read which reference" table mapping situations to the six reference files.

Evidence & Reporting Rules (exact copy):

```markdown
1. Every number this skill produces is **lab** data. Call it that. Field data comes only from sources the user brings (PageSpeed Insights, Search Console, their RUM); never present one as the other.
2. Report the preset with every lab result. If conditions are "unspecified", say so and rerun with `createMeasuredPage`.
3. Do not say a page "passes Core Web Vitals" or affects ranking from lab data. Only field p75 supports that.
4. After a fix, re-measure in the lab under the same preset. Do not claim a field improvement; field data needs ~28 days of new visits.
5. Lead with the dominant phase and its milliseconds; name the element, resource or interaction. Do not recommend work on a phase under 10% of the metric.
6. Single runs vary ±10–20%. Use at least 3 runs (median) before calling a regression or comparing deploys.
7. If every metric is good, say so plainly and stop.
```

- [ ] **Step 1: Write the failing doc checks**

```js
test('SKILL.md stays under 10,000 bytes', () => assert.ok(fs.statSync(SKILL).size <= 10000));
test('SKILL.md links only to reference files that exist', () => {
  for (const [, rel] of read(SKILL).matchAll(/\]\((references\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(DIR, rel)), rel);
});
test('docs contain no stale claims', () => {
  const all = [SKILL, ...glob('references/*.md')].map(read).join('\n');
  assert.ok(!/unpkg\.com/.test(all), 'no CDN references');
  assert.ok(!/web-vitals@5/.test(all));
  assert.ok(!/scroll[^\n]*trigger[^\n]*INP/i.test(all), 'scrolling does not count toward INP');
  assert.ok(!/--disable-gpu/.test(all));
});
test('evidence rules are present verbatim', () => assert.ok(read(SKILL).includes('Only field p75 supports that.')));
test('every exported name used in docs exists', () => {
  const api = require('../../lib/cwv-collector');
  for (const n of ['createMeasuredPage','getBreakdown','PRESETS']) assert.ok(n in api, n);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --test-name-pattern="SKILL|docs|evidence|exported"`
Expected: FAIL — size ~25,700 bytes; `unpkg.com` and the scroll claim present.

- [ ] **Step 3: Write `SKILL.md` and the six reference files; update README row**

- [ ] **Step 4: Run all tests, then smoke-run the two inline patterns**

Run: `npm test && npm run test:integration`
Expected: PASS.

Run: start the fixture server (`node -e "require('./test/helpers/server').startServer().then(s=>console.log(s.origin))"`), set Pattern 1's `TARGET_URL` to `<origin>/basic.html`, save as `/tmp/cwv-check-snapshot.js`, then `cd ../playwright-dev && HEADLESS=true node run.js /tmp/cwv-check-snapshot.js`.
Expected: report shows `Mobile (Moto G Power, Slow 4G, 4× CPU)`, the lab disclaimer, an LCP value with a breakdown, and no warnings. Repeat for Pattern 2 and expect `✅ All CWV assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add skills/core-web-vitals README.md
git commit -m "docs(cwv): slim SKILL.md with evidence rules; move patterns and diagnosis to references"
```
