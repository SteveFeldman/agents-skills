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

const allDocs = () => [SKILL, ...refs()];

test('every API name in SKILL.md API table is exported', () => {
  const api = require('../../lib/cwv-collector');
  const text = read(SKILL);
  const start = text.indexOf('## API summary');
  assert.ok(start >= 0, 'API summary section');
  const section = text.slice(start).split(/\n## /)[0];
  const names = new Set();
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue;
    const firstCell = line.split('|')[1] || '';
    for (const [, tick] of firstCell.matchAll(/`([^`]+)`/g)) {
      const m = tick.match(/^[A-Za-z_$][\w$]*/);
      if (m && !['metrics'].includes(m[0]) && !tick.startsWith('metrics.')) names.add(m[0]);
    }
  }
  assert.ok(names.size >= 8, `found ${names.size} names`);
  for (const n of names) assert.ok(n in api, `${n} is exported`);
});

test('docs never claim scrolling counts toward INP', () => {
  for (const f of allDocs()) {
    for (const line of read(f).split('\n')) {
      if (/scroll/i.test(line) && /INP/.test(line)) {
        assert.ok(/\b(not|never|doesn't|does not|don't|excluded?|ignored?)\b/i.test(line), `${path.basename(f)}: ${line}`);
      }
    }
  }
});

test('preset labels in docs match PRESETS', () => {
  const { PRESETS } = require('../../lib/cwv-collector');
  const text = read(SKILL) + read(path.join(DIR, 'references', 'conditions.md'));
  for (const p of Object.values(PRESETS)) assert.ok(text.includes(p.label), p.label);
});

test('diagnosis references end with the credit footer', () => {
  for (const f of ['lcp', 'inp', 'cls']) {
    const t = read(path.join(DIR, 'references', `${f}.md`)).trim();
    assert.ok(t.endsWith("Approach informed by Addy Osmani's web-quality-skills (MIT) and web.dev."), f);
  }
});

test('relative links in references resolve', () => {
  for (const f of refs()) {
    for (const [, rel] of read(f).matchAll(/\]\(([^)#\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(rel)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(f), rel)), `${path.basename(f)}: ${rel}`);
    }
  }
});
