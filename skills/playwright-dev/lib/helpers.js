/**
 * Playwright Skill — Reusable Helpers
 *
 * Battle-tested patterns from inventory_check and product-detail repos.
 */

const http = require('http');

// ---------------------------------------------------------------------------
// Browser launch & context
// ---------------------------------------------------------------------------

/**
 * Resolve headless mode.
 *   HEADLESS=true  → headless
 *   HEADLESS=false → visible (default)
 *   --headless CLI flag → headless
 */
function resolveHeadless() {
  if (process.argv.includes('--headless')) return true;
  const env = (process.env.HEADLESS || '').toLowerCase();
  if (env === 'true' || env === '1') return true;
  return false; // default: visible browser
}

/**
 * Parse extra HTTP headers from environment variables.
 *   PW_HEADER_NAME + PW_HEADER_VALUE → single header
 *   PW_EXTRA_HEADERS → JSON object of headers
 */
function getExtraHeadersFromEnv() {
  const name = process.env.PW_HEADER_NAME;
  const value = process.env.PW_HEADER_VALUE;
  if (name && value) return { [name]: value };

  const json = process.env.PW_EXTRA_HEADERS;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse PW_EXTRA_HEADERS:', e.message);
    }
  }
  return null;
}

/**
 * Create a browser context with standard settings.
 * Merges env headers, blocks heavy resources, sets viewport.
 */
async function createContext(browser, options = {}) {
  const envHeaders = getExtraHeadersFromEnv();
  const mergedHeaders = { ...envHeaders, ...(options.extraHTTPHeaders || {}) };

  const defaults = {
    viewport: options.viewport || { width: 1920, height: 1080 },
    userAgent: options.userAgent,
    locale: options.locale || 'en-US',
    ...(Object.keys(mergedHeaders).length > 0 && { extraHTTPHeaders: mergedHeaders }),
  };

  const context = await browser.newContext({ ...defaults, ...options });

  // Block heavy resources unless caller opts out
  if (options.blockResources !== false) {
    await context.route(
      /\.(woff2?|ttf|otf|eot|mp4|webm|ogg)(\?|$)/i,
      route => route.abort(),
    );
  }

  return context;
}

// ---------------------------------------------------------------------------
// Overlay & modal dismissal
// ---------------------------------------------------------------------------

/**
 * Dismiss common overlays via JS injection (no clicking, no re-renders).
 */
async function dismissOverlays(page) {
  // Cookie consent (OneTrust)
  await page.evaluate(() => {
    const banner = document.getElementById('onetrust-banner-sdk');
    if (banner) banner.style.display = 'none';
    const btn = document.querySelector('#onetrust-close-btn-container button, #onetrust-accept-btn-handler');
    if (btn) btn.click();
  }).catch(() => {});

  // Promotional modals
  await page.evaluate(() => {
    document.querySelectorAll('[class*="ModalBackground"], [class*="ModalContainer"]')
      .forEach(el => el.remove());
  }).catch(() => {});

  // Survey widgets (Qualtrics)
  await page.evaluate(() => {
    document.querySelectorAll('[id^="QSI"], [class*="QSI"]')
      .forEach(el => el.remove());
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Lazy-load & scrolling
// ---------------------------------------------------------------------------

/**
 * Scroll through the entire page to trigger lazy-loaded content,
 * then scroll back to top.
 */
async function triggerLazyLoad(page, stepDelay = 300) {
  await page.evaluate(async (delay) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let y = 0; y <= document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await wait(delay);
    }
    window.scrollTo(0, 0);
    await wait(200);
  }, stepDelay);
}

// ---------------------------------------------------------------------------
// Text & element checks
// ---------------------------------------------------------------------------

/**
 * Check if text exists on the page (visible text, case-insensitive).
 */
async function textExists(page, text) {
  const count = await page.getByText(text, { exact: false }).count();
  return count > 0;
}

/**
 * Check visible text first, then fall back to raw HTML search.
 * Returns { label, text, passed, warn?, warnReason? }.
 */
async function checkWithHtmlFallback(page, label, text) {
  if (await textExists(page, text)) {
    return { label, text, passed: true };
  }

  const html = await page.content();
  if (html.toLowerCase().includes(text.toLowerCase())) {
    return {
      label, text, passed: true,
      warn: true,
      warnReason: 'Found in HTML attributes only (not visible text)',
    };
  }

  return { label, text, passed: false };
}

/**
 * Simple pass/fail check for visible text.
 */
async function check(page, label, text) {
  return { label, text, passed: await textExists(page, text) };
}

// ---------------------------------------------------------------------------
// Fallback chains
// ---------------------------------------------------------------------------

/**
 * Try a list of IDs until one succeeds.
 * @param {Function} requestFn  async (id) => { success, data }
 * @param {string[]} ids        ordered list of IDs to try
 * @returns {{ success, data, usedId, attemptedIds }}
 */
async function withFallback(requestFn, ids) {
  const attemptedIds = [];
  for (const id of ids) {
    attemptedIds.push(id);
    try {
      const result = await requestFn(id);
      if (result.success) return { ...result, usedId: id, attemptedIds };
    } catch {}
  }
  return { success: false, data: null, usedId: null, attemptedIds };
}

// ---------------------------------------------------------------------------
// Degraded validation
// ---------------------------------------------------------------------------

/**
 * Compare actual vs expected; log a degradation warning if mismatched.
 * Returns true if matched, false if degraded.
 */
function validateDegraded(actual, expected, label) {
  if (actual === expected) return true;
  console.log(`  DEGRADED: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return false;
}

// ---------------------------------------------------------------------------
// Dev server detection
// ---------------------------------------------------------------------------

/**
 * Scan common ports for running dev servers.
 * @param {number[]} extraPorts  additional ports to check
 * @returns {Promise<string[]>}  array of URLs like "http://localhost:3000"
 */
async function detectDevServers(extraPorts = []) {
  const commonPorts = [3000, 3001, 3002, 5173, 8080, 8000, 4200, 5000, 9000, 1234];
  const allPorts = [...new Set([...commonPorts, ...extraPorts])];
  const servers = [];

  console.log('Checking for running dev servers...');

  for (const port of allPorts) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request(
          { hostname: 'localhost', port, path: '/', method: 'HEAD', timeout: 500 },
          res => {
            if (res.statusCode < 500) {
              servers.push(`http://localhost:${port}`);
              console.log(`  Found server on port ${port}`);
            }
            resolve();
          },
        );
        req.on('error', () => resolve());
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.end();
      });
    } catch {}
  }

  if (servers.length === 0) console.log('  No dev servers detected');
  return servers;
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

/**
 * Take a screenshot with a slugified, descriptive filename.
 */
async function takeScreenshot(page, name, dir = '/tmp', options = {}) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${slug}-${ts}.png`;
  const filepath = require('path').join(dir, filename);

  await page.screenshot({ path: filepath, fullPage: true, ...options });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate a markdown report from an array of test results.
 *
 * Each result: { testId, name, category, type, url, durationMs,
 *                checks: [{ label, text, passed, warn?, warnReason?, softFail?, softFailReason? }] }
 */
function generateMarkdownReport(results, envLabel, baseUrl) {
  const totalChecks  = results.reduce((s, r) => s + r.checks.length, 0);
  const passed       = results.reduce((s, r) => s + r.checks.filter(c => c.passed).length, 0);
  const failed       = totalChecks - passed;
  const warns        = results.reduce((s, r) => s + r.checks.filter(c => c.warn).length, 0);
  const softFails    = results.reduce((s, r) => s + r.checks.filter(c => c.softFail).length, 0);
  const totalMs      = results.reduce((s, r) => s + (r.durationMs || 0), 0);

  const lines = [
    `# Validation Report — ${envLabel}`,
    `**Date**: ${new Date().toISOString()}`,
    `**Environment**: ${baseUrl}`,
    `**Total Checks**: ${totalChecks} (${passed} passed, ${failed} failed, ${warns} warnings, ${softFails} soft-fails)`,
    `**Duration**: ${(totalMs / 1000).toFixed(1)}s`,
    '',
    '| Status | Test | Category | Type | Passed | Failed | Warns | Duration |',
    '|--------|------|----------|------|--------|--------|-------|----------|',
  ];

  for (const r of results) {
    const p  = r.checks.filter(c => c.passed).length;
    const f  = r.checks.filter(c => !c.passed).length;
    const w  = r.checks.filter(c => c.warn).length;
    const icon = f > 0 ? 'FAIL' : w > 0 ? 'WARN' : 'PASS';
    lines.push(`| ${icon} | ${r.testId || ''} ${r.name} | ${r.category || ''} | ${r.type || ''} | ${p} | ${f} | ${w} | ${r.durationMs || 0}ms |`);
  }

  const failures = results.flatMap(r =>
    r.checks.filter(c => !c.passed).map(c => `- **${r.name}** > ${c.label}: expected "${c.text}"`)
  );
  if (failures.length) {
    lines.push('', '## Failed Checks', '', ...failures);
  }

  const warnings = results.flatMap(r =>
    r.checks.filter(c => c.warn).map(c => `- **${r.name}** > ${c.label}: ${c.warnReason}`)
  );
  if (warnings.length) {
    lines.push('', '## Warnings', '', ...warnings);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parallel worker pool
// ---------------------------------------------------------------------------

/**
 * Run tasks in parallel with bounded concurrency.
 *
 * @param {T[]} tasks
 * @param {(task: T, page: Page) => Promise<R>} processFn
 * @param {Browser} browser
 * @param {number} concurrency
 * @param {object} contextOptions  passed to createContext
 * @returns {Promise<R[]>}
 */
async function runPool(tasks, processFn, browser, concurrency = 5, contextOptions = {}) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++];
      const context = await createContext(browser, contextOptions);
      const page = await context.newPage();
      try {
        results.push(await processFn(task, page));
      } catch (err) {
        results.push({ error: err.message });
      } finally {
        await context.close();
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Browser
  resolveHeadless,
  getExtraHeadersFromEnv,
  createContext,

  // Page helpers
  dismissOverlays,
  triggerLazyLoad,

  // Checks
  textExists,
  check,
  checkWithHtmlFallback,

  // Resilience
  withFallback,
  validateDegraded,

  // Dev servers
  detectDevServers,

  // Screenshots
  takeScreenshot,

  // Reporting
  generateMarkdownReport,

  // Parallelism
  runPool,
};
