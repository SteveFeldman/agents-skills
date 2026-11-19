'use strict';

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const PRESETS = {
  mobile: {
    name: 'mobile',
    label: 'Mobile (Moto G Power, Slow 4G, 4× CPU)',
    context: {
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
      userAgent: MOBILE_UA,
    },
    network: { latencyMs: 150, downloadKbps: 1638.4, uploadKbps: 750 },
    cpuSlowdown: 4,
  },
  desktop: {
    name: 'desktop',
    label: 'Desktop (1350×940, 40ms RTT, 10 Mbps)',
    context: {
      viewport: { width: 1350, height: 940 },
      deviceScaleFactor: 1,
    },
    network: { latencyMs: 40, downloadKbps: 10240, uploadKbps: 10240 },
    cpuSlowdown: 1,
  },
  none: {
    name: 'none',
    label: 'No throttling (unthrottled host machine)',
    context: {},
    network: null,
    cpuSlowdown: 1,
  },
};

const LAB_DISCLAIMER =
  "Lab data from a single run under the conditions above. Google's ranking signal uses field data (CrUX p75 over 28 days), so these values are not directly comparable.";

const UNSPECIFIED_COPY =
  'Measurement conditions were not recorded — the page was created outside createMeasuredPage(), so results are likely unthrottled desktop.';

function resolvePreset(preset) {
  if (!Object.prototype.hasOwnProperty.call(PRESETS, preset)) {
    throw new Error(
      `Unknown preset "${preset}" (valid presets: ${Object.keys(PRESETS).join(', ')})`,
    );
  }
  return PRESETS[preset];
}

function isThrottled(p) {
  return p.network !== null || p.cpuSlowdown > 1;
}

/** Conditions for a preset without a live page (viewport from the preset, no UA). */
function presetConditions(preset, extra = {}) {
  const p = resolvePreset(preset);
  return {
    preset: p.name,
    label: p.label,
    method: p.name === 'none' ? null : 'devtools',
    network: p.network,
    cpuSlowdown: p.name === 'none' ? null : p.cpuSlowdown,
    viewport: p.context.viewport || null,
    userAgent: null,
    ...extra,
  };
}

/**
 * Create a context and page under a measurement preset, applying network and
 * CPU throttling through the Chrome DevTools Protocol.
 *
 * @returns {Promise<{context, page, conditions}>}
 */
async function createMeasuredPage(browser, preset = 'mobile', contextOptions = {}) {
  const p = resolvePreset(preset);
  if (isThrottled(p)) {
    const name = browser.browserType().name();
    if (name !== 'chromium') {
      throw new Error(
        `Preset "${preset}" requires Chromium (network/CPU throttling uses the Chrome DevTools Protocol)`,
      );
    }
  }

  const context = await browser.newContext({ ...p.context, ...contextOptions, bypassCSP: true });
  try {
    const page = await context.newPage();
    if (isThrottled(p)) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      if (p.network) {
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: p.network.latencyMs,
          downloadThroughput: (p.network.downloadKbps * 1024) / 8,
          uploadThroughput: (p.network.uploadKbps * 1024) / 8,
        });
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpuSlowdown });
    }
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const conditions = presetConditions(preset, {
      viewport: p.context.viewport || page.viewportSize(),
      userAgent,
    });
    return { context, page, conditions };
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
}

module.exports = {
  PRESETS,
  LAB_DISCLAIMER,
  UNSPECIFIED_COPY,
  createMeasuredPage,
  presetConditions,
};
