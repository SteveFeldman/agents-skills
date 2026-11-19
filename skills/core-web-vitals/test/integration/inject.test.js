'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { collectCWV, WEB_VITALS_VERSION } = require('../../lib/cwv-collector');
const { startServer } = require('../helpers/server');
const { launchChromium } = require('../helpers/browser');

let srv;
let browser;

before(async () => {
  srv = await startServer({
    '/basic.html': { headers: { 'Content-Security-Policy': "script-src 'none'" } },
  });
  browser = await launchChromium();
});

after(async () => {
  if (browser) await browser.close();
  if (srv) await srv.close();
});

test('collects LCP/FCP/TTFB on a page whose CSP forbids external and inline scripts', async () => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${srv.origin}/basic.html`);
  const r = await collectCWV(page, { simulate: false, waitAfterLoad: 500 });
  assert.ok(r.metrics.LCP?.value > 0);
  assert.ok(r.metrics.FCP?.value > 0);
  assert.ok(r.metrics.TTFB?.value >= 0);
});

test('injection makes no network request for web-vitals', async () => {
  const page = await (await browser.newContext()).newPage();
  const urls = [];
  page.on('request', (req) => urls.push(req.url()));
  await page.goto(`${srv.origin}/basic.html`);
  await collectCWV(page, { simulate: false, waitAfterLoad: 300 });
  assert.ok(urls.length > 0);
  assert.deepEqual(urls.filter((u) => u.includes('web-vitals')), []);
});

test('WEB_VITALS_VERSION is pinned', () => assert.equal(WEB_VITALS_VERSION, '6.2.3'));

test('collected LCP carries a phase breakdown from real attribution', async () => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${srv.origin}/basic.html`);
  const r = await collectCWV(page, { simulate: false, waitAfterLoad: 500 });
  const b = r.metrics.LCP.breakdown;
  assert.ok(b, 'LCP.breakdown should be present');
  const lcpKeys = ['timeToFirstByte', 'resourceLoadDelay', 'resourceLoadDuration', 'elementRenderDelay'];
  assert.ok(b.phases.length > 0);
  for (const p of b.phases) assert.ok(lcpKeys.includes(p.key), p.key);
  assert.ok(lcpKeys.includes(b.dominant));
});
