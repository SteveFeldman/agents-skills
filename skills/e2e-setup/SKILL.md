---
name: e2e-setup
description: "Set up end-to-end testing infrastructure with Playwright, including page objects, CI integration, and test data management"
---

# End-to-End Testing Setup

Set up end-to-end testing infrastructure for any web application or service. Defaults to Playwright unless the project already uses another E2E framework.

## Instructions

Follow this systematic approach to implement E2E testing: **$ARGUMENTS**

### 1. Detect Stack and Existing Setup

- Identify the application type (web app, API service, full-stack)
- Check for existing E2E frameworks already installed (Cypress, Selenium, Puppeteer, TestCafe)
- If an existing framework is found, use it instead of Playwright
- Review the project's tech stack (React, Next.js, Vue, etc.) to inform configuration
- Check for existing test scripts in package.json

### 2. Install Playwright

If no existing E2E framework is detected:

```bash
npm install -D @playwright/test
npx playwright install
```

Create `playwright.config.ts`:

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. Create Test Directory Structure

```
e2e/
├── tests/
│   ├── auth/
│   └── user-flows/
├── fixtures/
├── page-objects/
└── helpers/
```

Organize tests by feature or user journey.

### 4. Implement Page Objects

Create page object classes for maintainability and reuse:

```javascript
// e2e/page-objects/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#login-btn');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
```

### 5. Set Up Test Data and Fixtures

- Create test fixtures for common data (users, products, etc.)
- Use Playwright fixtures for shared setup/teardown:

```javascript
// e2e/fixtures/auth.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';

export const test = base.extend({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
});
```

- Set up database seeding or API-based test data creation if needed
- Implement cleanup strategies to keep test environments stable

### 6. Write the First Test

Create a test for the most critical user journey:

```javascript
// e2e/tests/auth/login.spec.ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth';

test('user can log in successfully', async ({ loginPage, page }) => {
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
});

test('shows error for invalid credentials', async ({ loginPage, page }) => {
  await loginPage.goto();
  await loginPage.login('test@example.com', 'wrong-password');
  await expect(page.locator('.error-message')).toBeVisible();
});
```

### 7. Configure Error Handling and Debugging

- Screenshots on failure are already configured in `playwright.config.ts`
- Enable trace collection on first retry for debugging flaky tests
- Add video recording for CI if needed:

```javascript
use: {
  video: process.env.CI ? 'on-first-retry' : 'off',
}
```

- Configure retries for CI environments to handle transient failures

### 8. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

### 9. Set Up CI Integration

**GitHub Actions:**

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

### 10. Document and Hand Off

- Add a brief section to the project README or a dedicated `e2e/README.md` explaining:
  - How to run tests locally (`npm run test:e2e`)
  - How to debug tests (`npm run test:e2e:debug`)
  - How to add new tests (create a spec file, use page objects)
  - Where test reports are stored
- Verify all tests pass locally before committing

Start with critical user journeys and gradually expand coverage. Focus on stable, maintainable tests that provide real value.
