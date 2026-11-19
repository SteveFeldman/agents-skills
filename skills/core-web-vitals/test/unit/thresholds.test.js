'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getRating, formatValue } = require('../../lib/cwv-collector');

test('getRating boundaries are inclusive of good/poor limits', () => {
  assert.equal(getRating('LCP', 2500), 'good');
  assert.equal(getRating('LCP', 2501), 'needs-improvement');
  assert.equal(getRating('LCP', 4000), 'needs-improvement');
  assert.equal(getRating('LCP', 4001), 'poor');
  assert.equal(getRating('CLS', 0.1), 'good');
  assert.equal(getRating('NOPE', 1), 'unknown');
  assert.equal(getRating('LCP', null), 'unknown');
});

test('formatValue rounds ms and fixes CLS to 4dp', () => {
  assert.equal(formatValue('LCP', 1823.4), '1823ms');
  assert.equal(formatValue('CLS', 0.08214), '0.0821');
  assert.equal(formatValue('LCP', null), 'N/A');
});
