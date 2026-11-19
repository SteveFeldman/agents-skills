'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertCWV } = require('../../lib/cwv-collector');
const { makeResult } = require('../helpers/results');

test('assertCWV reports every failure in one error', () => {
  const r = makeResult({ metrics: { LCP: { value: 3000 } } });
  delete r.metrics.CLS;
  assert.throws(() => assertCWV(r, { LCP: 2500, CLS: 0.1 }),
    (e) => /LCP: 3000ms exceeds threshold of 2500ms/.test(e.message) && /CLS: not captured/.test(e.message));
});

test('assertCWV passes when all within threshold', () => {
  assert.doesNotThrow(() => assertCWV(makeResult(), { LCP: 2500, INP: 200, CLS: 0.1 }));
});
