'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('public API keys are unchanged', () => {
  const api = require('../../lib/cwv-collector');
  for (const k of ['collectCWV', 'printReport', 'assertCWV', 'measureMultipleUrls', 'printComparison',
    'generateMarkdownReport', 'generateHtmlReport', 'saveReport', 'THRESHOLDS', 'WEB_VITALS_CDN', 'getRating', 'formatValue'])
    assert.ok(k in api, k);
});
