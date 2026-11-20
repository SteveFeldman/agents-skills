'use strict';

const { THRESHOLDS, RATING_ICONS, getRating, formatValue } = require('./thresholds');

const { createMeasuredPage, presetConditions } = require('./conditions');
const { getBreakdown } = require('./breakdown');

const fs = require('node:fs');
const path = require('node:path');

const WEB_VITALS_VERSION = '6.2.3';

// Kept for compatibility; the library is vendored and no longer fetched.
const WEB_VITALS_CDN =
  `https://unpkg.com/web-vitals@${WEB_VITALS_VERSION}/dist/web-vitals.attribution.iife.js`;

const WEB_VITALS_SOURCE = fs.readFileSync(
  path.join(__dirname, 'vendor', 'web-vitals.attribution.iife.js'),
  'utf8',
);

/**
 * Inject the vendored web-vitals library into an already-loaded page.
 * The source is passed to page.evaluate() as a string, which Playwright runs
 * as a top-level CDP Runtime.evaluate expression, so page CSP does not apply
 * and no network request is made. The library uses buffered PerformanceObserver
 * so late injection still captures LCP, FCP, CLS, TTFB accurately.
 *
 * @param {import('playwright').Page} page
 */
async function injectWebVitals(page) {
  // The pinned library lives in window.__cwvWebVitals; the page's own
  // window.webVitals (if any) is never read or modified.
  const alreadyLoaded = await page.evaluate(
    () => typeof window.__cwvWebVitals !== 'undefined',
  );

  if (!alreadyLoaded) {
    await page.evaluate(
      '(function(){ ' + WEB_VITALS_SOURCE + '\n; window.__cwvWebVitals = webVitals; })(); void 0;',
    );
    await page
      .waitForFunction(() => typeof window.__cwvWebVitals !== 'undefined', {
        timeout: 15000,
      })
      .catch(() => {
        throw new Error('web-vitals failed to initialise in the page');
      });
  }
}

/**
 * Set up metric observers in the page.
 * Results accumulate in window.__cwvData.
 *
 * @param {import('playwright').Page} page
 */
async function setupCollectors(page) {
  await page.evaluate(() => {
    window.__cwvData = window.__cwvData || {};

    const report = (metric) => {
      window.__cwvData[metric.name] = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        // Deep-copy attribution to avoid proxy issues when serializing
        attribution: metric.attribution
          ? JSON.parse(JSON.stringify(metric.attribution))
          : null,
      };
    };

    // reportAllChanges: true ensures we get the latest accumulated value
    window.__cwvWebVitals.onLCP(report, { reportAllChanges: true });
    window.__cwvWebVitals.onCLS(report, { reportAllChanges: true });
    window.__cwvWebVitals.onINP(report, { reportAllChanges: true });
    window.__cwvWebVitals.onFCP(report);
    window.__cwvWebVitals.onTTFB(report);
  });
}

/**
 * Simulate user interactions to trigger INP measurement.
 * INP only records after at least one interaction. The click lands only on a
 * point with no interactive element underneath, so simulation cannot follow
 * links or submit forms; if no such point exists the click is skipped.
 * Keyboard interactions (Tab, Shift) also count toward INP; scrolling does not.
 * This is best-effort; failures are silently ignored.
 *
 * @param {import('playwright').Page} page
 */
async function simulateInteractions(page) {
  try {
    const point = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      const interactive =
        'a,button,input,select,textarea,label,summary,iframe,video,' +
        '[role=button],[role=link],[onclick],[contenteditable]';
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const x = Math.floor(w * (0.1 + 0.2 * i));
          const y = Math.floor(h * (0.1 + 0.2 * j));
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest(interactive)) return { x, y };
        }
      }
      return null;
    });

    if (point) {
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(200);
    }

    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Shift');
    await page.waitForTimeout(200);
  } catch {
    // Interaction simulation is best-effort; carry on without it
  }
}

/**
 * Force web-vitals to flush pending metrics by simulating a page-hide event.
 * LCP, CLS, and INP are only finalized when the page becomes hidden.
 *
 * @param {import('playwright').Page} page
 */
async function forceMetricFlush(page) {
  await page.evaluate(() => {
    try {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      // Restore so subsequent interactions still work
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
    } catch {
      // Some pages prevent this; metrics already captured via reportAllChanges
    }
  });
  await page.waitForTimeout(400);
}

/**
 * Collect Core Web Vitals from an already-loaded Playwright page.
 *
 * The page MUST be navigated before calling this function.
 * The function injects the web-vitals library, sets up observers,
 * optionally simulates interactions (needed for INP), then flushes
 * and returns the collected metrics.
 *
 * @param {import('playwright').Page} page  - Playwright page (already navigated)
 * @param {object}  [options]
 * @param {boolean} [options.simulate=true]        - Simulate clicks/keys to trigger INP
 * @param {(page) => Promise<void>} [options.interact] - Custom interaction; runs instead of simulation
 * @param {number}  [options.waitAfterLoad=1500]   - ms to wait after injection before collecting
 * @param {boolean} [options.includeAttribution=true] - Include raw attribution debug data. When false, raw attribution is omitted; the derived LCP/INP breakdown is kept and rendered in every report format.
 * @param {object}  [options.conditions]           - Conditions from createMeasuredPage(); recorded on the result
 *
 * @returns {Promise<CWVResult>}
 */
async function collectCWV(page, options = {}) {
  const { simulate = true, interact, waitAfterLoad = 1500, includeAttribution = true, conditions } = options;
  const started = Date.now();
  const warnings = [];

  const CONTEXT_DESTROYED = /Execution context was destroyed/;
  let earlyEmpty = false;
  try {
    await injectWebVitals(page);
    await setupCollectors(page);
  } catch (err) {
    if (!CONTEXT_DESTROYED.test(String(err?.message ?? err))) throw err;
    // The document was replaced (redirect) while setting up; measure the new one.
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    warnings.push(
      `Page redirected to ${page.url()} before collection started; metrics are from the redirected page.`,
    );
    try {
      await injectWebVitals(page);
      await setupCollectors(page);
    } catch (err2) {
      if (!CONTEXT_DESTROYED.test(String(err2?.message ?? err2))) throw err2;
      earlyEmpty = true;
    }
  }

  const originalUrl = page.url();
  let navigated = false;
  let lastSnapshot = {};

  // Reads collector data from the current document. Returns null when the
  // collectors are gone, which means a different document is now loaded.
  const readData = () =>
    page.evaluate(() =>
      window.__cwvData ? JSON.parse(JSON.stringify(window.__cwvData)) : null,
    );

  const NAVIGATED = Symbol('navigated');
  let raw = {};
  try {
    if (earlyEmpty) throw new Error('skip');
    // Let the page settle (early metrics: FCP, TTFB, LCP), refreshing the
    // snapshot only while still on the original document.
    const deadline = Date.now() + waitAfterLoad;
    while (Date.now() < deadline) {
      await page.waitForTimeout(Math.min(250, Math.max(0, deadline - Date.now())));
      const data = await readData();
      if (data === null) throw NAVIGATED;
      lastSnapshot = data;
    }

    // The browser stops LCP at first input, so input must come after load
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {
      warnings.push(
        'Page did not reach the load event within 15s; LCP may be truncated by simulated input.',
      );
    });
    const beforeInput = await readData();
    if (beforeInput === null) throw NAVIGATED;
    lastSnapshot = beforeInput;

    if (typeof interact === 'function') {
      await interact(page);
    } else if (simulate) {
      await simulateInteractions(page);
    }

    // Flush pending metric reports
    await forceMetricFlush(page);

    // Same document (even if the URL changed via pushState) keeps live data;
    // a cross-document navigation leaves no collectors behind.
    raw = await readData();
    if (raw === null) throw NAVIGATED;
  } catch (err) {
    if (!earlyEmpty) {
      const message = String(err?.message ?? err);
      // Only a lost document counts as navigation; any other error (for
      // example a Playwright timeout inside interact) is the caller's.
      const isNav =
        err === NAVIGATED ||
        CONTEXT_DESTROYED.test(message) ||
        // A destroyed context means a new document; any other read failure
        // (page closed, browser crashed) leaves the caller's error standing.
        (await readData().catch((e) =>
          CONTEXT_DESTROYED.test(String(e?.message ?? e)) ? null : undefined,
        )) === null;
      if (!isNav) throw err;
      navigated = true;
      warnings.push(
        `Page navigated to ${page.url()} during collection; metrics are from ${originalUrl} before the navigation (INP may be missing).`,
      );
      raw = lastSnapshot;
    }
  }

  const metrics = {};
  for (const [name, m] of Object.entries(raw)) {
    const rating = getRating(name, m.value);
    metrics[name] = {
      name,
      value: m.value,
      formatted: formatValue(name, m.value),
      rating,                             // 'good' | 'needs-improvement' | 'poor'
      ratingIcon: RATING_ICONS[rating],
      threshold: THRESHOLDS[name] || null,
      attribution: includeAttribution ? m.attribution : undefined,
      breakdown: getBreakdown(name, m.attribution),
    };
  }

  return {
    url: navigated ? originalUrl : page.url(),
    metrics,
    warnings,
    conditions: conditions || {
      preset: 'unspecified',
      label: 'Not recorded',
      method: null,
      network: null,
      cpuSlowdown: null,
      viewport: page.viewportSize(),
      userAgent: null,
    },
    collectedAt: new Date().toISOString(),
    collectionDurationMs: Date.now() - started,
  };
}

/**
 * Assert CWV values against custom thresholds. Throws on failure.
 * Good for Playwright test assertions.
 *
 * @param {CWVResult} result
 * @param {object} thresholds - e.g. { LCP: 2500, CLS: 0.1, INP: 200 }
 * @throws {Error} if any metric exceeds its threshold
 */
function assertCWV(result, thresholds) {
  const failures = [];
  for (const [name, maxValue] of Object.entries(thresholds)) {
    const m = result.metrics[name];
    if (!m) {
      failures.push(`${name}: not captured (expected ≤${maxValue})`);
      continue;
    }
    if (m.value > maxValue) {
      failures.push(
        `${name}: ${m.formatted} exceeds threshold of ${formatValue(name, maxValue)}`,
      );
    }
  }
  if (failures.length > 0) {
    throw new Error(`CWV assertion failed:\n  ${failures.join('\n  ')}`);
  }
}

/**
 * Measure CWV across multiple URLs and return a comparison table.
 *
 * @param {import('playwright').Browser} browser
 * @param {string[]} urls
 * @param {object} [options] - passed to collectCWV, plus `preset` ('mobile' | 'desktop' | 'none', default 'mobile')
 * @returns {Promise<CWVResult[]>}
 */
async function measureMultipleUrls(browser, urls, options = {}) {
  const { preset = 'mobile', ...collectOptions } = options;
  presetConditions(preset); // throws once, up front, for an unknown preset
  const results = [];
  for (const url of urls) {
    let context;
    try {
      const measured = await createMeasuredPage(browser, preset);
      context = measured.context;
      await measured.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      results.push(
        await collectCWV(measured.page, { ...collectOptions, conditions: measured.conditions }),
      );
    } catch (err) {
      let conditions;
      try { conditions = presetConditions(preset); } catch { conditions = undefined; }
      results.push({ url, error: err.message, metrics: {}, warnings: [], conditions });
    } finally {
      if (context) await context.close();
    }
  }
  return results;
}

module.exports = {
  injectWebVitals,
  setupCollectors,
  simulateInteractions,
  forceMetricFlush,
  collectCWV,
  assertCWV,
  measureMultipleUrls,
  WEB_VITALS_CDN,
  WEB_VITALS_VERSION,
};
