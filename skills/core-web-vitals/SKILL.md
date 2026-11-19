---
name: core-web-vitals
description: Measure and assert Core Web Vitals (LCP, INP, CLS) in Playwright scripts, measure under mobile/desktop conditions, and diagnose LCP/INP phases. Use when the user wants lab performance metrics, CWV threshold checks, a phase breakdown of a slow LCP or INP, or CWV measurement added to existing Playwright checks. Pairs with the playwright-dev skill.
user_invocable: true
---

**Path resolution:** this skill can be installed anywhere. Work out its directory from where you loaded this file and substitute it for `$CWV_SKILL_DIR` below. The `playwright-dev` skill runs the scripts; substitute its directory for `$PW_SKILL_DIR` (set it up once with `cd $PW_SKILL_DIR && npm run setup`).

# Core Web Vitals

Measures LCP, INP and CLS (plus FCP and TTFB) inside Playwright scripts, records the conditions it measured under, and breaks LCP and INP into phases. The `web-vitals` 6.2.3 library ships in `lib/vendor/` and is injected from disk: no CDN or network access is needed, and strict-CSP pages work.

## Evidence & Reporting Rules

1. Every number this skill produces is **lab** data. Call it that. Field data comes only from sources the user brings (PageSpeed Insights, Search Console, their RUM); never present one as the other.
2. Report the preset with every lab result. If conditions are "unspecified", say so and rerun with `createMeasuredPage`.
3. Do not say a page "passes Core Web Vitals" or affects ranking from lab data. Only field p75 supports that.
4. After a fix, re-measure in the lab under the same preset. Do not claim a field improvement; field data needs ~28 days of new visits.
5. Lead with the dominant phase and its milliseconds; name the element, resource or interaction. Do not recommend work on a phase under 10% of the metric.
6. Single runs vary ±10–20%. Use at least 3 runs (median) before calling a regression or comparing deploys.
7. If every metric is good, say so plainly and stop.

## Workflow

1. Write the script to `/tmp/cwv-check-*.js`.
2. Create the page with `createMeasuredPage(browser, 'mobile')`, then `page.goto(url, { waitUntil: 'domcontentloaded' })`, then `collectCWV(page)`.
3. Run it: `cd $PW_SKILL_DIR && node run.js /tmp/cwv-check-*.js`. Headless mode is set by the `headless` option in the script's `chromium.launch()`; `HEADLESS=true` has no effect.
4. Report using the rules above: preset, dominant phase, element or resource.

Presets: `mobile` (default, Moto G Power, Slow 4G, 4x CPU), `desktop` (1350x940, 40 ms RTT, 10 Mbps), `none` (no emulation). The throttled presets need Chromium.

## Pattern 1: Snapshot

```javascript
// /tmp/cwv-check-snapshot.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const { page, conditions } = await createMeasuredPage(browser, 'mobile');
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await collectCWV(page, { conditions });
    printReport(result);
  } finally {
    await browser.close();
  }
})();
```

## Pattern 2: Assertions

```javascript
// /tmp/cwv-check-assert.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, printReport, assertCWV } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const { page, conditions } = await createMeasuredPage(browser, 'mobile');
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await collectCWV(page, { conditions });
    printReport(result);
    assertCWV(result, { LCP: 2500, INP: 200, CLS: 0.1 }); // throws on a miss
    console.log('✅ All CWV assertions passed');
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
```

Patterns 3 to 8 (multi-URL, existing scripts, targeted interaction, repeated runs, saved reports) are in [references/patterns.md](references/patterns.md).

## API summary

| Name | Purpose |
|---|---|
| `createMeasuredPage(browser, preset='mobile', contextOptions={})` | Returns `{ context, page, conditions }`; applies emulation and CDP throttling; sets `bypassCSP` |
| `collectCWV(page, opts)` | Returns `{ url, metrics, warnings, conditions, collectedAt, collectionDurationMs }` |
| `collectCWV` options | `simulate=true`, `interact(page)` (replaces simulated input), `waitAfterLoad=1500`, `includeAttribution=true`, `conditions` |
| `metrics.LCP` / `metrics.INP` | Carry `breakdown: { phases: [{ key, label, ms, share }], dominant } \| null`, kept even with `includeAttribution: false` |
| `getBreakdown(name, attribution)` | Builds a breakdown from raw attribution |
| `measureMultipleUrls(browser, urls, { preset='mobile', ...collectOpts })` | Mobile default, so Chromium only; other browsers pass `preset: 'none'`. Failed entries are `{ url, error, metrics: {}, warnings: [], conditions }` |
| `assertCWV(result, { LCP, INP, CLS })` | Throws when a metric exceeds its limit |
| `printReport`, `printComparison` | Console output |
| `generateMarkdownReport`, `generateHtmlReport`, `saveReport(results, path, { title })` | File reports; `.html` or `.md` by extension |
| `PRESETS`, `WEB_VITALS_VERSION`, `THRESHOLDS`, `getRating`, `formatValue` | Constants and helpers |

Behaviour to know:
- Simulated input avoids links and other interactive elements and uses Tab and Shift. Scrolling does not count toward INP.
- If the page navigates away during collection, `warnings` says so and the pre-navigation metrics are kept. Same-document URL changes (`pushState`) are not navigation.
- Thresholds (good / poor): LCP 2500/4000 ms, INP 200/500 ms, CLS 0.1/0.25, FCP 1800/3000 ms, TTFB 800/1800 ms.

## When to read which reference

| Situation | Read |
|---|---|
| Multi-URL, existing script, a specific click, repeated runs, saved reports | [references/patterns.md](references/patterns.md) |
| Choosing or explaining a preset; throttling method; headless; lab vs field; localhost results look too fast | [references/conditions.md](references/conditions.md) |
| LCP is above 2500 ms, or the dominant LCP phase needs a fix | [references/lcp.md](references/lcp.md) |
| INP is above 200 ms, INP is missing, or the dominant INP phase needs a fix | [references/inp.md](references/inp.md) |
| CLS is above 0.1 | [references/cls.md](references/cls.md) |
| A metric is missing or zero, a warning appears, runs disagree, or auth-gated pages | [references/troubleshooting.md](references/troubleshooting.md) |
