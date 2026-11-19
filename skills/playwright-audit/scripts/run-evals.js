#!/usr/bin/env node
/*
 * Eval runner: executes scan.js against each case in evals/cases and compares
 * the result with that case's expected.json.
 *
 * expected.json keys:
 *   mode         "repo" (default) or "pr"
 *   rules        exact rule-ID -> count map the scanner must report (no extras allowed)
 *   grade        exact overall grade (repo mode)
 *   maxGrade     overall grade must be this or worse (repo mode)
 *   blocking     number of critical/high findings on added lines (pr mode)
 *   legacy       legacy debt count in touched files (pr mode)
 *   allowed      allowedCredentials[0].suppressed that must be reported
 *   accepted     rule-ID -> count that must appear under acceptedDeviations
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const SCAN = path.join(__dirname, 'scan.js');
const CASES = path.join(__dirname, '..', 'evals', 'cases');
const ORDER = 'ABCDF';

function copy(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function runScan(root, extra) {
  try {
    const out = execFileSync('node', [SCAN, '--root', root, '--format', 'json', ...extra], { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (e) {
    if (e.stdout) return JSON.parse(e.stdout);
    throw e;
  }
}

let failed = 0;

// Every scanner rule and every verifier item must have an entry in sources.json.
function checkSources() {
  const root = path.join(__dirname, '..');
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'references', 'sources.json'), 'utf8'));
  const errors = [];
  const ids = [...fs.readFileSync(SCAN, 'utf8').matchAll(/^ {2}(PW\d{3}): \{/gm)].map((m) => m[1]);
  for (const id of ids) if (!sources.rules[id]) errors.push(`rule ${id} has no entry in sources.json`);
  for (const id of Object.keys(sources.rules)) if (!ids.includes(id)) errors.push(`sources.json lists unknown rule ${id}`);
  for (const f of fs.readdirSync(path.join(root, 'verifiers'))) {
    const v = JSON.parse(fs.readFileSync(path.join(root, 'verifiers', f), 'utf8'));
    for (const c of v.checklist) {
      if (!c.backing || !Array.isArray(c.docs)) errors.push(`${f}: item ${c.name} lacks backing/docs`);
      if (!c.rule_ids || !c.rule_ids.length) if (!sources.checks[c.name]) errors.push(`${f}: item ${c.name} has no entry in sources.json checks`);
      for (const r of c.rule_ids || []) if (!sources.rules[r]) errors.push(`${f}: item ${c.name} references unknown rule ${r}`);
    }
  }
  if (errors.length) {
    failed++;
    console.log(`FAIL sources\n  - ${errors.join('\n  - ')}`);
  } else {
    console.log('PASS sources');
  }
}

const filter = process.argv[2];
if (!filter) checkSources();
for (const name of fs.readdirSync(CASES).sort()) {
  if (filter && name !== filter) continue;
  const dir = path.join(CASES, name);
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `pw-audit-${name}-`));
  let result;
  if (expected.mode === 'pr') {
    const git = (cmd) => execSync(`git ${cmd}`, { cwd: tmp, stdio: 'pipe' });
    git('init -q -b main');
    git('config user.email eval@example.com');
    git('config user.name eval');
    copy(path.join(dir, 'base'), tmp);
    git('add -A');
    git('commit -q -m base');
    git('checkout -q -b change');
    fs.rmSync(path.join(tmp, 'e2e'), { recursive: true, force: true });
    copy(path.join(dir, 'head'), tmp);
    git('add -A');
    git('commit -q -m change');
    result = runScan(tmp, ['--diff', 'main']);
  } else {
    copy(path.join(dir, 'files'), tmp);
    result = runScan(tmp, []);
  }

  const errors = [];
  if (expected.rules) {
    const got = result.counts.byRule;
    const keys = new Set([...Object.keys(expected.rules), ...Object.keys(got)]);
    for (const k of keys) if ((got[k] || 0) !== (expected.rules[k] || 0)) errors.push(`rule ${k}: expected ${expected.rules[k] || 0}, got ${got[k] || 0}`);
  }
  if (expected.grade && result.score.overall.grade !== expected.grade) errors.push(`grade: expected ${expected.grade}, got ${result.score.overall.grade}`);
  if (expected.maxGrade && ORDER.indexOf(result.score.overall.grade) < ORDER.indexOf(expected.maxGrade)) errors.push(`grade ${result.score.overall.grade} is better than allowed ${expected.maxGrade}`);
  if (expected.blocking !== undefined && result.blocking !== expected.blocking) errors.push(`blocking: expected ${expected.blocking}, got ${result.blocking}`);
  if (expected.legacy !== undefined && result.legacyDebtInTouchedFiles !== expected.legacy) errors.push(`legacy: expected ${expected.legacy}, got ${result.legacyDebtInTouchedFiles}`);
  if (expected.allowed !== undefined && ((result.allowedCredentials || [])[0] || {}).suppressed !== expected.allowed) errors.push(`allowed: expected ${expected.allowed}, got ${((result.allowedCredentials || [])[0] || {}).suppressed}`);
  if (expected.accepted) for (const [k, v] of Object.entries(expected.accepted)) if ((result.acceptedDeviations[k] || 0) !== v) errors.push(`accepted ${k}: expected ${v}, got ${result.acceptedDeviations[k] || 0}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  if (errors.length) {
    failed++;
    console.log(`FAIL ${name}\n  - ${errors.join('\n  - ')}`);
  } else {
    console.log(`PASS ${name}`);
  }
}
console.log(failed ? `\n${failed} case(s) failed` : '\nAll cases passed');
process.exitCode = failed ? 1 : 0;
