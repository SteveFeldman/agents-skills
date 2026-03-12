---
name: evinced-web-sdk
description: Use when adding accessibility scanning to existing Playwright checks via --evinced flag, when instrumenting browser tests for WCAG compliance, or when integrating Evinced SDK with Playwright scripts.
---

# Evinced Web SDK for Playwright

Instrument existing Playwright checks with Evinced accessibility scanning via the `--evinced` CLI flag.

## Critical Setup Order

**MUST set credentials BEFORE creating EvincedSDK instances:**

```javascript
const { EvincedSDK, setCredentials, setUploadToPlatformConfig } = require('@evinced/js-playwright-sdk');

// CLI flags
const useEvinced = process.argv.includes('--evinced');
const uploadToPlatform = process.argv.includes('--upload=TRUE');

// 1. FIRST: Set credentials (before ANY page/SDK operations)
await setCredentials({
  serviceId: process.env.EVINCED_SERVICE_ID,
  secret: process.env.EVINCED_API_KEY,
});

// 2. SECOND: Configure platform upload (default: false, use --upload=TRUE to enable)
setUploadToPlatformConfig({
  enableUploadToPlatform: uploadToPlatform,
});

// 3. THIRD: Create page, THEN create EvincedSDK
const page = await context.newPage();
const evincedService = new EvincedSDK(page);
```

**Wrong order = authentication failures. Credentials MUST be set globally first.**

## Integration Pattern

Add `--evinced` and `--upload=TRUE` flag support to any existing Playwright script:

```javascript
const useEvinced = process.argv.includes('--evinced');
const uploadToPlatform = process.argv.includes('--upload=TRUE');

// At script startup, before browser launch:
if (useEvinced) {
  const { setCredentials, setUploadToPlatformConfig } = require('@evinced/js-playwright-sdk');
  await setCredentials({
    serviceId: process.env.EVINCED_SERVICE_ID,
    secret: process.env.EVINCED_API_KEY,
  });
  setUploadToPlatformConfig({ enableUploadToPlatform: uploadToPlatform });
}

// After page creation, before navigation:
let evincedService = null;
if (useEvinced) {
  const { EvincedSDK } = require('@evinced/js-playwright-sdk');
  evincedService = new EvincedSDK(page);
  evincedService.testRunInfo.addLabel({ testName: 'My-Test-Name' });
  await evincedService.evStart({
    enableScreenshots: true,  // Capture screenshots of accessibility issues
  });
}

// ... existing page interactions ...

// After all interactions, before page close:
if (evincedService) {
  const issues = await evincedService.evStop();
  await evincedService.evSaveFile(issues, 'html', 'results/accessibility/report.html');
  console.log(`[EVINCED] Found ${issues.length} accessibility issues`);
}
```

## Continuous vs Single-Page Scanning

| Pattern | Use When |
|---------|----------|
| `evStart()` / `evStop()` | Test navigates, clicks, opens modals — captures DOM mutations |
| `evAnalyze()` | Single snapshot of current page state |

**Prefer continuous scanning** (`evStart/evStop`) for integration tests. It catches issues that appear during interactions.

## Triggering DOM Mutations

Evinced continuous mode captures accessibility issues as DOM changes. Interact with the page to expose hidden states:

```javascript
// Open modals, dropdowns, accordions
await page.click('[data-at="nearby-stores-button"]');
await page.waitForTimeout(500);
await page.click('[data-at="close-modal-button"]');

// Trigger form validation
await page.click('[data-at="add-to-cart-button"]');
await page.waitForTimeout(500);

// Expand accordions, reveal hidden content
await page.click('[data-at="product-details-accordion"]');
```

## Report Output

```javascript
// Save multiple formats for different consumers
await evincedService.evSaveFile(issues, 'html', 'report.html');   // Human-readable
await evincedService.evSaveFile(issues, 'json', 'report.json');   // CI integration
await evincedService.evSaveFile(issues, 'sarif', 'report.sarif'); // Code analysis tools
```

Output to `results/accessibility/{script-name}/` following project conventions.

## Environment Variables

```bash
export EVINCED_SERVICE_ID=<your-service-id>
export EVINCED_API_KEY=<your-api-key>
```

Platform upload is controlled via CLI flag `--upload=TRUE`, not environment variables.

## Package Installation

```bash
# From Evinced JFrog Artifactory (requires access)
npm install @evinced/js-playwright-sdk
```

Requires Playwright 1.25+.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Create EvincedSDK before setCredentials | Always call `setCredentials()` FIRST, before any SDK instantiation |
| evStop without evStart | Must call `evStart()` before `evStop()` |
| Forget to interact with page | DOM mutations trigger issue detection — click modals, forms, dropdowns |
| Missing screenshots in report | Add `enableScreenshots: true` to `evStart()` or `evAnalyze()` options |
| Accidentally uploading to platform | Default is NO upload. Use `--upload=TRUE` only when you want to upload |

## Quick Reference

```javascript
// CLI flags
const useEvinced = process.argv.includes('--evinced');
const uploadToPlatform = process.argv.includes('--upload=TRUE');

// SDK import
const { EvincedSDK, setCredentials, setUploadToPlatformConfig } = require('@evinced/js-playwright-sdk');

// Credentials (FIRST!)
await setCredentials({ serviceId: '...', secret: '...' });

// Platform upload (default: false, use --upload=TRUE to enable)
setUploadToPlatformConfig({ enableUploadToPlatform: uploadToPlatform });

// Create service (after page creation)
const evincedService = new EvincedSDK(page);

// Labels for reporting
evincedService.testRunInfo.addLabel({ testName: 'PDP-Test' });
evincedService.testRunInfo.customLabel({ environment: 'QA', browser: 'chromium' });

// Continuous scanning with screenshots
await evincedService.evStart({ enableScreenshots: true });
// ... interactions ...
const issues = await evincedService.evStop();

// Single analysis with screenshots
const issues = await evincedService.evAnalyze({ enableScreenshots: true });

// Save reports
await evincedService.evSaveFile(issues, 'html', 'path/report.html');
```
