#!/usr/bin/env node
// Summarizes a Stryker mutation.json report into stable findings, per-test credit,
// and (optionally) a per-mutant delta against a second report.
// Read-only: reads the given JSON files only; no child processes, no network, no writes.
//
// Usage:
//   node summarize-mutants.mjs --report <mutation.json> [--compare <other.json>]
//        [--credit <test-path-substring>]... [--format md|json]
//
//   --report   Report to summarize (e.g. PR tests against PR source).
//   --compare  Earlier report for the SAME source revision and mutate ranges
//              (e.g. base-branch tests, or the run before a proposed fix).
//              Deltas: newly-killed, still-surviving, no-longer-killed.
//   --credit   Only credit kills from test files whose path contains this string
//              (repeatable; e.g. the test files changed in the PR).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const one = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const many = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));

const reportPath = one('--report');
const comparePath = one('--compare');
const credit = many('--credit');
const format = one('--format') || 'md';
if (!reportPath || !['md', 'json'].includes(format)) {
  console.error('Usage: summarize-mutants.mjs --report <mutation.json> [--compare <old.json>] [--credit <path>]... [--format md|json]');
  process.exit(2);
}

const UNKILLED = new Set(['Survived', 'NoCoverage']);
const KILLED = new Set(['Killed', 'Timeout']);

function load(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  const tests = new Map();
  for (const [file, tf] of Object.entries(report.testFiles || {})) {
    for (const t of tf.tests || []) {
      tests.set(t.id, { file, name: t.name, line: t.location?.start?.line });
    }
  }
  const mutants = new Map();
  for (const [file, f] of Object.entries(report.files || {})) {
    const lines = (f.source || '').split('\n');
    for (const m of f.mutants || []) {
      const { start, end } = m.location;
      // Stable across reruns of the same source: file + position + mutator + replacement.
      const key = `${file}:${start.line}:${start.column}-${end.line}:${end.column}|${m.mutatorName}|${m.replacement ?? ''}`;
      const id = `MT-${createHash('sha256').update(key).digest('hex').slice(0, 10)}`;
      mutants.set(id, {
        id,
        file,
        line: start.line,
        column: start.column,
        mutator: m.mutatorName,
        original: (lines[start.line - 1] || '').trim().slice(0, 160),
        replacement: (m.replacement ?? '').slice(0, 160),
        status: m.status,
        killedBy: (m.killedBy || []).map((t) => tests.get(t)).filter(Boolean),
        coveredByCount: (m.coveredBy || []).length,
      });
    }
  }
  return { mutants, tests };
}

const score = (ms) => {
  const k = ms.filter((m) => KILLED.has(m.status)).length;
  const u = ms.filter((m) => UNKILLED.has(m.status)).length;
  return { total: ms.length, killed: k, unkilled: u, score: k + u ? +((100 * k) / (k + u)).toFixed(2) : null };
};

const cur = load(reportPath);
const all = [...cur.mutants.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const byFile = {};
for (const m of all) (byFile[m.file] ||= []).push(m);
const files = Object.entries(byFile).map(([file, ms]) => ({ file, ...score(ms) }));

const findings = all
  .filter((m) => UNKILLED.has(m.status))
  .map(({ killedBy, ...m }) => ({ ...m, classification: 'untriaged', state: 'open' }));

// Credit: which tests killed mutants (optionally only PR-changed test files).
const creditMap = new Map();
for (const m of all) {
  for (const t of m.killedBy) {
    if (credit.length && !credit.some((c) => t.file.includes(c))) continue;
    const k = `${t.file}:${t.line}`;
    const e = creditMap.get(k) || { test: t.name, file: t.file, line: t.line, kills: [] };
    e.kills.push(`${m.file.split('/').pop()}:${m.line} ${m.mutator}`);
    creditMap.set(k, e);
  }
}
const credits = [...creditMap.values()].sort((a, b) => b.kills.length - a.kills.length);

let delta = null;
if (comparePath) {
  const old = load(comparePath);
  delta = { newlyKilled: [], stillSurviving: [], noLongerKilled: [], onlyInCurrent: [], onlyInCompare: [] };
  for (const m of all) {
    const o = old.mutants.get(m.id);
    if (!o) delta.onlyInCurrent.push(m.id);
    else if (UNKILLED.has(o.status) && KILLED.has(m.status)) delta.newlyKilled.push(m.id);
    else if (UNKILLED.has(o.status) && UNKILLED.has(m.status)) delta.stillSurviving.push(m.id);
    else if (KILLED.has(o.status) && UNKILLED.has(m.status)) delta.noLongerKilled.push(m.id);
  }
  for (const id of old.mutants.keys()) if (!cur.mutants.has(id)) delta.onlyInCompare.push(id);
  delta.compareScore = score([...old.mutants.values()]);
}

const out = { report: reportPath, compare: comparePath || null, overall: score(all), files, findings, credits, delta };

if (format === 'json') {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/`/g, "'");
const o = out.overall;
console.log(`## Mutation summary\n\nOverall: ${o.score}% (${o.killed} killed+timeout / ${o.killed + o.unkilled}; ${o.total} mutants incl. errors/ignored)\n`);
console.log('| File | Mutants | Killed | Survived/NoCov | Score |\n|---|---|---|---|---|');
for (const f of files) console.log(`| ${f.file} | ${f.total} | ${f.killed} | ${f.unkilled} | ${f.score ?? 'n/a'}% |`);
console.log(`\n## Findings (${findings.length} unkilled)\n\n| ID | Location | Mutator | Status | Original | Replacement |\n|---|---|---|---|---|---|`);
for (const f of findings) {
  console.log(`| ${f.id} | ${f.file}:${f.line} | ${f.mutator} | ${f.status} | \`${esc(f.original)}\` | \`${esc(f.replacement)}\` |`);
}
console.log(`\n## Test credit${credit.length ? ` (${credit.join(', ')})` : ''}\n`);
for (const c of credits.slice(0, 20)) console.log(`- ${c.file}:${c.line} "${c.test}" killed ${c.kills.length}: ${[...new Set(c.kills)].join(', ')}`);
if (delta) {
  const cs = delta.compareScore;
  console.log(`\n## Delta vs ${comparePath}\n\nCompare score: ${cs.score}% -> current: ${o.score}%`);
  for (const [k, v] of Object.entries(delta)) if (Array.isArray(v)) console.log(`- ${k}: ${v.length}${v.length ? ` (${v.join(', ')})` : ''}`);
}
