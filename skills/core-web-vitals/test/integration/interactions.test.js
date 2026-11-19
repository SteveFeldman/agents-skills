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
  assert.equal(typeof r.metrics, 'object');
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
