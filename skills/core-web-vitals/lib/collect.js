'use strict';

const { THRESHOLDS, RATING_ICONS, getRating, formatValue } = require('./thresholds');

const WEB_VITALS_CDN =
  'https://unpkg.com/web-vitals@5/dist/web-vitals.attribution.iife.js';

/**
 * Inject the web-vitals library into an already-loaded page.
 * Uses unpkg CDN; the library uses buffered PerformanceObserver so late
 * injection still captures LCP, FCP, CLS, TTFB accurately.
 *
 * @param {import('playwright').Page} page
 */
async function injectWebVitals(page) {
  const alreadyLoaded = await page.evaluate(
    () => typeof window.webVitals !== 'undefined',
  ).catch(() => false);

  if (!alreadyLoaded) {
    await page.addScriptTag({ url: WEB_VITALS_CDN });
    await page
      .waitForFunction(() => typeof window.webVitals !== 'undefined', {
        timeout: 15000,
      })
      .catch(() => {
        throw new Error(
          'web-vitals library failed to load. Check network access to unpkg.com.',
        );
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
    window.webVitals.onLCP(report, { reportAllChanges: true });
    window.webVitals.onCLS(report, { reportAllChanges: true });
    window.webVitals.onINP(report, { reportAllChanges: true });
    window.webVitals.onFCP(report);
    window.webVitals.onTTFB(report);
  });
}

/**
 * Simulate user interactions to trigger INP measurement.
 * INP only records after at least one interaction — clicks, keyboard, etc.
 * This is best-effort; failures are silently ignored.
 *
 * @param {import('playwright').Page} page
 */
async function simulateInteractions(page) {
  try {
    const { w, h } = await page.evaluate(() => ({
      w: document.documentElement.clientWidth,
      h: document.documentElement.clientHeight,
    }));

    // Click the center of the visible page
    await page.mouse.click(Math.floor(w / 2), Math.floor(h / 2));
    await page.waitForTimeout(200);

    // Tab navigation (keyboard interaction)
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Scroll — triggers layout and paint recalculation
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(300);
    await page.keyboard.press('PageUp');
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
 * @param {number}  [options.waitAfterLoad=1500]   - ms to wait after injection before collecting
 * @param {boolean} [options.includeAttribution=true] - Include attribution debug data
 *
 * @returns {Promise<CWVResult>}
 */
async function collectCWV(page, options = {}) {
  const { simulate = true, waitAfterLoad = 1500, includeAttribution = true } = options;
  const started = Date.now();

  await injectWebVitals(page);
  await setupCollectors(page);

  // Let the page settle and let early metrics (FCP, TTFB, LCP) register
  await page.waitForTimeout(waitAfterLoad);

  if (simulate) {
    await simulateInteractions(page);
  }

  // Flush pending metric reports
  await forceMetricFlush(page);

  // Retrieve collected data from the browser context
  const raw = await page.evaluate(() => window.__cwvData || {});

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
    };
  }

  return {
    url: page.url(),
    metrics,
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
 * @param {object} [options] - passed to collectCWV
 * @returns {Promise<CWVResult[]>}
 */
async function measureMultipleUrls(browser, urls, options = {}) {
  const results = [];
  for (const url of urls) {
    const context = await browser.newContext();
    const page    = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const result = await collectCWV(page, options);
      results.push(result);
    } catch (err) {
      results.push({ url, error: err.message, metrics: {} });
    } finally {
      await context.close();
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
};
