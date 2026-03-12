#!/usr/bin/env node
/**
 * Universal Playwright Executor
 *
 * Executes Playwright automation code from:
 *   File path:   node run.js script.js
 *   Inline code: node run.js 'await page.goto("...")'
 *   Stdin:       cat script.js | node run.js
 *
 * Options (via env vars):
 *   HEADLESS=true       Run browser without UI (default: false — visible browser)
 *   SLOW_MO=100         Slow down actions by N ms
 *   PW_HEADER_NAME      Single custom header name
 *   PW_HEADER_VALUE     Single custom header value
 *   PW_EXTRA_HEADERS    JSON object of multiple custom headers
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

process.chdir(__dirname);

function checkPlaywrightInstalled() {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}

function installPlaywright() {
  console.log('Playwright not found. Installing...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    execSync('npx playwright install chromium', { stdio: 'inherit', cwd: __dirname });
    console.log('Playwright installed successfully');
    return true;
  } catch (e) {
    console.error('Failed to install Playwright:', e.message);
    console.error('Run manually: cd', __dirname, '&& npm run setup');
    return false;
  }
}

function getCodeToExecute() {
  const args = process.argv.slice(2);

  if (args.length > 0 && fs.existsSync(args[0])) {
    const filePath = path.resolve(args[0]);
    console.log(`Executing file: ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  if (args.length > 0) {
    console.log('Executing inline code');
    return args.join(' ');
  }

  if (!process.stdin.isTTY) {
    return fs.readFileSync(0, 'utf8');
  }

  console.error('No code to execute');
  console.error('Usage:');
  console.error('  node run.js script.js');
  console.error('  node run.js "code here"');
  console.error('  cat script.js | node run.js');
  console.error('');
  console.error('Options (env vars):');
  console.error('  HEADLESS=true         Run headless (default: false)');
  console.error('  SLOW_MO=100           Slow down by N ms');
  process.exit(1);
}

function cleanupOldTempFiles() {
  try {
    const files = fs.readdirSync(__dirname);
    files
      .filter(f => f.startsWith('.temp-execution-') && f.endsWith('.js'))
      .forEach(file => {
        try { fs.unlinkSync(path.join(__dirname, file)); } catch {}
      });
  } catch {}
}

function wrapCodeIfNeeded(code) {
  const hasRequire = code.includes('require(');
  const hasAsyncIIFE = code.includes('(async () => {') || code.includes('(async()=>{');

  if (hasRequire && hasAsyncIIFE) return code;

  if (!hasRequire) {
    return `
const { chromium, firefox, webkit, devices } = require('playwright');
const helpers = require('./lib/helpers');

const __extraHeaders = helpers.getExtraHeadersFromEnv();

function getContextOptionsWithHeaders(options = {}) {
  if (!__extraHeaders) return options;
  return {
    ...options,
    extraHTTPHeaders: {
      ...__extraHeaders,
      ...(options.extraHTTPHeaders || {})
    }
  };
}

(async () => {
  try {
    ${code}
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
})();
`;
  }

  if (!hasAsyncIIFE) {
    return `
(async () => {
  try {
    ${code}
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
})();
`;
  }

  return code;
}

async function main() {
  console.log('Playwright Skill — Universal Executor\n');

  cleanupOldTempFiles();

  if (!checkPlaywrightInstalled()) {
    if (!installPlaywright()) process.exit(1);
  }

  const rawCode = getCodeToExecute();
  const code = wrapCodeIfNeeded(rawCode);

  const tempFile = path.join(__dirname, `.temp-execution-${Date.now()}.js`);

  try {
    fs.writeFileSync(tempFile, code, 'utf8');
    console.log('Starting automation...\n');
    require(tempFile);
  } catch (error) {
    console.error('Execution failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
