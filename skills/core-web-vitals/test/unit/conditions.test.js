'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PRESETS, createMeasuredPage } = require('../../lib/cwv-collector');

test('presets carry the documented values', () => {
  assert.deepEqual(PRESETS.mobile.network, { latencyMs: 150, downloadKbps: 1638.4, uploadKbps: 750 });
  assert.equal(PRESETS.mobile.cpuSlowdown, 4);
  assert.deepEqual(PRESETS.mobile.context.viewport, { width: 412, height: 823 });
  assert.equal(PRESETS.mobile.context.deviceScaleFactor, 1.75);
  assert.equal(PRESETS.mobile.context.isMobile, true);
  assert.equal(PRESETS.desktop.network.latencyMs, 40);
  assert.equal(PRESETS.desktop.network.downloadKbps, 10240);
  assert.equal(PRESETS.desktop.cpuSlowdown, 1);
  assert.deepEqual(PRESETS.desktop.context.viewport, { width: 1350, height: 940 });
  assert.equal(PRESETS.none.network, null);
  assert.equal(PRESETS.mobile.label, 'Mobile (Moto G Power, Slow 4G, 4× CPU)');
  assert.equal(PRESETS.desktop.label, 'Desktop (1350×940, 40ms RTT, 10 Mbps)');
  assert.equal(PRESETS.none.label, 'No throttling (unthrottled host machine)');
});

test('createMeasuredPage rejects non-chromium for throttled presets', async () => {
  const fake = { browserType: () => ({ name: () => 'firefox' }) };
  await assert.rejects(createMeasuredPage(fake, 'mobile'), /Preset "mobile" requires Chromium/);
  await assert.rejects(createMeasuredPage(fake, 'desktop'), /requires Chromium/);
});

test('unknown preset name is rejected before the browser check', async () => {
  const fake = { browserType: () => ({ name: () => 'firefox' }) };
  await assert.rejects(createMeasuredPage(fake, 'tablet'), /Unknown preset "tablet"/);
});

test('measureMultipleUrls validates the preset once, up front', async () => {
  const { measureMultipleUrls } = require('../../lib/cwv-collector');
  const fake = { browserType: () => ({ name: () => 'chromium' }) };
  await assert.rejects(measureMultipleUrls(fake, ['http://a', 'http://b'], { preset: 'tablet' }), /Unknown preset "tablet"/);
});
