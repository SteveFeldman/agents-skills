'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { collectCWV, createMeasuredPage, measureMultipleUrls } = require('../../lib/cwv-collector');
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

test('mobile preset emulates device and records conditions', async () => {
  const { context, page, conditions } = await createMeasuredPage(browser, 'mobile');
  try {
    await page.goto(`${srv.origin}/basic.html`);
    // basic.html has no viewport meta, so innerWidth is the 980px layout viewport; screen.width is the device width
    assert.equal(await page.evaluate(() => screen.width), 412);
    const r = await collectCWV(page, { conditions, simulate: false, waitAfterLoad: 500 });
    assert.equal(r.conditions.preset, 'mobile');
    assert.equal(r.conditions.method, 'devtools');
    assert.deepEqual(r.conditions.viewport, { width: 412, height: 823 });
    assert.match(r.conditions.userAgent, /moto g power/);
  } finally {
    await context.close();
  }
});

test('collectCWV without conditions records unspecified', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${srv.origin}/basic.html`);
    const r = await collectCWV(page, { simulate: false, waitAfterLoad: 300 });
    assert.equal(r.conditions.preset, 'unspecified');
    assert.deepEqual(r.warnings, []);
  } finally {
    await context.close();
  }
});

// Chrome's navigation-timing responseStart is not shifted by CDP latency
// emulation on loopback, so compare end-to-end navigation time instead.
async function navigationMs(preset) {
  const { context, page } = await createMeasuredPage(browser, preset);
  try {
    const t0 = Date.now();
    await page.goto(`${srv.origin}/basic.html`, { waitUntil: 'load' });
    return Date.now() - t0;
  } finally {
    await context.close();
  }
}

test('mobile throttling slows navigation versus none', async () => {
  const none = await navigationMs('none');
  const mobile = await navigationMs('mobile');
  assert.ok(mobile >= none + 100, `mobile ${mobile}ms vs none ${none}ms (150ms RTT)`);
});

test('measureMultipleUrls keeps going and records conditions on error entries', async () => {
  const rs = await measureMultipleUrls(browser, ['http://127.0.0.1:9/unreachable', `${srv.origin}/basic.html`],
    { preset: 'mobile', simulate: false, waitAfterLoad: 500 });
  assert.ok(rs[0].error);
  assert.equal(rs[0].conditions.preset, 'mobile');
  assert.deepEqual(rs[0].warnings, []);
  assert.ok(rs[1].metrics.LCP);
  assert.equal(rs[1].conditions.preset, 'mobile');
});
