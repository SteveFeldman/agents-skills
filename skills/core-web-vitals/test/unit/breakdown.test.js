'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getBreakdown } = require('../../lib/cwv-collector');

test('LCP breakdown orders phases and picks dominant', () => {
  const b = getBreakdown('LCP', { timeToFirstByte: 300, resourceLoadDelay: 200, resourceLoadDuration: 900, elementRenderDelay: 100 });
  assert.deepEqual(b.phases.map((p) => p.key), ['timeToFirstByte', 'resourceLoadDelay', 'resourceLoadDuration', 'elementRenderDelay']);
  assert.equal(b.dominant, 'resourceLoadDuration');
  assert.equal(b.phases[2].share, 0.6);
  assert.equal(b.phases[0].label, 'Time to first byte');
});

test('getBreakdown tolerates missing fields', () => {
  const b = getBreakdown('LCP', { timeToFirstByte: 500, elementRenderDelay: 50 });
  assert.deepEqual(b.phases.map((p) => p.key), ['timeToFirstByte', 'elementRenderDelay']);
  assert.equal(getBreakdown('LCP', null), null);
  assert.equal(getBreakdown('LCP', { target: 'h1' }), null);
  assert.equal(getBreakdown('CLS', { largestShiftValue: 0.2 }), null);
});

test('negative phases clamp to zero', () => {
  assert.equal(getBreakdown('INP', { inputDelay: -4, processingDuration: 80, presentationDelay: 20 }).phases[0].ms, 0);
});

test('all-zero phases give zero shares', () => {
  const b = getBreakdown('INP', { inputDelay: 0, processingDuration: 0, presentationDelay: 0 });
  assert.deepEqual(b.phases.map((p) => p.share), [0, 0, 0]);
});
