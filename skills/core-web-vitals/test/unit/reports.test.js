'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMarkdownReport, generateHtmlReport } = require('../../lib/cwv-collector');
const { makeResult } = require('../helpers/results');

test('markdown report renders the metric row', () => {
  const md = generateMarkdownReport(makeResult());
  assert.match(md, /\| \*\*LCP\*\* — Largest Contentful Paint \| 1823ms \| ✅ Good \|/);
});

test('html report escapes attribution selectors', () => {
  const html = generateHtmlReport(makeResult({ metrics: { LCP: { attribution: { target: 'img[alt="<x>"]' } } } }));
  assert.ok(!html.includes('<x>'));
});
