'use strict';

const path = require('node:path');

/**
 * Resolve playwright from skills/playwright-dev, then from CWV_PLAYWRIGHT_DIR.
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchChromium() {
  const paths = [path.join(__dirname, '../../../playwright-dev')];
  if (process.env.CWV_PLAYWRIGHT_DIR) paths.push(process.env.CWV_PLAYWRIGHT_DIR);
  let resolved;
  try {
    resolved = require.resolve('playwright', { paths });
  } catch {
    throw new Error(
      'Playwright not found — run: cd skills/playwright-dev && npm run setup' +
        ' (or set CWV_PLAYWRIGHT_DIR to a directory containing node_modules/playwright)',
    );
  }
  return require(resolved).chromium.launch({ headless: true });
}

module.exports = { launchChromium };
