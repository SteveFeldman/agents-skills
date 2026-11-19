'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMarkdownReport, generateHtmlReport, printReport } = require('../../lib/cwv-collector');
const { makeResult } = require('../helpers/results');

const poorInp = () => makeResult({
  metrics: { INP: { value: 600, attribution: { inputDelay: 20, processingDuration: 500, presentationDelay: 80 } } },
});

test('markdown shows INP breakdown and phase-keyed advice for a poor INP', () => {
  const md = generateMarkdownReport(poorInp());
  assert.match(md, /#### INP breakdown/);
  assert.match(md, /\| Phase \| Time \| Share \|/);
  assert.match(md, /Processing duration \| 500ms \| 83%/);
  assert.match(md, /Processing duration \| 500ms \| 83% ◀ dominant/);
  assert.ok(md.includes('scheduler.yield()'));
});

test('phase advice skips phases under 10% share', () => {
  const md = generateMarkdownReport(makeResult({
    metrics: { INP: { value: 600, attribution: { inputDelay: 20, processingDuration: 500, presentationDelay: 80 } } },
  }));
  assert.ok(!md.includes('**Input delay:**'));
  assert.ok(md.includes('**Processing duration:**'));
});

test('dominant phase advice comes first', () => {
  const md = generateMarkdownReport(makeResult({
    metrics: { LCP: { value: 5000, attribution: { timeToFirstByte: 500, resourceLoadDelay: 400, resourceLoadDuration: 3500, elementRenderDelay: 600 } } },
  }));
  assert.ok(md.indexOf('**Resource load duration:**') < md.indexOf('**Time to first byte:**'));
});

test('no phase advice for a good LCP', () => {
  assert.ok(!generateMarkdownReport(makeResult()).includes('#### Recommendations'));
});

test('markdown no longer prints duplicate phase lines in attribution', () => {
  const md = generateMarkdownReport(poorInp());
  assert.ok(!md.includes('- Processing duration:'));
});

test('html renders a stacked bar with escaped titles', () => {
  const html = generateHtmlReport(poorInp());
  assert.match(html, /width:83(\.\d+)?%/);
  assert.match(html, /title="Processing duration: 500ms"/);
});

test('printReport indents breakdown lines', () => {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try { printReport(poorInp()); } finally { console.log = orig; }
  assert.ok(lines.some((l) => /^\s{7,}Processing duration\s+500ms\s+83%/.test(l)));
});
