'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectCWV, WEB_VITALS_VERSION } = require('../../lib/cwv-collector');
const { startServer } = require('../helpers/server');
const { launchChromium } = require('../helpers/browser');

test('collects LCP/FCP/TTFB on a page whose CSP forbids external and inline scripts', async () => {
  const srv = await startServer({
    '/basic.html': { headers: { 'Content-Security-Policy': "script-src 'none'" } },
  });
  const browser = await launchChromium();
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${srv.origin}/basic.html`);
    const r = await collectCWV(page, { simulate: false, waitAfterLoad: 500 });
    assert.ok(r.metrics.LCP?.value > 0);
    assert.ok(r.metrics.FCP?.value > 0);
    assert.ok(r.metrics.TTFB?.value >= 0);
  } finally {
    await browser.close();
    await srv.close();
  }
});

test('injection makes no network request for web-vitals', async () => {
  const srv = await startServer();
  const browser = await launchChromium();
  try {
    const page = await (await browser.newContext()).newPage();
    const urls = [];
    page.on('request', (req) => urls.push(req.url()));
    await page.goto(`${srv.origin}/basic.html`);
    await collectCWV(page, { simulate: false, waitAfterLoad: 300 });
    assert.ok(urls.length > 0);
    assert.deepEqual(urls.filter((u) => u.includes('web-vitals')), []);
  } finally {
    await browser.close();
    await srv.close();
  }
});

test('WEB_VITALS_VERSION is pinned', () => assert.equal(WEB_VITALS_VERSION, '6.2.3'));
