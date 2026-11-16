#!/usr/bin/env node
// Prints Stryker `--mutate` entries ("file:start-end") for lines added/changed
// between a base ref and HEAD. Read-only: only runs `git diff`; no network, no writes.
//
// Usage: node diff-mutate-ranges.mjs [--base develop] [--include src/] [--json]
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = opt('--base', 'origin/HEAD');
const include = opt('--include', 'src/');
const asJson = args.includes('--json');

// Test, mock, generated, and non-JS files are never mutation targets.
const SOURCE = /\.(js|jsx|mjs|cjs|ts|tsx)$/;
const NOT_PRODUCTION = /(^|\/)(test|tests|__tests__|__mocks__|flow-typed)\/|\.(test|spec)\.[jt]sx?$/;

if (!/^[\w./~^@-]+$/.test(base)) {
  console.error(`Refusing suspicious base ref: ${base}`);
  process.exit(2);
}

const diff = execFileSync('git', ['diff', '-U0', '--no-color', `${base}...HEAD`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const ranges = {};
let file = null;
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.startsWith('+++ b/') ? line.slice(6) : null; // /dev/null => deleted file
    continue;
  }
  const m = file && /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!m) continue;
  const start = Number(m[1]);
  const count = m[2] === undefined ? 1 : Number(m[2]);
  if (count === 0) continue; // pure deletion
  (ranges[file] ||= []).push([start, start + count - 1]);
}

const entries = Object.entries(ranges)
  .filter(([f]) => f.startsWith(include) && SOURCE.test(f) && !NOT_PRODUCTION.test(f))
  .map(([f, rs]) => ({ file: f, ranges: rs, mutate: rs.map(([a, b]) => `${f}:${a}-${b}`) }));

if (asJson) {
  console.log(JSON.stringify(entries, null, 2));
} else {
  for (const e of entries) for (const r of e.mutate) console.log(r);
}
