'use strict';

const { getRating, formatValue } = require('../../lib/cwv-collector');

function metric(name, value, attribution) {
  return {
    value,
    rating: getRating(name, value),
    formatted: formatValue(name, value),
    attribution,
  };
}

function makeResult(overrides = {}) {
  const result = {
    url: 'https://example.test/',
    warnings: [],
    conditions: {
      preset: 'unspecified', label: 'Not recorded', method: null, network: null,
      cpuSlowdown: null, viewport: null, userAgent: null,
    },
    timestamp: '2026-01-01T00:00:00.000Z',
    metrics: {
      LCP: metric('LCP', 1823.4, {
        target: 'img.hero',
        url: 'https://example.test/hero.webp',
        timeToFirstByte: 300,
        resourceLoadDelay: 200,
        resourceLoadDuration: 900,
        elementRenderDelay: 423.4,
      }),
      INP: metric('INP', 156, {
        interactionTarget: 'button#buy',
        interactionType: 'pointer',
        inputDelay: 20,
        processingDuration: 100,
        presentationDelay: 36,
      }),
      CLS: metric('CLS', 0.08214),
      FCP: metric('FCP', 1200),
      TTFB: metric('TTFB', 300),
    },
  };
  for (const [name, patch] of Object.entries(overrides.metrics || {})) {
    const merged = { ...result.metrics[name], ...patch };
    if ('value' in patch) {
      if (!('rating' in patch)) merged.rating = getRating(name, patch.value);
      if (!('formatted' in patch)) merged.formatted = formatValue(name, patch.value);
    }
    result.metrics[name] = merged;
  }
  const { metrics, ...rest } = overrides;
  return Object.assign(result, rest);
}

module.exports = { makeResult };
