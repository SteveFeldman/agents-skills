'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Core Web Vitals collector for Playwright
 *
 * Collects LCP, INP, CLS (Core Web Vitals) + FCP, TTFB (additional)
 * using the official Google web-vitals library injected at runtime.
 *
 * Usage:
 *   const { collectCWV, printReport, assertCWV } = require('/path/to/cwv-collector');
 *   const result = await collectCWV(page, { simulate: true });
 *   printReport(result);
 *   assertCWV(result, { LCP: 2500, CLS: 0.1 });
 */

const WEB_VITALS_CDN =
  'https://unpkg.com/web-vitals@5/dist/web-vitals.attribution.iife.js';

// Google-defined thresholds (good / needs-improvement boundary, poor boundary)
const THRESHOLDS = {
  LCP:  { good: 2500,  poor: 4000,  unit: 'ms', label: 'Largest Contentful Paint' },
  INP:  { good: 200,   poor: 500,   unit: 'ms', label: 'Interaction to Next Paint' },
  CLS:  { good: 0.1,   poor: 0.25,  unit: '',   label: 'Cumulative Layout Shift' },
  FCP:  { good: 1800,  poor: 3000,  unit: 'ms', label: 'First Contentful Paint' },
  TTFB: { good: 800,   poor: 1800,  unit: 'ms', label: 'Time to First Byte' },
};

const RATING_ICONS = { good: '✅', 'needs-improvement': '⚠️ ', poor: '🔴', unknown: '❔' };

function getRating(name, value) {
  const t = THRESHOLDS[name];
  if (!t || value == null) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function formatValue(name, value) {
  if (value == null) return 'N/A';
  const t = THRESHOLDS[name];
  if (t?.unit === 'ms') return `${Math.round(value)}ms`;
  return Number(value).toFixed(4);
}

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
 * Print a formatted Core Web Vitals report to stdout.
 *
 * @param {CWVResult} result
 */
function printReport(result) {
  const CORE   = ['LCP', 'INP', 'CLS'];
  const EXTRA  = ['FCP', 'TTFB'];

  console.log('\n══════════════════════════════════════════════');
  console.log('  Core Web Vitals Report');
  console.log(`  URL:  ${result.url}`);
  console.log(`  Time: ${result.collectedAt}`);
  console.log('══════════════════════════════════════════════');

  console.log('\n📊  Core Web Vitals  (Google ranking signals)');
  console.log('──────────────────────────────────────────────');
  for (const name of CORE) {
    const m = result.metrics[name];
    if (m) {
      const icon  = RATING_ICONS[m.rating] || '❔';
      const label = THRESHOLDS[name]?.label || name;
      const good  = name === 'CLS'
        ? `≤${THRESHOLDS[name].good}`
        : `≤${THRESHOLDS[name].good}ms`;
      console.log(`  ${icon}  ${label} (${name})`);
      console.log(`       Value:  ${m.formatted}   [Good: ${good}]`);
      _printAttribution(name, m.attribution);
    } else {
      const label = THRESHOLDS[name]?.label || name;
      console.log(`  ⏳  ${label} (${name}) — not captured`);
      if (name === 'INP') {
        console.log('       Requires at least one user interaction.');
        console.log('       Use simulate:true or interact with the page first.');
      }
    }
  }

  console.log('\n📈  Additional Metrics');
  console.log('──────────────────────────────────────────────');
  for (const name of EXTRA) {
    const m = result.metrics[name];
    const label = THRESHOLDS[name]?.label || name;
    if (m) {
      const icon = RATING_ICONS[m.rating] || '❔';
      console.log(`  ${icon}  ${label} (${name}): ${m.formatted}`);
    } else {
      console.log(`  ⏳  ${label} (${name}) — not captured`);
    }
  }

  const allCore = CORE.every((n) => result.metrics[n]);
  const allGood = CORE.filter((n) => result.metrics[n]).every(
    (n) => result.metrics[n].rating === 'good',
  );

  console.log('\n──────────────────────────────────────────────');
  if (allCore && allGood) {
    console.log('  ✅  All Core Web Vitals are GOOD');
  } else if (allCore) {
    const failing = CORE.filter(
      (n) => result.metrics[n]?.rating !== 'good',
    ).join(', ');
    console.log(`  ⚠️   Metrics needing improvement: ${failing}`);
  } else {
    const missing = CORE.filter((n) => !result.metrics[n]).join(', ');
    console.log(`  ℹ️   Incomplete capture — missing: ${missing}`);
  }
  console.log(`  Collected in ${result.collectionDurationMs}ms`);
  console.log('══════════════════════════════════════════════\n');
}

function _printAttribution(name, attribution) {
  if (!attribution) return;
  switch (name) {
    case 'LCP':
      if (attribution.target) console.log(`       Element: ${attribution.target}`);
      if (attribution.url)    console.log(`       Resource URL: ${attribution.url}`);
      break;
    case 'CLS':
      if (attribution.largestShiftTarget)
        console.log(`       Largest shift element: ${attribution.largestShiftTarget}`);
      break;
    case 'INP':
      if (attribution.interactionType && attribution.interactionTarget)
        console.log(`       ${attribution.interactionType} on: ${attribution.interactionTarget}`);
      break;
  }
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

/**
 * Print a side-by-side comparison of multiple CWV results.
 *
 * @param {CWVResult[]} results
 */
function printComparison(results) {
  const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  console.log('\n══════════════════════════════════════════════');
  console.log('  Core Web Vitals — Multi-URL Comparison');
  console.log('══════════════════════════════════════════════');

  for (const r of results) {
    const shortUrl = r.url.replace(/^https?:\/\//, '').slice(0, 60);
    console.log(`\n  🌐  ${shortUrl}`);
    if (r.error) {
      console.log(`     ❌  Error: ${r.error}`);
      continue;
    }
    for (const name of METRICS) {
      const m = r.metrics[name];
      if (m) {
        const icon = RATING_ICONS[m.rating] || '❔';
        console.log(`     ${icon}  ${name}: ${m.formatted}`);
      }
    }
  }
  console.log('\n══════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATIONS = {
  LCP: {
    'needs-improvement': [
      'Preload the LCP resource with `<link rel="preload">` or set `fetchpriority="high"` on the element.',
      'Ensure the LCP image is served from a CDN close to your users.',
      'Check if the LCP resource is render-blocking — eliminate or defer any CSS/JS ahead of it.',
      'Use next-gen image formats (WebP/AVIF) and serve correctly sized images.',
    ],
    poor: [
      'Preload the LCP resource immediately — add `<link rel="preload" as="image">` in `<head>`.',
      'Audit server response time (TTFB > 600ms is the most common LCP blocker).',
      'Remove render-blocking resources above the fold entirely.',
      'Consider server-side rendering or static generation to reduce time-to-first-byte.',
      'Use a CDN — if LCP resource is on origin, latency alone can push past 4s.',
    ],
  },
  INP: {
    'needs-improvement': [
      'Break up long JavaScript tasks (>50ms) using `scheduler.yield()` or `setTimeout(..., 0)`.',
      'Defer non-critical third-party scripts (analytics, chat widgets) until after page load.',
      'Use `requestAnimationFrame` to batch DOM reads and writes.',
    ],
    poor: [
      'Profile with Chrome DevTools Performance panel — identify the long tasks blocking the main thread.',
      'Audit third-party scripts; each synchronous third party can add 50–200ms to INP.',
      'Move heavy computation off the main thread using Web Workers.',
      'Audit event handlers for synchronous DOM access patterns that force style recalculation.',
    ],
  },
  CLS: {
    'needs-improvement': [
      'Add explicit `width` and `height` attributes to all `<img>` and `<video>` elements.',
      'Reserve space for ads and embeds with CSS `aspect-ratio` or fixed dimensions.',
      'Avoid inserting DOM content above existing content after initial load.',
    ],
    poor: [
      'Audit all images and videos — missing dimensions are the #1 cause of poor CLS.',
      'Check for web fonts causing FOUT/FOIT — use `font-display: optional` or preload fonts.',
      'Investigate dynamically injected banners, cookie notices, and chat widgets that shift content.',
      'Use CSS `transform` animations instead of properties that trigger layout (top, left, height).',
    ],
  },
  FCP: {
    'needs-improvement': [
      'Eliminate render-blocking CSS — load critical styles inline, defer the rest.',
      'Preconnect to required origins: `<link rel="preconnect" href="https://fonts.gstatic.com">`.',
    ],
    poor: [
      'Inline critical CSS and defer all non-critical stylesheets.',
      'Check server TTFB — a slow server directly delays FCP.',
      'Remove or defer all render-blocking JavaScript in `<head>`.',
    ],
  },
  TTFB: {
    'needs-improvement': [
      'Use a CDN to serve cached responses closer to users.',
      'Enable HTTP/2 and compression (Brotli/gzip) on your server.',
    ],
    poor: [
      'Profile your server-side render time — add caching at the application or edge layer.',
      'Migrate to a CDN with edge caching; dynamic pages can be cached with stale-while-revalidate.',
      'Check for database queries or third-party API calls blocking the initial response.',
    ],
  },
};

function getRecommendations(name, rating) {
  if (rating === 'good' || rating === 'unknown') return [];
  return RECOMMENDATIONS[name]?.[rating] ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a Markdown report from one or more CWV results.
 *
 * @param {CWVResult|CWVResult[]} results
 * @param {object} [options]
 * @param {string} [options.title]
 * @returns {string} Markdown content
 */
function generateMarkdownReport(results, options = {}) {
  const list  = Array.isArray(results) ? results : [results];
  const title = options.title ?? 'Core Web Vitals Report';
  const now   = new Date().toISOString();
  const CORE  = ['LCP', 'INP', 'CLS'];
  const ALL   = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  const ratingBadge = (r) =>
    r === 'good' ? '✅ Good' : r === 'needs-improvement' ? '⚠️ Needs Improvement' : r === 'poor' ? '🔴 Poor' : '—';

  const lines = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Generated:** ${now}`);
  lines.push('');

  // ── Summary table (multi-URL) ──────────────────────────────────────────
  if (list.length > 1) {
    lines.push('## Summary');
    lines.push('');
    lines.push('| Page | LCP | INP | CLS | FCP | TTFB |');
    lines.push('|------|-----|-----|-----|-----|------|');
    for (const r of list) {
      const shortUrl = r.url ?? 'N/A';
      const cols = ALL.map((n) => {
        const m = r.metrics?.[n];
        return m ? `${m.formatted} ${m.ratingIcon}` : '—';
      });
      lines.push(`| ${shortUrl} | ${cols.join(' | ')} |`);
    }
    lines.push('');
  }

  // ── Per-page details ───────────────────────────────────────────────────
  lines.push('## Detailed Results');
  lines.push('');

  for (const r of list) {
    if (list.length > 1) {
      lines.push(`### ${r.url}`);
      lines.push('');
    }

    if (r.error) {
      lines.push(`❌ **Error:** ${r.error}`);
      lines.push('');
      continue;
    }

    lines.push(`**URL:** ${r.url}`);
    lines.push(`**Collected:** ${r.collectedAt ?? now}`);
    lines.push('');

    // Metric table
    lines.push('| Metric | Value | Rating | Threshold |');
    lines.push('|--------|-------|--------|-----------|');
    for (const name of ALL) {
      const m = r.metrics?.[name];
      const t = THRESHOLDS[name];
      const threshold = t
        ? (t.unit === 'ms' ? `Good ≤${t.good}ms · Poor >${t.poor}ms` : `Good ≤${t.good} · Poor >${t.poor}`)
        : '—';
      if (m) {
        lines.push(`| **${name}** — ${t?.label ?? name} | ${m.formatted} | ${ratingBadge(m.rating)} | ${threshold} |`);
      } else {
        lines.push(`| **${name}** — ${t?.label ?? name} | — | — | ${threshold} |`);
      }
    }
    lines.push('');

    // Attribution
    const hasAttribution = CORE.some((n) => r.metrics?.[n]?.attribution);
    if (hasAttribution) {
      lines.push('#### Attribution');
      lines.push('');
      for (const name of CORE) {
        const m = r.metrics?.[name];
        if (!m?.attribution) continue;
        const a = m.attribution;
        lines.push(`**${name}:**`);
        if (name === 'LCP') {
          if (a.target)  lines.push(`- Element: \`${a.target}\``);
          if (a.url)     lines.push(`- Resource: \`${a.url}\``);
          if (a.timeToFirstByte != null) lines.push(`- TTFB contribution: ${Math.round(a.timeToFirstByte)}ms`);
          if (a.resourceLoadDelay != null) lines.push(`- Resource load delay: ${Math.round(a.resourceLoadDelay)}ms`);
          if (a.resourceLoadDuration != null) lines.push(`- Resource load duration: ${Math.round(a.resourceLoadDuration)}ms`);
        }
        if (name === 'CLS') {
          if (a.largestShiftTarget) lines.push(`- Largest shifting element: \`${a.largestShiftTarget}\``);
          if (a.largestShiftValue != null) lines.push(`- Shift score: ${a.largestShiftValue.toFixed(4)}`);
        }
        if (name === 'INP') {
          if (a.interactionType && a.interactionTarget)
            lines.push(`- Interaction: \`${a.interactionType}\` on \`${a.interactionTarget}\``);
          if (a.inputDelay != null)        lines.push(`- Input delay: ${Math.round(a.inputDelay)}ms`);
          if (a.processingDuration != null) lines.push(`- Processing duration: ${Math.round(a.processingDuration)}ms`);
          if (a.presentationDelay != null) lines.push(`- Presentation delay: ${Math.round(a.presentationDelay)}ms`);
        }
        lines.push('');
      }
    }

    // Recommendations
    const recs = CORE.flatMap((n) => {
      const m = r.metrics?.[n];
      if (!m) return [];
      return getRecommendations(n, m.rating).map((rec) => ({ metric: n, rec }));
    });

    if (recs.length > 0) {
      lines.push('#### Recommendations');
      lines.push('');
      let lastMetric = null;
      for (const { metric, rec } of recs) {
        if (metric !== lastMetric) {
          lines.push(`**${metric} (${THRESHOLDS[metric].label}):**`);
          lastMetric = metric;
        }
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('*Report generated by the [core-web-vitals skill](https://github.com/GoogleChrome/web-vitals)*');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML REPORT
// ─────────────────────────────────────────────────────────────────────────────

const RATING_COLORS = {
  good:               { bg: '#e6f9f0', border: '#0cce6b', text: '#0a5c30', badge: '#0cce6b' },
  'needs-improvement': { bg: '#fff8e6', border: '#ffa400', text: '#7a4e00', badge: '#ffa400' },
  poor:               { bg: '#fff0ef', border: '#ff4e42', text: '#7a1a14', badge: '#ff4e42' },
  unknown:            { bg: '#f5f5f5', border: '#ccc',    text: '#666',    badge: '#ccc'    },
};

/**
 * Generate a self-contained HTML report from one or more CWV results.
 *
 * @param {CWVResult|CWVResult[]} results
 * @param {object} [options]
 * @param {string} [options.title]
 * @returns {string} HTML content
 */
function generateHtmlReport(results, options = {}) {
  const list  = Array.isArray(results) ? results : [results];
  const title = options.title ?? 'Core Web Vitals Report';
  const now   = new Date().toLocaleString();
  const CORE  = ['LCP', 'INP', 'CLS'];
  const ALL   = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  function metricCard(name, metric) {
    const t = THRESHOLDS[name];
    if (!metric) {
      return `
        <div class="metric-card unknown">
          <div class="metric-name">${name}</div>
          <div class="metric-label">${t?.label ?? name}</div>
          <div class="metric-value">—</div>
          <div class="metric-rating">Not captured</div>
          <div class="metric-threshold">${t ? (t.unit === 'ms' ? `Good ≤${t.good}ms` : `Good ≤${t.good}`) : ''}</div>
        </div>`;
    }
    const c = RATING_COLORS[metric.rating] ?? RATING_COLORS.unknown;
    return `
      <div class="metric-card" style="background:${c.bg};border-top:4px solid ${c.border}">
        <div class="metric-name">${name}</div>
        <div class="metric-label">${t?.label ?? name}</div>
        <div class="metric-value" style="color:${c.border}">${metric.formatted}</div>
        <div class="metric-rating" style="background:${c.badge};color:#fff">${metric.rating.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</div>
        <div class="metric-threshold">${t ? (t.unit === 'ms' ? `Good ≤${t.good}ms · Poor >${t.poor}ms` : `Good ≤${t.good} · Poor >${t.poor}`) : ''}</div>
      </div>`;
  }

  function attributionSection(result) {
    const rows = [];
    for (const name of CORE) {
      const m = result.metrics?.[name];
      if (!m?.attribution) continue;
      const a = m.attribution;
      const details = [];
      if (name === 'LCP') {
        if (a.target)                  details.push(['Element', `<code>${_esc(a.target)}</code>`]);
        if (a.url)                     details.push(['Resource URL', `<code class="url">${_esc(a.url)}</code>`]);
        if (a.timeToFirstByte != null)       details.push(['TTFB contribution', `${Math.round(a.timeToFirstByte)}ms`]);
        if (a.resourceLoadDelay != null)     details.push(['Resource load delay', `${Math.round(a.resourceLoadDelay)}ms`]);
        if (a.resourceLoadDuration != null)  details.push(['Resource load duration', `${Math.round(a.resourceLoadDuration)}ms`]);
        if (a.elementRenderDelay != null)    details.push(['Element render delay', `${Math.round(a.elementRenderDelay)}ms`]);
      }
      if (name === 'CLS') {
        if (a.largestShiftTarget) details.push(['Largest shifting element', `<code>${_esc(a.largestShiftTarget)}</code>`]);
        if (a.largestShiftValue != null) details.push(['Shift score', a.largestShiftValue.toFixed(4)]);
        if (a.loadState)          details.push(['Load state at shift', _esc(a.loadState)]);
      }
      if (name === 'INP') {
        if (a.interactionType && a.interactionTarget)
          details.push(['Interaction', `<code>${_esc(a.interactionType)}</code> on <code>${_esc(a.interactionTarget)}</code>`]);
        if (a.inputDelay != null)         details.push(['Input delay', `${Math.round(a.inputDelay)}ms`]);
        if (a.processingDuration != null)  details.push(['Processing duration', `${Math.round(a.processingDuration)}ms`]);
        if (a.presentationDelay != null)   details.push(['Presentation delay', `${Math.round(a.presentationDelay)}ms`]);
        if (a.longAnimationFrameEntries?.length) {
          details.push(['Long animation frames', `${a.longAnimationFrameEntries.length} frame(s) blocked`]);
        }
      }
      if (details.length === 0) continue;
      const c = RATING_COLORS[m.rating] ?? RATING_COLORS.unknown;
      rows.push(`
        <div class="attribution-block" style="border-left:3px solid ${c.border}">
          <div class="attribution-metric" style="color:${c.border}">${name} — ${THRESHOLDS[name]?.label ?? name}</div>
          <table class="attribution-table">
            ${details.map(([k, v]) => `<tr><td class="attr-key">${k}</td><td class="attr-val">${v}</td></tr>`).join('')}
          </table>
        </div>`);
    }
    return rows.length > 0
      ? `<h3>Attribution</h3><div class="attribution-grid">${rows.join('')}</div>`
      : '';
  }

  function recommendationsSection(result) {
    const recs = CORE.flatMap((n) => {
      const m = result.metrics?.[n];
      if (!m) return [];
      return getRecommendations(n, m.rating).map((rec) => ({ metric: n, rec }));
    });
    if (recs.length === 0) return '';

    const byMetric = {};
    for (const { metric, rec } of recs) {
      (byMetric[metric] = byMetric[metric] ?? []).push(rec);
    }

    const html = Object.entries(byMetric).map(([name, recList]) => {
      const m = result.metrics[name];
      const c = RATING_COLORS[m?.rating] ?? RATING_COLORS.unknown;
      return `
        <div class="rec-group">
          <div class="rec-metric-name" style="color:${c.border}">${name} — ${THRESHOLDS[name].label}</div>
          <ul>${recList.map((r) => `<li>${_esc(r)}</li>`).join('')}</ul>
        </div>`;
    }).join('');

    return `<h3>Recommendations</h3><div class="rec-section">${html}</div>`;
  }

  function summaryTable() {
    if (list.length < 2) return '';
    const rows = list.map((r) => {
      if (r.error) return `<tr><td>${_esc(r.url)}</td><td colspan="5" class="error">Error: ${_esc(r.error)}</td></tr>`;
      return `<tr>
        <td class="url-cell">${_esc(r.url)}</td>
        ${ALL.map((n) => {
          const m = r.metrics?.[n];
          const c = RATING_COLORS[m?.rating ?? 'unknown'];
          return `<td style="color:${c.border};font-weight:600">${m ? m.formatted : '—'}</td>`;
        }).join('')}
      </tr>`;
    });
    return `
      <section class="summary-section">
        <h2>Summary</h2>
        <table class="summary-table">
          <thead><tr><th>Page</th>${ALL.map((n) => `<th>${n}</th>`).join('')}</tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </section>`;
  }

  const pageDetails = list.map((r, i) => {
    const heading = list.length > 1 ? `<h2 class="page-heading">Page ${i + 1}: <span class="page-url">${_esc(r.url)}</span></h2>` : '';
    if (r.error) return `<section class="page-section">${heading}<p class="error">❌ Error: ${_esc(r.error)}</p></section>`;

    const coreCards  = CORE.map((n) => metricCard(n, r.metrics?.[n])).join('');
    const extraCards = ['FCP', 'TTFB'].map((n) => metricCard(n, r.metrics?.[n])).join('');

    const allGood = CORE.every((n) => r.metrics?.[n]?.rating === 'good');
    const summary = allGood
      ? `<div class="page-summary good">✅ All Core Web Vitals are Good</div>`
      : (() => {
          const failing = CORE.filter((n) => r.metrics?.[n] && r.metrics[n].rating !== 'good');
          const missing = CORE.filter((n) => !r.metrics?.[n]);
          const parts = [];
          if (failing.length) parts.push(`⚠️ Needs improvement: ${failing.join(', ')}`);
          if (missing.length) parts.push(`⏳ Not captured: ${missing.join(', ')}`);
          return `<div class="page-summary warn">${parts.join(' · ')}</div>`;
        })();

    return `
      <section class="page-section">
        ${heading}
        <p class="page-meta">URL: <a href="${_esc(r.url)}">${_esc(r.url)}</a> &nbsp;·&nbsp; Collected: ${r.collectedAt ?? now} &nbsp;·&nbsp; Duration: ${r.collectionDurationMs ?? '—'}ms</p>
        ${summary}
        <h3>Core Web Vitals</h3>
        <div class="metric-grid core-grid">${coreCards}</div>
        <h3>Additional Metrics</h3>
        <div class="metric-grid extra-grid">${extraCards}</div>
        ${attributionSection(r)}
        ${recommendationsSection(r)}
      </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #f8f9fa; color: #1a1a2e; line-height: 1.6; }
  a { color: #4361ee; }
  code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85em;
         background: #eef0f5; padding: 2px 5px; border-radius: 3px; word-break: break-all; }
  code.url { font-size: 0.78em; }

  header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
           color: #fff; padding: 2.5rem 2rem; }
  header h1 { font-size: 1.8rem; font-weight: 700; }
  header .subtitle { color: #a0aec0; margin-top: .25rem; font-size: .9rem; }

  .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }

  section { background: #fff; border-radius: 12px; padding: 2rem;
            margin-bottom: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  h2 { font-size: 1.3rem; color: #1a1a2e; margin-bottom: 1rem; padding-bottom: .5rem;
       border-bottom: 2px solid #f0f0f5; }
  h3 { font-size: 1rem; color: #4a5568; margin: 1.5rem 0 .75rem;
       text-transform: uppercase; letter-spacing: .05em; }

  .metric-grid { display: grid; gap: 1rem; }
  .core-grid  { grid-template-columns: repeat(3, 1fr); }
  .extra-grid { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 700px) {
    .core-grid, .extra-grid { grid-template-columns: 1fr; }
  }

  .metric-card { border-radius: 10px; padding: 1.25rem; border: 1px solid #e2e8f0;
                 border-top-width: 4px; }
  .metric-card.unknown { background: #f8f9fa; border-color: #dee2e6; border-top-color: #dee2e6; }
  .metric-name  { font-size: 1.4rem; font-weight: 800; letter-spacing: .02em; }
  .metric-label { font-size: .78rem; color: #718096; margin-top: .1rem; margin-bottom: .75rem; }
  .metric-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: .5rem; }
  .metric-rating { display: inline-block; padding: .2rem .65rem; border-radius: 9999px;
                   font-size: .75rem; font-weight: 700; color: #fff; letter-spacing: .03em; }
  .metric-threshold { font-size: .72rem; color: #a0aec0; margin-top: .5rem; }

  .page-meta { font-size: .85rem; color: #718096; margin-bottom: 1rem; }
  .page-heading { font-size: 1.2rem; margin-bottom: .25rem; }
  .page-url { font-weight: 400; font-size: .95rem; color: #4361ee; }
  .page-summary { padding: .65rem 1rem; border-radius: 8px; font-weight: 600;
                  font-size: .9rem; margin-bottom: 1.25rem; }
  .page-summary.good { background: #e6f9f0; color: #0a5c30; }
  .page-summary.warn { background: #fff8e6; color: #7a4e00; }

  .attribution-grid { display: flex; flex-direction: column; gap: .75rem; }
  .attribution-block { padding: .75rem 1rem; border-radius: 6px; background: #fafafa; }
  .attribution-metric { font-weight: 700; font-size: .85rem; margin-bottom: .4rem; }
  .attribution-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
  .attr-key { color: #718096; width: 180px; padding: .2rem 0; vertical-align: top; }
  .attr-val { color: #2d3748; padding: .2rem 0 .2rem .5rem; word-break: break-all; }

  .rec-section { display: flex; flex-direction: column; gap: 1rem; }
  .rec-group { background: #fafafa; border-radius: 8px; padding: 1rem; }
  .rec-metric-name { font-weight: 700; font-size: .88rem; margin-bottom: .5rem; }
  .rec-group ul { padding-left: 1.25rem; }
  .rec-group li { font-size: .85rem; color: #4a5568; margin-bottom: .3rem; }

  .summary-section {}
  .summary-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  .summary-table th { background: #f7fafc; font-weight: 700; text-align: left;
                      padding: .6rem .75rem; border-bottom: 2px solid #e2e8f0; }
  .summary-table td { padding: .55rem .75rem; border-bottom: 1px solid #f0f0f5; }
  .summary-table .url-cell { font-size: .8rem; word-break: break-all; max-width: 300px; }

  .error { color: #e53e3e; font-weight: 600; }

  footer { text-align: center; padding: 2rem; color: #a0aec0; font-size: .8rem; }
</style>
</head>
<body>
<header>
  <h1>🌐 ${_esc(title)}</h1>
  <div class="subtitle">Generated ${now} · ${list.length} page${list.length > 1 ? 's' : ''} measured · Powered by google/web-vitals</div>
</header>
<div class="container">
  ${summaryTable()}
  ${pageDetails}
</div>
<footer>Report generated by the core-web-vitals skill · <a href="https://web.dev/vitals">web.dev/vitals</a></footer>
</body>
</html>`;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a CWV report to disk.
 * Auto-detects format from the file extension:
 *   .html → HTML report with visual metric cards and recommendations
 *   anything else (.md, .txt, etc.) → Markdown report
 *
 * @param {CWVResult|CWVResult[]} results
 * @param {string} outputPath  - e.g. '/tmp/cwv-report.html' or '/tmp/cwv-report.md'
 * @param {object} [options]   - passed to generateMarkdownReport / generateHtmlReport
 * @returns {string}           - the resolved output path
 */
function saveReport(results, outputPath, options = {}) {
  const resolved = path.resolve(outputPath);
  const ext      = path.extname(resolved).toLowerCase();
  const content  = ext === '.html'
    ? generateHtmlReport(results, options)
    : generateMarkdownReport(results, options);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');

  const format = ext === '.html' ? 'HTML' : 'Markdown';
  console.log(`📄 CWV ${format} report saved: ${resolved}`);
  return resolved;
}

module.exports = {
  collectCWV,
  printReport,
  assertCWV,
  measureMultipleUrls,
  printComparison,
  generateMarkdownReport,
  generateHtmlReport,
  saveReport,
  THRESHOLDS,
  WEB_VITALS_CDN,
  getRating,
  formatValue,
};
