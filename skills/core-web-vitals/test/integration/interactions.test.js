'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { collectCWV } = require('../../lib/cwv-collector');
const { startServer } = require('../helpers/server');
const { launchChromium } = require('../helpers/browser');

let srv;
let browser;

before(async () => {
  srv = await startServer();
  browser = await launchChromium();
});

after(async () => {
  if (browser) await browser.close();
  if (srv) await srv.close();
});

async function newPage(file) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${srv.origin}/${file}`);
  return page;
}

test('simulation never clicks a link', async () => {
  const page = await newPage('link-cover.html');
  const r = await collectCWV(page, { simulate: true, waitAfterLoad: 500 });
  assert.match(page.url(), /link-cover\.html$/);
  assert.ok(r.metrics.INP, 'INP still captured from a safe click or key press');
});

test('self-navigating page returns warning instead of throwing', async () => {
  const page = await newPage('self-navigate.html');
  const r = await collectCWV(page, { simulate: true, waitAfterLoad: 1500 });
  assert.ok(r.warnings.some((w) => w.includes('navigated')));
  assert.match(r.url, /self-navigate\.html$/);
  assert.equal(typeof r.metrics, 'object');
  assert.ok(r.metrics.TTFB || r.metrics.FCP, 'early metrics from the original document are kept');
});

test('interact callback drives INP for a specific interaction', async () => {
  const page = await newPage('button.html');
  const r = await collectCWV(page, { interact: (p) => p.click('#buy'), waitAfterLoad: 500 });
  assert.match(r.metrics.INP.attribution.interactionTarget, /#buy$/);
  assert.ok(r.metrics.INP.value >= 100);
});

test('warnings is an empty array on a clean run', async () => {
  const page = await newPage('basic.html');
  const r = await collectCWV(page, { simulate: false, waitAfterLoad: 300 });
  assert.deepEqual(r.warnings, []);
});

test('same-document URL change is not treated as navigation', async () => {
  const page = await newPage('pushstate.html');
  const r = await collectCWV(page, { interact: (p) => p.click('#route'), waitAfterLoad: 500 });
  assert.match(page.url(), /\/routed$/);
  assert.deepEqual(r.warnings, []);
  assert.ok(r.metrics.INP);
});

test('interact errors are rethrown, not reported as navigation', async () => {
  const page = await newPage('basic.html');
  await assert.rejects(
    collectCWV(page, {
      interact: (p) => p.waitForURL('**/never', { timeout: 300 }),
      waitAfterLoad: 200,
    }),
    (err) => err.name === 'TimeoutError',
  );
});

test('meta refresh before collection does not crash', async () => {
  for (let i = 0; i < 5; i++) {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${srv.origin}/meta-refresh.html`, { waitUntil: 'domcontentloaded' });
    const r = await collectCWV(page, { simulate: false, waitAfterLoad: 300 });
    if (r.warnings.some((w) => w.includes('redirected'))) {
      assert.match(r.url, /\/basic\.html$/);
    }
  }
});

test('page-owned webVitals global is ignored', async () => {
  const page = await newPage('own-webvitals.html');
  const r = await collectCWV(page, { simulate: false, waitAfterLoad: 500 });
  assert.ok(r.metrics.LCP.attribution, 'attribution comes from the pinned library');
  assert.ok(r.metrics.LCP.breakdown);
  assert.equal(await page.evaluate(() => typeof window.webVitals.onLCP), 'function');
});
