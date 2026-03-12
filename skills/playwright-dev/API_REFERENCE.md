# Playwright Skill — API Reference

Full Playwright API reference and advanced patterns. For quick-start execution patterns, see [SKILL.md](SKILL.md).

---

## Table of Contents

- [Project Configuration](#project-configuration)
- [Locators (Complete Reference)](#locators-complete-reference)
- [Assertions (Complete Reference)](#assertions-complete-reference)
- [Network Interception & Mocking](#network-interception--mocking)
- [Authentication Patterns](#authentication-patterns)
- [Zod Schema Validation](#zod-schema-validation)
- [Degraded Mode & Custom Reporter](#degraded-mode--custom-reporter)
- [Heuristic Validation](#heuristic-validation)
- [Fixtures](#fixtures)
- [Page Object Model](#page-object-model)
- [CI/CD Integration](#cicd-integration)
- [Anti-Patterns](#anti-patterns)

---

## Project Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './integration',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL || 'https://staging.example.com',
    extraHTTPHeaders: { 'Accept': 'application/json' },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

**Key decisions:**
- `forbidOnly` in CI prevents `.only` from sneaking through
- `retries: 2` in CI only — locally, investigate failures instead of retrying
- `trace: 'on-first-retry'` for CI debugging without always-on storage cost
- Timeout: 15s for prod, 30s for staging/UAT

### Environment Configuration

```typescript
// constants.ts
export const ENVS = {
  uat:  { key: 'uat',  baseUrl: 'https://uat.example.com',  timeout: 30_000 },
  prod: { key: 'prod', baseUrl: 'https://www.example.com',  timeout: 15_000 },
};

export const CONFIG = {
  BEARER_TOKEN: process.env.BEARER_TOKEN,
  DEGRADED_MODE: process.env.DEGRADED_MODE !== 'false',
  TESTING_BRANCH: process.env.TESTING_BRANCH || '',
};
```

---

## Locators (Complete Reference)

### Built-in Locators (Priority Order)

| Locator | Use Case | Example |
|---------|----------|---------|
| `getByRole()` | Interactive elements (buttons, links, checkboxes) | `page.getByRole('button', { name: 'Submit' })` |
| `getByText()` | Non-interactive content (div, span, p) | `page.getByText('Welcome', { exact: true })` |
| `getByLabel()` | Form controls with labels | `page.getByLabel('Email')` |
| `getByPlaceholder()` | Inputs with placeholder text | `page.getByPlaceholder('name@example.com')` |
| `getByAltText()` | Images with alt attributes | `page.getByAltText('product photo')` |
| `getByTitle()` | Elements with title attributes | `page.getByTitle('Issues count')` |
| `getByTestId()` | Explicit test identifiers | `page.getByTestId('submit-btn')` |

### `getByRole` — Common Roles

```typescript
page.getByRole('button', { name: 'Submit' })
page.getByRole('link', { name: 'Home' })
page.getByRole('heading', { name: 'Welcome', level: 1 })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('checkbox', { name: 'Agree' })
page.getByRole('combobox', { name: 'Country' })
page.getByRole('listitem')
page.getByRole('navigation')
page.getByRole('dialog')
page.getByRole('alert')
```

### `getByText` — Matching Modes

```typescript
page.getByText('Welcome')                    // substring match (default)
page.getByText('Welcome', { exact: true })   // exact match
page.getByText(/welcome, [A-Za-z]+$/i)       // regex match
```

### Filtering & Chaining

```typescript
// Filter by text
await page.getByRole('listitem')
  .filter({ hasText: 'Product 2' })
  .getByRole('button', { name: 'Add to cart' })
  .click();

// Filter by child element
await page.getByRole('listitem')
  .filter({ has: page.getByRole('heading', { name: 'Product 2' }) })
  .click();

// Exclude items
await expect(page.getByRole('listitem')
  .filter({ hasNotText: 'Out of stock' }))
  .toHaveCount(5);

// Filter by visibility
await page.locator('button').filter({ visible: true }).click();

// AND — both conditions must match
const btn = page.getByRole('button').and(page.getByTitle('Subscribe'));

// OR — either condition matches
const target = page.getByRole('button', { name: 'New' })
  .or(page.getByText('Confirm'));
await expect(target.first()).toBeVisible();
```

### List Operations

```typescript
await expect(page.getByRole('listitem')).toHaveCount(3);
await expect(page.getByRole('listitem')).toHaveText(['apple', 'banana', 'orange']);

const second = page.getByRole('listitem').nth(1);

for (const item of await page.getByRole('listitem').all()) {
  console.log(await item.textContent());
}
```

### Multi-Selector Fallback

When elements render differently across environments:

```typescript
const addToCart = page.locator([
  'button:has-text("Add to Cart")',
  'button:has-text("Add To Cart")',
  '[data-testid="add-to-cart"]',
].join(', '));

expect(await addToCart.count()).toBeGreaterThan(0);
```

### Custom Test ID Attribute

```typescript
// playwright.config.ts
export default defineConfig({
  use: { testIdAttribute: 'data-pw' },
});
```

---

## Assertions (Complete Reference)

### Auto-Retrying Assertions (Async) — Always Prefer These

**Locator:**
- `toBeVisible()` / `toBeHidden()`
- `toBeEnabled()` / `toBeDisabled()`
- `toBeChecked()`
- `toBeFocused()`
- `toBeEditable()`
- `toBeEmpty()`
- `toBeAttached()`
- `toBeInViewport()`
- `toHaveText()` / `toContainText()`
- `toHaveValue()` / `toHaveValues()`
- `toHaveAttribute()`
- `toHaveClass()` / `toContainClass()`
- `toHaveCSS()`
- `toHaveCount()`
- `toHaveId()`
- `toHaveRole()`
- `toHaveScreenshot()`
- `toHaveAccessibleName()` / `toHaveAccessibleDescription()`

**Page:**
- `toHaveTitle()`
- `toHaveURL()`
- `toHaveScreenshot()`

**API Response:**
- `toBeOK()`

### Non-Retrying (Synchronous)

For values already extracted from the page:
- `toBe()`, `toEqual()`, `toStrictEqual()`
- `toBeTruthy()`, `toBeFalsy()`, `toBeNull()`, `toBeDefined()`
- `toContain()`, `toContainEqual()`
- `toMatch()`
- `toHaveLength()`, `toHaveProperty()`
- `toBeGreaterThan()`, `toBeLessThan()`

### Web-First vs Snapshot (Critical Distinction)

```typescript
// GOOD — auto-waits and retries
await expect(page.getByText('Welcome')).toBeVisible();

// BAD — snapshot, no retry, flaky
expect(await page.getByText('Welcome').isVisible()).toBe(true);
```

### Soft Assertions

Collect all failures without stopping:

```typescript
await expect.soft(page.getByTestId('status')).toHaveText('Active');
await expect.soft(page.getByTestId('count')).toHaveText('5');
// Test continues — all failures reported at end
```

### Polling & Retry Blocks

```typescript
// Poll an async function
await expect.poll(async () => {
  const res = await request.get('/api/status');
  return (await res.json()).ready;
}).toBe(true);

// Retry a block of code
await expect(async () => {
  const res = await request.get('/api/data');
  expect(res.status()).toBe(200);
}).toPass({ timeout: 10_000 });
```

### Custom Expect Messages

```typescript
await expect(page.getByTestId('price'), 'Product price should be visible').toBeVisible();
```

### Result Classification Pattern

For validation suites with nuanced reporting:

```typescript
type CheckResult = {
  label: string;
  text: string;
  passed: boolean;
  warn?: boolean;       // passed but with caveat (e.g., found in HTML only)
  warnReason?: string;
  softFail?: boolean;   // primary failed but fallback succeeded
  softFailReason?: string;
};
```

---

## Network Interception & Mocking

### Mock API Responses

```typescript
await page.route('**/api/products', route =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: testProducts }),
  })
);
```

### Block Resources

```typescript
await page.route(/(png|jpeg|gif|svg)$/, route => route.abort());
await context.route(/.css$/, route => route.abort());
```

### Modify Requests

```typescript
await page.route('**/api/**', async route => {
  await route.continue({
    headers: {
      ...route.request().headers(),
      'X-Custom-Header': 'test-value',
    },
  });
});
```

### Modify Responses

```typescript
await page.route('**/api/data', async route => {
  const response = await route.fetch();
  const json = await response.json();
  json.injectedField = 'test';
  await route.fulfill({ response, json });
});
```

### Wait for Network Events

```typescript
const responsePromise = page.waitForResponse('**/api/products');
await page.getByRole('button', { name: 'Load' }).click();
const response = await responsePromise;
expect(response.status()).toBe(200);
```

### URL Pattern Matching

- `*` matches characters except `/`
- `**` matches characters including `/`
- `{}` matches options: `**/*.{png,jpg,jpeg}`

---

## Authentication Patterns

### Reuse Auth State (Recommended)

```typescript
// auth.setup.ts
import { test as setup } from '@playwright/test';
const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    dependencies: ['setup'],
    use: { storageState: 'playwright/.auth/user.json' },
  },
],
```

### API-Based Auth (Faster)

```typescript
setup('authenticate', async ({ request }) => {
  await request.post('/api/login', {
    form: { email: process.env.TEST_EMAIL!, password: process.env.TEST_PASSWORD! },
  });
  await request.storageState({ path: authFile });
});
```

### Multiple Roles

```typescript
test.use({ storageState: 'playwright/.auth/admin.json' });

// Or multiple contexts in one test
const adminCtx = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
const userCtx = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
```

### Reset Auth

```typescript
test.use({ storageState: { cookies: [], origins: [] } });
```

**Always add `playwright/.auth` to `.gitignore`.**

---

## Zod Schema Validation

Validate API response structure:

```typescript
import { z } from 'zod';

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.object({ id: z.string(), name: z.string() }),
  price: z.array(z.object({ price: z.number(), type: z.string() })),
  shoppingOptions: z.array(z.object({
    eligible: z.boolean(),
    type: z.string(),
    selected: z.boolean(),
  })),
  skuId: z.string(),
  stockLevel: z.array(z.object({ stock: z.number() })),
  images: z.array(z.object({ url: z.string() })).min(1),
});

test('product response matches schema', async ({ request }) => {
  const response = await request.get(`/product/v1/getProduct/${ITEM_ID}`);
  const data = await response.json();
  const result = productSchema.safeParse(data);
  expect(result.success).toBe(true);
  if (!result.success) console.log('Schema errors:', result.error.issues);
});
```

---

## Degraded Mode & Custom Reporter

When checks should report failures without failing CI:

```typescript
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

class DegradedReporter implements Reporter {
  private failedTests: { test: TestCase; result: TestResult }[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'failed' || result.status === 'timedOut') {
      this.failedTests.push({ test, result });
      console.log(`  DEGRADED: ${test.title}`);
    }
  }

  onEnd(result: FullResult) {
    if (this.failedTests.length > 0) {
      console.log(`\n  ${this.failedTests.length} degraded test(s) — not blocking CI`);
      for (const { test } of this.failedTests) {
        console.log(`    - ${test.title}`);
      }
    }
    result.status = 'passed';
    process.exit(0);
  }
}

export default DegradedReporter;
```

### Degraded Validation in Tests

```typescript
const isValid = helpers.validateDegraded(data.stockLevel, expectedStock, 'Stock Level');
if (!isValid && CONFIG.DEGRADED_MODE) {
  test.skip(true, 'Stock level degraded on this branch');
}
```

---

## Heuristic Validation

Validate dynamic content without hardcoded values:

```typescript
const HEURISTIC_PATTERNS = {
  productTypes: /wine|beer|ale|whiskey|bourbon|vodka|gin|rum|tequila/i,
  regions: /bordeaux|napa|rioja|barossa|tuscany|champagne/i,
  tasteProfiles: /fruit|berry|citrus|vanilla|oak|spice|herb|floral/i,
  volumeUnits: /\d+\s*(ml|L|oz|cl|gal)/i,
  ratingSources: /wine spectator|wine advocate|robert parker|decanter/i,
};

function validateWithHeuristics(value, category) {
  const pattern = HEURISTIC_PATTERNS[category];
  if (!pattern) return { isValid: false };
  return { isValid: pattern.test(value), matchedPattern: value.match(pattern)?.[0] };
}
```

---

## Fixtures

### Custom Fixtures

```typescript
import { test as base, Page } from '@playwright/test';

type CheckFixtures = {
  authenticatedPage: Page;
  apiContext: APIRequestContext;
};

export const test = base.extend<CheckFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name=email]', process.env.TEST_EMAIL!);
    await page.fill('[name=password]', process.env.TEST_PASSWORD!);
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    await use(page);
  },

  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.API_BASE_URL,
      extraHTTPHeaders: { 'Authorization': `Bearer ${process.env.API_TOKEN}` },
    });
    await use(ctx);
    await ctx.dispose();
  },
});
```

### Worker-Scoped Fixtures

```typescript
export const test = base.extend<{}, { sharedAccount: Account }>({
  sharedAccount: [async ({}, use, workerInfo) => {
    const account = await createTestAccount(workerInfo.workerIndex);
    await use(account);
    await deleteTestAccount(account.id);
  }, { scope: 'worker' }],
});
```

### Automatic Fixtures

```typescript
saveLogs: [async ({}, use, testInfo) => {
  const logs = [];
  await use();
  if (testInfo.status === 'failed') {
    const logFile = testInfo.outputPath('logs.txt');
    require('fs').writeFileSync(logFile, logs.join('\n'));
    testInfo.attachments.push({ name: 'logs', path: logFile, contentType: 'text/plain' });
  }
}, { auto: true }],
```

---

## Page Object Model

```typescript
class ProductPage {
  readonly page: Page;
  readonly productName: Locator;
  readonly addToCartButton: Locator;
  readonly priceDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productName = page.getByRole('heading', { level: 1 });
    this.addToCartButton = page.getByRole('button', { name: 'Add to Cart' });
    this.priceDisplay = page.getByTestId('product-price');
  }

  async goto(itemId: string, storeId: string) {
    await this.page.goto(`/product/${itemId}?s=${storeId}`, {
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});
  }

  async getName() { return this.productName.textContent(); }
  async getPrice() { return this.priceDisplay.textContent(); }
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Playwright Checks
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npx playwright test
        env:
          CI: true
          BASE_URL: ${{ secrets.STAGING_URL }}
          API_TOKEN: ${{ secrets.API_TOKEN }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Traces for Debugging

```typescript
// Config — capture traces on retry only
use: { trace: 'on-first-retry' }

// View locally: npx playwright show-report
```

### Sharding

```yaml
strategy:
  matrix:
    shard: [1, 2, 3]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/3
```

### Retries

```typescript
// CI only
retries: process.env.CI ? 2 : 0,

// Per-suite
test.describe.configure({ retries: 2 });

// Detect retry in test
if (testInfo.retry) await cleanupTestData();
```

---

## Anti-Patterns

1. **Never use `networkidle`** — fragile with analytics, tracking, long-polling
2. **Never use `page.waitForTimeout()` as primary wait** — only as fallback after selector wait fails
3. **Never use CSS class selectors** for user-facing elements — use roles, text, or test IDs
4. **Never hardcode a single test product** without fallbacks — data changes
5. **Never click to dismiss modals** when JS injection works — avoids re-render race conditions
6. **Never snapshot assert** (`expect(await loc.isVisible()).toBe(true)`) — use web-first assertions that auto-retry
7. **Never run without resource blocking** in headless validation suites — block fonts/media for speed
8. **Never use `page.pause()` or `test.only` in CI** — use `forbidOnly` config to prevent it
9. **Never write test files to the skill directory or user's project** — use `/tmp`
10. **Never hardcode URLs** — parameterize with `TARGET_URL` constant or env var
