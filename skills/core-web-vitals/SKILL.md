---
name: core-web-vitals
description: Measure and assert Core Web Vitals (LCP, INP, CLS) in Playwright scripts. Use when the user wants to capture performance metrics, validate CWV thresholds, audit pages for Google ranking signals, or add CWV measurement to existing Playwright checks. Pairs with the playwright-dev skill.
user_invocable: true
---

**IMPORTANT — Path Resolution:**
This skill can be installed in different locations. Before executing commands, determine the skill directory based on where you loaded this SKILL.md file, and use that path. Replace `$CWV_SKILL_DIR` with the actual path (e.g., `~/.copilot/skills/core-web-vitals`).

The `playwright-dev` skill is required to run scripts. Replace `$PW_SKILL_DIR` with its path (e.g., `~/.copilot/skills/playwright-dev`).

# Core Web Vitals Skill

Measure **LCP**, **INP**, and **CLS** — the three Core Web Vitals that Google uses as ranking signals — plus supporting metrics FCP and TTFB, directly inside Playwright scripts.

## What Are Core Web Vitals?

| Metric | What It Measures | Good | Needs Improvement | Poor |
|--------|-----------------|------|-------------------|------|
| **LCP** — Largest Contentful Paint | Loading performance: when the largest visible element finishes rendering | ≤ 2,500ms | ≤ 4,000ms | > 4,000ms |
| **INP** — Interaction to Next Paint | Responsiveness: worst-case delay from any user interaction to next paint | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** — Cumulative Layout Shift | Visual stability: total unexpected layout shift during page lifetime | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **FCP** — First Contentful Paint | Time until first text/image pixel is painted | ≤ 1,800ms | ≤ 3,000ms | > 3,000ms |
| **TTFB** — Time to First Byte | Server response time | ≤ 800ms | ≤ 1,800ms | > 1,800ms |

**Why it matters:** All three Core Web Vitals directly affect Google Search rankings (Page Experience signal). INP replaced FID as a Core Web Vital in March 2024.

## How CWV Collection Works in Playwright

This skill uses the **official Google `web-vitals` library** (injected via CDN after page load). The library uses `buffered: true` for PerformanceObserver, so late injection still accurately captures all metrics.

**Special note on INP:** INP only fires after at least one user interaction (click, keyboard, scroll). Always simulate interactions or interact with the page before collecting INP. Without interactions, INP will not be reported.

**Key insight:** Metrics like LCP and CLS are only *finalized* when the page becomes hidden. This skill forces a `visibilitychange` event to flush pending metrics before reading them.

## Workflow

**CRITICAL — Follow these steps:**

1. **Write the CWV script to `/tmp`** — always use `/tmp/cwv-check-*.js`
2. **Navigate the page FIRST**, then inject CWV collection
3. **Execute via playwright-dev's `run.js`:**
   ```bash
   cd $PW_SKILL_DIR && node run.js /tmp/cwv-check-*.js
   ```
4. **Simulate interactions** for INP (or note to user that INP requires real interactions)

## Setup (First Time)

Ensure playwright-dev is set up:
```bash
cd $PW_SKILL_DIR && npm run setup
```

No additional install needed — this skill loads the web-vitals library from CDN at runtime.

---

## Core Patterns

### Pattern 1 — Quick CWV Snapshot

Fastest way to measure CWV for any URL. Uses the `cwv-collector` library.

```javascript
// /tmp/cwv-check-snapshot.js
const { chromium } = require('playwright');
const { collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    // Navigate and wait for page to fully load
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle').catch(() => {}); // best-effort

    // Collect all CWV metrics (simulate: true handles INP interactions)
    const result = await collectCWV(page, { simulate: true });

    // Print formatted report
    printReport(result);

  } finally {
    await browser.close();
  }
})();
```

Run it:
```bash
cd $PW_SKILL_DIR && node run.js /tmp/cwv-check-snapshot.js
```

---

### Pattern 2 — CWV with Assertions (Test Mode)

Use in automated tests to fail when metrics exceed thresholds.

```javascript
// /tmp/cwv-check-assert.js
const { chromium } = require('playwright');
const { collectCWV, printReport, assertCWV } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

// Custom thresholds — tighten or loosen per your requirements
const THRESHOLDS = {
  LCP:  2500,   // ms — Google "good" threshold
  INP:  200,    // ms — Google "good" threshold
  CLS:  0.1,    // score — Google "good" threshold
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const result = await collectCWV(page, { simulate: true });
    printReport(result);

    // Throws if any metric exceeds threshold — integrates with CI
    assertCWV(result, THRESHOLDS);
    console.log('✅ All CWV assertions passed');

  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
```

---

### Pattern 3 — Multi-URL Comparison

Compare CWV across multiple pages in one run (useful for PDP, PLP, homepage, etc.).

```javascript
// /tmp/cwv-check-multi.js
const { chromium } = require('playwright');
const { measureMultipleUrls, printComparison } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const URLS = [
  'https://example.com/',
  'https://example.com/products',
  'https://example.com/about',
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    const results = await measureMultipleUrls(browser, URLS, { simulate: true });
    printComparison(results);
  } finally {
    await browser.close();
  }
})();
```

---

### Pattern 4 — Inline (no library import)

When you need a self-contained script without requiring `$CWV_SKILL_DIR`:

```javascript
// /tmp/cwv-check-inline.js
const { chromium } = require('playwright');

const TARGET_URL  = 'https://example.com';
const WEB_VITALS_CDN = 'https://unpkg.com/web-vitals@5/dist/web-vitals.attribution.iife.js';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page    = await (await browser.newContext()).newPage();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Inject web-vitals library (buffered observer — works after page load)
  await page.addScriptTag({ url: WEB_VITALS_CDN });
  await page.waitForFunction(() => typeof window.webVitals !== 'undefined', { timeout: 15000 });

  // Set up collectors — results accumulate in window.__cwvData
  await page.evaluate(() => {
    window.__cwvData = {};
    const report = (m) => {
      window.__cwvData[m.name] = { value: m.value, rating: m.rating };
    };
    window.webVitals.onLCP(report, { reportAllChanges: true });
    window.webVitals.onCLS(report, { reportAllChanges: true });
    window.webVitals.onINP(report, { reportAllChanges: true });
    window.webVitals.onFCP(report);
    window.webVitals.onTTFB(report);
  });

  // Wait for initial paint metrics
  await page.waitForTimeout(1500);

  // Simulate interactions to trigger INP
  const { w, h } = await page.evaluate(() => ({
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  }));
  await page.mouse.click(Math.floor(w / 2), Math.floor(h / 2));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);

  // Force metrics to flush (simulate page-hide)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);

  // Read and display results
  const data = await page.evaluate(() => window.__cwvData);
  console.log('\nCore Web Vitals Results:');
  console.log('  LCP:', data.LCP  ? `${Math.round(data.LCP.value)}ms  [${data.LCP.rating}]`  : 'not captured');
  console.log('  INP:', data.INP  ? `${Math.round(data.INP.value)}ms  [${data.INP.rating}]`  : 'not captured');
  console.log('  CLS:', data.CLS  ? `${data.CLS.value.toFixed(4)}  [${data.CLS.rating}]`     : 'not captured');
  console.log('  FCP:', data.FCP  ? `${Math.round(data.FCP.value)}ms  [${data.FCP.rating}]`  : 'not captured');
  console.log('  TTFB:', data.TTFB ? `${Math.round(data.TTFB.value)}ms [${data.TTFB.rating}]` : 'not captured');

  await browser.close();
})();
```

---

### Pattern 5 — Add CWV to an Existing Playwright Script

Augment any existing Playwright check with CWV measurement.

```javascript
// /tmp/cwv-check-augmented.js
const { chromium } = require('playwright');
const helpers = require('./lib/helpers');                               // playwright-dev helpers
const { collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser  = await chromium.launch({ headless: false });
  const context  = await helpers.createContext(browser);
  const page     = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await helpers.dismissOverlays(page);

  // --- your existing checks ---
  const title = await page.title();
  console.log('Page title:', title);

  // --- add CWV on top ---
  const cwvResult = await collectCWV(page, { simulate: true });
  printReport(cwvResult);

  await helpers.takeScreenshot(page, 'page-with-cwv');
  await browser.close();
})();
```

---

### Pattern 6 — CWV on Specific User Interactions (Manual INP)

When you need INP from a *specific* interaction (e.g., add-to-cart click, menu open):

```javascript
// /tmp/cwv-check-inp-targeted.js
const { chromium } = require('playwright');
const { collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com/product/12345';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page    = await (await browser.newContext()).newPage();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Inject CWV collectors BEFORE the key interaction
  // (simulate: false — we'll do the interaction manually)
  const { chromium: _, ...cwvLib } = require('$CWV_SKILL_DIR/lib/cwv-collector');
  const { collectCWV: collect, injectWebVitals, setupCollectors } =
    require('$CWV_SKILL_DIR/lib/cwv-collector');

  const { injectWebVitals: inject } = require('$CWV_SKILL_DIR/lib/cwv-collector');

  // --- manually set up before the interaction ---
  const { chromium: _c, ...lib } = require('playwright');
  const cwv = require('$CWV_SKILL_DIR/lib/cwv-collector');

  // Step 1: Inject library
  await page.addScriptTag({ url: cwv.WEB_VITALS_CDN });
  await page.waitForFunction(() => typeof window.webVitals !== 'undefined', { timeout: 15000 });
  await page.evaluate(() => {
    window.__cwvData = {};
    const r = (m) => { window.__cwvData[m.name] = { value: m.value, rating: m.rating }; };
    window.webVitals.onLCP(r, { reportAllChanges: true });
    window.webVitals.onCLS(r, { reportAllChanges: true });
    window.webVitals.onINP(r, { reportAllChanges: true });
    window.webVitals.onFCP(r);
    window.webVitals.onTTFB(r);
  });

  await page.waitForTimeout(1000);

  // Step 2: Perform YOUR specific interaction
  console.log('Clicking Add to Cart...');
  await page.getByRole('button', { name: /add to cart/i }).click();
  await page.waitForTimeout(500); // wait for next paint

  // Step 3: Force flush and collect
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);

  const data = await page.evaluate(() => window.__cwvData);
  console.log('\nINP after Add-to-Cart:', data.INP ? `${Math.round(data.INP.value)}ms [${data.INP.rating}]` : 'not captured');
  console.log('LCP:', data.LCP ? `${Math.round(data.LCP.value)}ms [${data.LCP.rating}]` : 'not captured');
  console.log('CLS:', data.CLS ? `${data.CLS.value.toFixed(4)} [${data.CLS.rating}]` : 'not captured');

  await browser.close();
})();
```

---

### Pattern 7 — Repeat Measurements for Stability

CWV values can vary run-to-run (especially on localhost). Run multiple times and average:

```javascript
// /tmp/cwv-check-averaged.js
const { chromium } = require('playwright');
const { collectCWV, printReport, THRESHOLDS } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';
const RUNS       = 3;

(async () => {
  const browser  = await chromium.launch({ headless: true });
  const allRuns  = [];

  for (let i = 0; i < RUNS; i++) {
    console.log(`\nRun ${i + 1}/${RUNS}...`);
    const context = await browser.newContext();
    const page    = await context.newPage();
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await collectCWV(page, { simulate: true });
    allRuns.push(result.metrics);
    await context.close();
  }

  // Average each metric
  const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
  console.log('\n══════════════════════════════');
  console.log(`  Averaged over ${RUNS} runs`);
  console.log('══════════════════════════════');
  for (const name of METRICS) {
    const values = allRuns.map((r) => r[name]?.value).filter((v) => v != null);
    if (values.length === 0) { console.log(`  ${name}: not captured`); continue; }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const t = THRESHOLDS[name];
    const unit = t?.unit === 'ms' ? `${Math.round(avg)}ms` : avg.toFixed(4);
    const rating = avg <= t.good ? '✅ Good' : avg <= t.poor ? '⚠️  Needs Improvement' : '🔴 Poor';
    console.log(`  ${rating}  ${name}: ${unit}  (${values.length} samples)`);
  }
  console.log('══════════════════════════════\n');

  await browser.close();
})();
```

---

### Pattern 8 — Save HTML or Markdown Report

Generate a shareable file report — HTML with visual metric cards and remediation advice, or Markdown for docs/PRs.

```javascript
// /tmp/cwv-check-report.js
const { chromium } = require('playwright');
const { collectCWV, printReport, saveReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const result = await collectCWV(page, { simulate: true });

  // Print to console
  printReport(result);

  // Save HTML report (visual, shareable)
  saveReport(result, '/tmp/cwv-report.html', { title: 'My Site — CWV Report' });

  // Save Markdown report (for PRs, Confluence, docs)
  saveReport(result, '/tmp/cwv-report.md', { title: 'My Site — CWV Report' });

  await browser.close();
})();
```

#### Multi-URL HTML report

```javascript
// /tmp/cwv-check-report-multi.js
const { chromium } = require('playwright');
const { measureMultipleUrls, saveReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const URLS = [
  'https://example.com/',
  'https://example.com/products',
  'https://example.com/checkout',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = await measureMultipleUrls(browser, URLS, { simulate: true });

  // Single report covering all pages with summary table + per-page detail + recommendations
  saveReport(results, '/tmp/cwv-full-report.html', { title: 'Site-wide CWV Audit' });
  saveReport(results, '/tmp/cwv-full-report.md');

  await browser.close();
})();
```

**What the HTML report includes:**
- ✅ Color-coded metric cards (green / amber / red) for all 5 metrics
- 🔍 Attribution detail — which element caused LCP, which shifted for CLS, which interaction caused INP
- 💡 Actionable recommendations per failing metric
- 📊 Summary comparison table for multi-URL runs
- 🔗 Self-contained single file — open directly in any browser, shareable by email or Slack

---



INP (Interaction to Next Paint) is the trickiest CWV to capture in automated tests because it **requires real user interaction**.

### Why INP is hard to capture:
- INP only fires after at least one input event (click, keyboard, pointer)
- INP measures the **worst** interaction delay across the full session
- Automated clicks in headless Chromium may not accurately reflect real-world responsiveness

### Best practices for INP in Playwright:
1. **Use non-headless mode** (`headless: false`) for more realistic timing
2. **Click meaningful elements** — buttons, links, form inputs — not just the page center
3. **Use `slowMo`** to simulate realistic typing speed
4. **Combine with real navigation flows** — measure INP during an actual user journey (search → PDP → add to cart)
5. **For regression detection** — the absolute INP value matters less than catching regressions between deploys

```javascript
// Realistic INP measurement during a user flow
const browser = await chromium.launch({ headless: false, slowMo: 100 });
const page    = await (await browser.newContext()).newPage();

// Inject CWV before the flow starts
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ url: 'https://unpkg.com/web-vitals@5/dist/web-vitals.attribution.iife.js' });
await page.waitForFunction(() => typeof window.webVitals !== 'undefined');
await page.evaluate(() => {
  window.__cwvData = {};
  window.webVitals.onINP((m) => { window.__cwvData.INP = m; }, { reportAllChanges: true });
  window.webVitals.onLCP((m) => { window.__cwvData.LCP = m; }, { reportAllChanges: true });
  window.webVitals.onCLS((m) => { window.__cwvData.CLS = m; }, { reportAllChanges: true });
});

// Perform real user flow (this generates genuine INP events)
await page.getByRole('searchbox').click();
await page.keyboard.type('red shoes');
await page.keyboard.press('Enter');
await page.waitForLoadState('domcontentloaded');
await page.getByRole('link', { name: /product/i }).first().click();
await page.waitForLoadState('domcontentloaded');
await page.getByRole('button', { name: /add to cart/i }).click();
await page.waitForTimeout(500);

// Flush and read
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(400);

const metrics = await page.evaluate(() => window.__cwvData);
console.log('INP:', metrics.INP ? `${Math.round(metrics.INP.value)}ms [${metrics.INP.rating}]` : 'not captured');
```

---

## Headless vs. Visible Browser

| Mode | When to use |
|------|------------|
| `headless: false` (default) | Local debugging, realistic INP, visual verification |
| `headless: true` | CI/CD, batch runs, automated regression checks |

> **Note:** Headless mode can produce artificially lower/higher LCP and INP values because Chromium skips some paint work when no display is attached. For the most accurate CWV numbers, use `headless: false` or use `--disable-gpu` flags.

Run headless via playwright-dev:
```bash
cd $PW_SKILL_DIR && HEADLESS=true node run.js /tmp/cwv-check-snapshot.js
```

---

## Thresholds Reference

```javascript
const { THRESHOLDS } = require('$CWV_SKILL_DIR/lib/cwv-collector');

// THRESHOLDS object:
// {
//   LCP:  { good: 2500,  poor: 4000,  unit: 'ms', label: 'Largest Contentful Paint' },
//   INP:  { good: 200,   poor: 500,   unit: 'ms', label: 'Interaction to Next Paint' },
//   CLS:  { good: 0.1,   poor: 0.25,  unit: '',   label: 'Cumulative Layout Shift'   },
//   FCP:  { good: 1800,  poor: 3000,  unit: 'ms', label: 'First Contentful Paint'    },
//   TTFB: { good: 800,   poor: 1800,  unit: 'ms', label: 'Time to First Byte'        },
// }
```

---

## Available Helper API

```javascript
const {
  collectCWV,            // Main function: collect all CWV from a loaded page
  printReport,           // Print formatted console report
  assertCWV,             // Throw if metrics exceed thresholds (for test assertions)
  measureMultipleUrls,   // Measure CWV across multiple URLs
  printComparison,       // Print multi-URL comparison to console
  generateMarkdownReport, // Generate Markdown report string (single or multi-URL)
  generateHtmlReport,    // Generate HTML report string (visual, self-contained)
  saveReport,            // Save .html or .md report to disk (auto-detected by extension)
  THRESHOLDS,            // Google threshold constants
  WEB_VITALS_CDN,        // CDN URL for web-vitals library
  getRating,             // (name, value) → 'good' | 'needs-improvement' | 'poor'
  formatValue,           // (name, value) → formatted string with unit
} = require('$CWV_SKILL_DIR/lib/cwv-collector');
```

### `collectCWV(page, options)`

```javascript
const result = await collectCWV(page, {
  simulate: true,        // Simulate clicks/keys to trigger INP (default: true)
  waitAfterLoad: 1500,   // ms to wait after page load before collecting (default: 1500)
  includeAttribution: true, // Include attribution debug data (default: true)
});

// Returns:
// {
//   url: string,
//   metrics: {
//     LCP: { name, value, formatted, rating, ratingIcon, threshold, attribution },
//     INP: { ... },
//     CLS: { ... },
//     FCP: { ... },
//     TTFB: { ... },
//   },
//   collectedAt: ISO string,
//   collectionDurationMs: number,
// }
```

### `assertCWV(result, thresholds)`

```javascript
// Throws if any metric exceeds threshold
assertCWV(result, {
  LCP:  2500,  // ms
  INP:  200,   // ms
  CLS:  0.1,   // score
});
```

---

## Example Interactions

```
User: "Check the CWV on our homepage"

Claude: I'll navigate to your homepage and measure Core Web Vitals.
[Detects dev server at http://localhost:3001]
[Writes /tmp/cwv-check-snapshot.js]
[Runs: cd $PW_SKILL_DIR && node run.js /tmp/cwv-check-snapshot.js]
[Reports LCP: 1823ms ✅ Good, INP: 156ms ✅ Good, CLS: 0.0821 ✅ Good]
```

```
User: "Run CWV checks on staging and fail if any metric is poor"

Claude: I'll write a CWV check with assertions at Google's 'Good' thresholds.
[Writes /tmp/cwv-check-assert.js with assertCWV({ LCP: 2500, INP: 200, CLS: 0.1 })]
[Runs: cd $PW_SKILL_DIR && HEADLESS=true node run.js /tmp/cwv-check-assert.js]
[Reports or throws on failures]
```

```
User: "Compare CWV on the homepage, PDP, and search results page"

Claude: I'll run a multi-URL comparison.
[Writes /tmp/cwv-check-multi.js with all 3 URLs]
[Runs the comparison and prints a side-by-side table]
```

```
User: "What is the INP when a user clicks Add to Cart?"

Claude: I'll set up CWV collectors before the interaction and measure INP specifically
        for the Add to Cart click.
[Writes /tmp/cwv-check-inp-targeted.js]
[Navigates, sets up observers, clicks the button, flushes, reports INP]
```

---

## Troubleshooting

**`web-vitals` library fails to load:**
The CDN (unpkg.com) requires outbound network access from the browser. If blocked:
```javascript
// Fallback: download and serve locally, or use page.addScriptTag({ path: '/local/web-vitals.iife.js' })
```

**INP is not captured:**
- Ensure `simulate: true` or perform manual interactions before collecting
- INP requires at least one click/keyboard/pointer event per page

**LCP is 0 or missing:**
- Make sure the page has fully loaded (wait for `networkidle` or a key selector)
- LCP is only emitted once; if the page re-navigated after collection started, restart collectors

**Metrics differ between runs:**
- Normal: CWV values have natural variance of ±10-20%
- Use Pattern 7 (averaged measurements) for stable benchmarks
- Warm vs. cold cache affects LCP/TTFB significantly; test both if relevant

**CLS is unexpectedly high:**
- Check for images/ads without explicit dimensions
- Check for dynamically injected content above the fold
- Use `attribution.largestShiftTarget` from the report to identify the culprit element

**Cannot measure CWV on password-protected or cookie-gated pages:**
Combine with playwright-dev's auth patterns:
```javascript
const context = await browser.newContext({ storageState: '/tmp/auth-state.json' });
```

---

## Tips

- **Always navigate before injecting** — `page.goto()` first, then `collectCWV()`
- **Use `domcontentloaded`, not `networkidle`** — `networkidle` is fragile with analytics/beacons
- **Test on production-like conditions** — localhost LCP is usually misleadingly fast
- **CLS is cumulative** — measure after the full page has loaded, including lazy images
- **INP needs real flows** — for the most accurate INP, measure during actual user journeys, not just simulated clicks
- **Attribution data is your friend** — when a metric is poor, `attribution` tells you exactly which element caused it
- **Compare across deploys** — CWV's biggest value is detecting regressions between code changes
