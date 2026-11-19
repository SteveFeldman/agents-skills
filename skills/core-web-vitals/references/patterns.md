# Patterns 3 to 8

Patterns 1 (snapshot) and 2 (assertions) are in `SKILL.md`. Every pattern below uses `createMeasuredPage` so the preset is recorded. Replace `$CWV_SKILL_DIR` with the skill directory.

## Pattern 3: Multi-URL comparison

`measureMultipleUrls` creates a fresh measured page per URL. It defaults to `preset: 'mobile'`, which requires Chromium; with Firefox or WebKit pass `preset: 'none'`.

```javascript
// /tmp/cwv-check-multi.js
const { chromium } = require('playwright');
const { measureMultipleUrls, printComparison } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const URLS = ['https://example.com/', 'https://example.com/products', 'https://example.com/about'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const results = await measureMultipleUrls(browser, URLS, { preset: 'mobile' });
    printComparison(results);
    for (const r of results) if (r.error) console.log('Failed:', r.url, r.error);
  } finally {
    await browser.close();
  }
})();
```

## Pattern 4: Preset comparison for one URL

Run the same page under `mobile` and `desktop` to see how much of a problem is device-bound.

```javascript
// /tmp/cwv-check-presets.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const preset of ['mobile', 'desktop']) {
      const { context, page, conditions } = await createMeasuredPage(browser, preset);
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      printReport(await collectCWV(page, { conditions }));
      await context.close();
    }
  } finally {
    await browser.close();
  }
})();
```

## Pattern 5: Add CWV to an existing Playwright script

Create the page with `createMeasuredPage`, keep your own checks, then collect at the end. Pass `contextOptions` (for example `storageState`) as the third argument.

```javascript
// /tmp/cwv-check-augmented.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const { page, conditions } = await createMeasuredPage(browser, 'mobile');
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // your existing checks
    console.log('Page title:', await page.title());

    printReport(await collectCWV(page, { conditions }));
  } finally {
    await browser.close();
  }
})();
```

## Pattern 6: INP for a specific interaction

`interact` replaces the simulated input. The collector installs its observers first, runs your function, then flushes and reads.

```javascript
// /tmp/cwv-check-inp-targeted.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, printReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com/product/12345';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const { page, conditions } = await createMeasuredPage(browser, 'mobile');
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await collectCWV(page, {
      conditions,
      interact: (p) => p.getByRole('button', { name: /add to cart/i }).click(),
    });
    printReport(result);
  } finally {
    await browser.close();
  }
})();
```

For a multi-step journey (search, open a product, add to cart), put all the steps inside `interact`. Navigations inside a journey produce a warning and keep the pre-navigation metrics, so measure one page's interactions per run.

## Pattern 7: Repeated runs (median and mean)

Single runs vary. Report the median; show the mean to expose outliers.

```javascript
// /tmp/cwv-check-repeated.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, THRESHOLDS } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';
const RUNS = 5;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const runs = [];
  let label = '';
  try {
    for (let i = 0; i < RUNS; i++) {
      const { context, page, conditions } = await createMeasuredPage(browser, 'mobile');
      label = conditions.label;
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      runs.push((await collectCWV(page, { conditions })).metrics);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`Lab data, ${RUNS} runs, ${label}`);
  for (const name of ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']) {
    const values = runs.map((r) => r[name] && r[name].value).filter((v) => v != null);
    if (!values.length) { console.log(`  ${name}: not captured`); continue; }
    const t = THRESHOLDS[name];
    const fmt = (v) => (t.unit === 'ms' ? `${Math.round(v)}ms` : v.toFixed(4));
    const med = median(values);
    const rating = med <= t.good ? 'good' : med <= t.poor ? 'needs improvement' : 'poor';
    console.log(`  ${name}: median ${fmt(med)} (${rating}), mean ${fmt(mean(values))}, ${values.length}/${RUNS} runs captured`);
  }
})();
```

## Pattern 8: Saved HTML or Markdown report

Reports include the conditions line, the lab disclaimer and, for LCP and INP, the phase breakdown (also when `includeAttribution: false`).

```javascript
// /tmp/cwv-check-report.js
const { chromium } = require('playwright');
const { createMeasuredPage, collectCWV, measureMultipleUrls, saveReport } = require('$CWV_SKILL_DIR/lib/cwv-collector');

const TARGET_URL = 'https://example.com';
const URLS = ['https://example.com/', 'https://example.com/products'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, conditions } = await createMeasuredPage(browser, 'mobile');
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await collectCWV(page, { conditions });
    saveReport(result, '/tmp/cwv-report.html', { title: 'Example: CWV lab report' });
    saveReport(result, '/tmp/cwv-report.md');

    // One report covering several pages
    const results = await measureMultipleUrls(browser, URLS, { preset: 'mobile' });
    saveReport(results, '/tmp/cwv-full-report.html', { title: 'Site audit (lab)' });
  } finally {
    await browser.close();
  }
})();
```
