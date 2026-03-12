---
name: playwright-dev
description: Write and execute Playwright browser checks and API checks. Auto-detects dev servers, writes scripts to /tmp, runs them via the universal executor. Use when the user wants to test websites, validate pages, check APIs, or automate any browser task.
user_invocable: true
---

**IMPORTANT — Path Resolution:**
This skill can be installed in different locations. Before executing commands, determine the skill directory based on where you loaded this SKILL.md file, and use that path. Replace `$SKILL_DIR` with the actual path.

Common locations:
- `~/.claude/skills/playwright-dev`
- `<project>/.claude/skills/playwright-dev`

# Playwright Browser & API Check Skill

Write and execute custom Playwright checks for any browser or API validation task.

**CRITICAL WORKFLOW — Follow these steps in order:**

1. **Auto-detect dev servers** (for localhost testing) — ALWAYS run this first:
   ```bash
   cd $SKILL_DIR && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
   ```
   - 1 server found → use it, inform user
   - Multiple found → ask user which one
   - None found → ask for URL or offer to help start one

2. **Write scripts to /tmp** — NEVER write test files to skill directory or user's project. Always use `/tmp/playwright-check-*.js`

3. **Headless mode** — Default is **visible browser** (`headless: false`). Use headless when:
   - User explicitly asks for headless/background execution
   - Running in CI
   - Set via `HEADLESS=true` env var or `--headless` CLI flag

4. **Parameterize URLs** — Always put the target URL in a `TARGET_URL` constant at the top of scripts

5. **Execute via run.js**:
   ```bash
   cd $SKILL_DIR && node run.js /tmp/playwright-check-*.js
   ```
   For headless:
   ```bash
   cd $SKILL_DIR && HEADLESS=true node run.js /tmp/playwright-check-*.js
   ```

## Setup (First Time)

```bash
cd $SKILL_DIR && npm run setup
```

## Execution Patterns

### Browser Check — Page Validation

```javascript
// /tmp/playwright-check-page.js
const { chromium } = require('playwright');
const helpers = require('./lib/helpers');

const TARGET_URL = 'http://localhost:3001'; // Auto-detected or user-provided
const HEADLESS = helpers.resolveHeadless();

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await helpers.createContext(browser);
  const page = await context.newPage();

  try {
    const response = await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    console.log('HTTP Status:', response?.status());

    // Wait for hydration — selector first, timeout fallback
    try {
      await page.waitForSelector('h1', { timeout: 8000 });
    } catch {
      await page.waitForTimeout(3000);
    }

    await helpers.dismissOverlays(page);

    // Run checks
    const results = [];
    results.push(await helpers.check(page, 'Page Title', 'Expected Title'));
    results.push(await helpers.checkWithHtmlFallback(page, 'Logo Alt', 'Company Logo'));

    // Report
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    results.filter(r => !r.passed).forEach(r => console.log(`  FAIL: ${r.label} — "${r.text}"`));

    await helpers.takeScreenshot(page, 'page-validation');
  } finally {
    await browser.close();
  }
})();
```

### Browser Check — Responsive / Multi-Viewport

```javascript
// /tmp/playwright-check-responsive.js
const { chromium } = require('playwright');
const helpers = require('./lib/helpers');

const TARGET_URL = 'http://localhost:3001';
const HEADLESS = helpers.resolveHeadless();

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: 100 });

  const viewports = [
    { name: 'Desktop',  width: 1920, height: 1080 },
    { name: 'Tablet',   width: 768,  height: 1024 },
    { name: 'Mobile',   width: 375,  height: 667 },
  ];

  for (const vp of viewports) {
    const context = await helpers.createContext(browser, { viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await helpers.dismissOverlays(page);
    await helpers.triggerLazyLoad(page);
    await helpers.takeScreenshot(page, `responsive-${vp.name}`);

    console.log(`${vp.name} (${vp.width}x${vp.height}) — done`);
    await context.close();
  }

  await browser.close();
})();
```

### API Check

```javascript
// /tmp/playwright-check-api.js
const { chromium } = require('playwright');

const BASE_URL = 'http://api-internal.staging.example.com';

(async () => {
  const browser = await chromium.launch({ headless: true }); // API checks always headless
  const context = await browser.newContext();
  const request = context.request;

  // GET with params
  const response = await request.get(`${BASE_URL}/product/v1/getProduct/12345`, {
    params: { shoppingMethod: 'INSTORE_PICKUP', storeId: '905', state: 'FL' },
    headers: { 'accept': 'application/json' },
  });

  console.log('Status:', response.status());
  const data = await response.json();
  console.log('Product:', data.name);

  // Validate with assertions
  if (!response.ok()) throw new Error(`API returned ${response.status()}`);
  if (!data.name) throw new Error('Missing product name');
  if (!data.price?.length) throw new Error('Missing price data');

  console.log('All API checks passed');
  await browser.close();
})();
```

### API Check with Fallback Chain

```javascript
// /tmp/playwright-check-api-fallback.js
const { chromium } = require('playwright');
const helpers = require('./lib/helpers');

const BASE_URL = 'http://api-internal.staging.example.com';
const PRODUCT_IDS = ['172976750', '228615750', '189674750'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const request = context.request;

  const result = await helpers.withFallback(
    async (itemId) => {
      const res = await request.get(`${BASE_URL}/product/v1/getProduct/${itemId}`, {
        params: { shoppingMethod: 'INSTORE_PICKUP', storeId: '905' },
        headers: { 'accept': 'application/json' },
      });
      if (!res.ok()) return { success: false };
      return { success: true, data: await res.json() };
    },
    PRODUCT_IDS,
  );

  if (result.success) {
    console.log(`Product found (ID: ${result.usedId}):`, result.data.name);
    console.log(`Attempted IDs: ${result.attemptedIds.join(', ')}`);
  } else {
    console.error('All product IDs failed:', result.attemptedIds);
  }

  await browser.close();
})();
```

### Parallel Browser Checks

```javascript
// /tmp/playwright-check-parallel.js
const { chromium } = require('playwright');
const helpers = require('./lib/helpers');

const HEADLESS = helpers.resolveHeadless();
const TEST_CASES = [
  { id: 'TC01', name: 'Homepage', url: 'https://example.com/', expect: 'Welcome' },
  { id: 'TC02', name: 'About',    url: 'https://example.com/about', expect: 'About Us' },
  { id: 'TC03', name: 'Contact',  url: 'https://example.com/contact', expect: 'Contact' },
];

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS });

  const results = await helpers.runPool(
    TEST_CASES,
    async (tc, page) => {
      const start = Date.now();
      const checks = [];

      const res = await page.goto(tc.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      checks.push({ label: 'HTTP Status', text: '200', passed: res?.status() === 200 });

      await helpers.dismissOverlays(page);
      checks.push(await helpers.check(page, 'Expected Text', tc.expect));

      return { testId: tc.id, name: tc.name, checks, durationMs: Date.now() - start };
    },
    browser,
    3, // concurrency
  );

  const report = helpers.generateMarkdownReport(results, 'PROD', 'https://example.com');
  require('fs').writeFileSync('/tmp/validation-report.md', report);
  console.log('Report written to /tmp/validation-report.md');

  // Summary
  const total = results.reduce((s, r) => s + r.checks.length, 0);
  const passed = results.reduce((s, r) => s + r.checks.filter(c => c.passed).length, 0);
  console.log(`\n${passed}/${total} checks passed`);

  await browser.close();
})();
```

## Inline Execution (Quick Tasks)

For quick one-off checks, use inline code without creating a file:

```bash
cd $SKILL_DIR && node run.js "
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:3001');
console.log('Title:', await page.title());
await page.screenshot({ path: '/tmp/quick-screenshot.png', fullPage: true });
await browser.close();
"
```

For headless inline:
```bash
cd $SKILL_DIR && HEADLESS=true node run.js "
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3001');
console.log('Title:', await page.title());
await browser.close();
"
```

**When to use inline vs files:**
- **Inline**: Quick screenshot, check if element exists, get page title
- **Files**: Multi-step validation, responsive checks, anything user might re-run

## Available Helpers

```javascript
const helpers = require('./lib/helpers');

// Browser launch
helpers.resolveHeadless()                   // → true/false from env/CLI
helpers.createContext(browser, options)      // Context with resource blocking + headers
helpers.getExtraHeadersFromEnv()            // Custom headers from env vars

// Page helpers
helpers.dismissOverlays(page)               // Hide cookie banners, modals, surveys
helpers.triggerLazyLoad(page)               // Scroll to trigger lazy content

// Checks
helpers.check(page, label, text)            // Simple pass/fail text check
helpers.checkWithHtmlFallback(page, l, t)   // Text check with HTML attribute fallback
helpers.textExists(page, text)              // Boolean: is text on page?

// Resilience
helpers.withFallback(fn, ids)               // Try IDs until one succeeds
helpers.validateDegraded(actual, expected, label) // Log degradation warning

// Dev servers
helpers.detectDevServers(extraPorts)        // Scan ports for running servers

// Output
helpers.takeScreenshot(page, name, dir)     // Timestamped screenshot
helpers.generateMarkdownReport(results, env, url) // Markdown validation report

// Parallelism
helpers.runPool(tasks, fn, browser, concurrency)  // Bounded parallel execution
```

## Custom HTTP Headers

Identify automated traffic to your backend:

```bash
# Single header
PW_HEADER_NAME=X-Automated-By PW_HEADER_VALUE=playwright-skill \
  cd $SKILL_DIR && node run.js /tmp/my-check.js

# Multiple headers
PW_EXTRA_HEADERS='{"X-Automated-By":"playwright","X-Debug":"true"}' \
  cd $SKILL_DIR && node run.js /tmp/my-check.js
```

Headers are automatically applied when using `helpers.createContext()`.

## Advanced Usage

For comprehensive Playwright API documentation, see [API_REFERENCE.md](API_REFERENCE.md):

- Complete locator reference (all 7 built-in locator types + filtering/chaining)
- Full assertion catalog (auto-retrying, synchronous, soft, polling)
- Network interception & mocking
- Authentication patterns (storage state, API auth, multi-role)
- Zod schema validation for API responses
- Degraded mode / custom reporter for CI
- Heuristic validation for dynamic content
- Page Object Model
- Fixtures
- CI/CD integration (GitHub Actions, traces, sharding)

## Example Interactions

```
User: "Test if the marketing page looks good"

Claude: Let me first detect running servers...
[Runs: detectDevServers()]
[Output: Found server on port 3001]
Found your dev server at http://localhost:3001.
[Writes responsive check to /tmp/playwright-check-marketing.js]
[Runs: cd $SKILL_DIR && node run.js /tmp/playwright-check-marketing.js]
[Shows screenshots from /tmp/ for desktop, tablet, mobile]
```

```
User: "Check the product API for item 12345"

Claude: I'll write an API check for that endpoint.
[Writes API check to /tmp/playwright-check-api.js]
[Runs: cd $SKILL_DIR && node run.js /tmp/playwright-check-api.js]
[Reports: Status 200, product name, price, schema validation results]
```

```
User: "Run the checks headless"

Claude: Running in headless mode.
[Runs: cd $SKILL_DIR && HEADLESS=true node run.js /tmp/playwright-check-*.js]
```

## Troubleshooting

**Playwright not installed:**
```bash
cd $SKILL_DIR && npm run setup
```

**Browser doesn't open:**
Check that `HEADLESS` is not set to `true`. Default is visible browser.

**Element not found:**
Add a wait: `await page.waitForSelector('.element', { timeout: 10000 })`

**Module not found:**
Ensure running from skill directory via `run.js`, which handles module resolution.

## Tips

- **Detect servers FIRST** — always run `detectDevServers()` before writing test code for localhost
- **Never use `networkidle`** — fragile with analytics and tracking; prefer `domcontentloaded`
- **Wait for selectors, not time** — `waitForSelector` with timeout fallback, not `waitForTimeout` alone
- **Use `getByRole` / `getByText`** — prefer user-facing locators over CSS selectors
- **Fallback chains** — never depend on a single test product; always provide alternatives
- **Dismiss overlays via JS** — don't click close buttons; inject JS to hide/remove
- **Block resources** — `createContext` blocks fonts/media by default for speed
- **Screenshots to /tmp** — all output goes to `/tmp`, never to the user's project
