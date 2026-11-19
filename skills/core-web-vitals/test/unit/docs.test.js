'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', '..');
const SKILL = path.join(DIR, 'SKILL.md');
const read = (p) => fs.readFileSync(p, 'utf8');
const refs = () => {
  const dir = path.join(DIR, 'references');
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f))
    : [];
};

test('SKILL.md stays under 10,000 bytes', () => {
  assert.ok(fs.statSync(SKILL).size <= 10000);
});

test('SKILL.md links only to reference files that exist', () => {
  const links = [...read(SKILL).matchAll(/\]\((references\/[^)]+)\)/g)];
  assert.ok(links.length >= 6, 'links to all six references');
  for (const [, rel] of links) assert.ok(fs.existsSync(path.join(DIR, rel)), rel);
});

test('all six reference files exist', () => {
  for (const f of ['patterns', 'conditions', 'lcp', 'inp', 'cls', 'troubleshooting']) {
    assert.ok(fs.existsSync(path.join(DIR, 'references', `${f}.md`)), f);
  }
});

test('docs contain no stale claims', () => {
  const all = [SKILL, ...refs()].map(read).join('\n');
  assert.ok(!/unpkg\.com/.test(all), 'no CDN references');
  assert.ok(!/web-vitals@5/.test(all));
  assert.ok(!/scroll[^\n]*trigger[^\n]*INP/i.test(all), 'scrolling does not count toward INP');
  assert.ok(!/--disable-gpu/.test(all));
  assert.ok(!/WEB_VITALS_CDN/.test(all), 'compat export is not documented');
});

test('evidence rules are present verbatim', () => {
  assert.ok(read(SKILL).includes('Only field p75 supports that.'));
});

test('every exported name used in docs exists', () => {
  const api = require('../../lib/cwv-collector');
  for (const n of ['createMeasuredPage', 'getBreakdown', 'PRESETS']) assert.ok(n in api, n);
});
