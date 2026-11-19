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

test('markdown summary marks rows that have warnings', () => {
  const a = makeResult({ url: 'https://a.test/' });
  const b = makeResult({ url: 'https://b.test/', warnings: ['something happened'] });
  const md = generateMarkdownReport([a, b]);
  assert.ok(md.includes('| https://b.test/ ⚠ |'));
  assert.ok(!md.includes('| https://a.test/ ⚠'));
});

test('lab headings avoid ranking-signal wording', () => {
  const { generateHtmlReport: html } = require('../../lib/cwv-collector');
  const out = html(makeResult());
  assert.ok(!out.includes('are Good</div>'));
});
