'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRESETS, generateMarkdownReport, generateHtmlReport, printReport, printComparison,
} = require('../../lib/cwv-collector');
const { makeResult } = require('../helpers/results');

const DISCLAIMER = "Lab data from a single run under the conditions above. Google's ranking signal uses field data (CrUX p75 over 28 days), so these values are not directly comparable.";
const UNSPECIFIED = 'Measurement conditions were not recorded — the page was created outside createMeasuredPage(), so results are likely unthrottled desktop.';
const mobile = () => ({ preset: 'mobile', label: PRESETS.mobile.label, method: 'devtools' });

function capture(fn) {
  const orig = console.log;
  const out = [];
  console.log = (...a) => out.push(a.join(' '));
  try { fn(); } finally { console.log = orig; }
  return out.join('\n');
}

test('markdown shows conditions and lab disclaimer directly below', () => {
  const md = generateMarkdownReport(makeResult({ conditions: mobile() }));
  assert.match(md, /Mobile \(Moto G Power, Slow 4G, 4× CPU\)/);
  assert.ok(md.includes(`Conditions: ${PRESETS.mobile.label} (devtools throttling)  \n${DISCLAIMER}`));
});

test('html shows conditions and disclaimer', () => {
  const html = generateHtmlReport(makeResult({ conditions: mobile() }));
  assert.ok(html.includes('Mobile (Moto G Power, Slow 4G, 4× CPU)'));
  assert.ok(html.includes('devtools throttling'));
  assert.ok(html.includes("Lab data from a single run under the conditions above. Google&#39;s ranking signal") ||
            html.includes(DISCLAIMER));
});

test('console report shows conditions and disclaimer', () => {
  const out = capture(() => printReport(makeResult({ conditions: mobile() })));
  assert.ok(out.includes(`Conditions: ${PRESETS.mobile.label} (devtools throttling)\n`));
  assert.ok(out.includes(DISCLAIMER));
});

test('no-throttling preset prints label without method', () => {
  const out = capture(() => printReport(makeResult({
    conditions: { preset: 'none', label: PRESETS.none.label, method: null },
  })));
  assert.ok(out.includes(`Conditions: ${PRESETS.none.label}\n`));
});

test('reports render legacy results without conditions', () => {
  const legacy = makeResult(); delete legacy.conditions; delete legacy.warnings;
  for (const out of [generateMarkdownReport(legacy), generateHtmlReport(legacy)])
    assert.ok(out.includes('Measurement conditions were not recorded'));
  assert.ok(capture(() => printReport(legacy)).includes(UNSPECIFIED));
  assert.doesNotThrow(() => generateMarkdownReport([legacy, { url: 'https://x.test/', error: 'boom', metrics: {} }]));
  assert.doesNotThrow(() => generateHtmlReport([legacy, { url: 'https://x.test/', error: 'boom', metrics: {} }]));
});

test('unspecified preset prints the unspecified copy', () => {
  assert.ok(generateMarkdownReport(makeResult()).includes(UNSPECIFIED));
});

test('warnings are listed when present', () => {
  const r = makeResult({ conditions: mobile(), warnings: ['Page navigated away'] });
  assert.match(generateMarkdownReport(r), /Warnings[\s\S]*Page navigated away/);
  assert.ok(generateHtmlReport(r).includes('Page navigated away'));
  assert.ok(capture(() => printReport(r)).includes('Page navigated away'));
});

test('comparison prints shared label once, else per URL', () => {
  const a = makeResult({ conditions: mobile() });
  const b = makeResult({ url: 'https://b.test/', conditions: mobile() });
  const shared = capture(() => printComparison([a, b]));
  assert.equal(shared.split(PRESETS.mobile.label).length - 1, 1);
  const c = makeResult({ url: 'https://c.test/', conditions: { preset: 'none', label: PRESETS.none.label, method: null } });
  const mixed = capture(() => printComparison([a, c]));
  assert.ok(mixed.includes(PRESETS.mobile.label) && mixed.includes(PRESETS.none.label));
});
