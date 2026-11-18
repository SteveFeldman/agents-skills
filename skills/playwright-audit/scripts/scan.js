#!/usr/bin/env node
/*
 * playwright-audit scanner — deterministic, zero-dependency static analysis for
 * Playwright suites. Emits findings with file:line evidence, category scores and a grade.
 *
 * Usage:
 *   node scan.js [--root <dir>] [--tests <dir>] [--diff <base-ref>] [--format json|md]
 *                [--profile <file>]
 *
 *   --root     repo root to scan (default: cwd)
 *   --tests    limit scan to one directory, e.g. playwright_tests (default: auto-detect)
 *   --diff     PR mode: only report findings on lines added vs <base-ref> (git diff base...HEAD)
 *   --format   json (default) or md
 *   --profile  JSON profile (default: <root>/.pw-audit.json if present)
 *
 * Profile keys: testIdAttribute, acceptedDeviations[], allowedCredentials[{path,reason}] , ignore[].
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const ROOT = path.resolve(opt('root', process.cwd()));
const FORMAT = opt('format', 'json');
const DIFF_BASE = opt('diff', null);
const TESTS_DIR = opt('tests', null);

// ---------- rules ----------
// weight = base deduction per finding, cap = max deduction a single rule can cost its category.
const SEV_WEIGHT = { critical: 15, high: 5, medium: 2, low: 0.5, info: 0 };
const RULES = {
  PW001: { cat: 'reliability', sev: 'high', cap: 25, title: 'page.waitForTimeout() hard wait' },
  PW002: { cat: 'reliability', sev: 'medium', cap: 15, title: 'waitForSelector / page.$ / page.$$ (legacy, no auto-retry)' },
  PW003: { cat: 'reliability', sev: 'medium', cap: 15, title: "waitForLoadState('networkidle') (discouraged)" },
  PW004: { cat: 'assertions', sev: 'medium', cap: 25, title: 'One-shot read instead of web-first assertion' },
  PW010: { cat: 'assertions', sev: 'low', cap: 5, title: 'isVisible().catch() optional-element probe (racy, one-shot)' },
  PW005: { cat: 'reliability', sev: 'critical', cap: 30, title: 'test.only / describe.only committed' },
  PW006: { cat: 'structure', sev: 'info', cap: 0, title: 'Skipped test (unconditional test.skip / test.fixme): informational, not scored' },
  PW007: { cat: 'reliability', sev: 'medium', cap: 15, title: 'Bypasses actionability checks ({ force: true } or evaluate(el => el.click()))' },
  PW008: { cat: 'reliability', sev: 'high', cap: 20, title: 'setTimeout / sleep used as a wait' },
  PW101: { cat: 'locators', sev: 'high', cap: 30, title: 'XPath locator' },
  PW102: { cat: 'locators', sev: 'medium', cap: 25, title: 'CSS class / hashed-class selector' },
  PW103: { cat: 'locators', sev: 'low', cap: 10, title: 'CSS selector tied to DOM structure, tag or #id (prefer user-facing locators)' },
  PW105: { cat: 'locators', sev: 'info', cap: 0, title: 'Positional locator: review whether order or identity matters' },
  PW201: { cat: 'assertions', sev: 'high', cap: 30, title: 'No assertion or verification helper detected' },
  PW203: { cat: 'structure', sev: 'medium', cap: 10, title: 'test.describe.serial couples tests' },
  PW204: { cat: 'structure', sev: 'medium', cap: 15, title: 'Hardcoded absolute URL in test code' },
  PW205: { cat: 'structure', sev: 'high', cap: 20, title: 'Hardcoded credential/secret in test code' },
  PW206: { cat: 'structure', sev: 'low', cap: 5, title: 'console.log left in spec (use test.step or testInfo.attach; debugging best practice)' },
  PW301: { cat: 'determinism', sev: 'high', cap: 20, title: 'waitForResponse registered after the triggering action (race)' },
  PW302: { cat: 'determinism', sev: 'medium', cap: 10, title: 'Suite never mocks responses (route.fulfill/HAR): error paths untestable deterministically' },
  PW401: { cat: 'config', sev: 'high', cap: 30, title: 'forbidOnly not set' },
  PW402: { cat: 'config', sev: 'medium', cap: 20, title: 'No CI retries configured' },
  PW403: { cat: 'config', sev: 'low', cap: 10, title: 'No trace configured / trace is always on' },
  PW404: { cat: 'config', sev: 'low', cap: 10, title: 'No screenshot-on-failure (debugging best practice)' },
  PW405: { cat: 'config', sev: 'low', cap: 10, title: 'fullyParallel not enabled' },
  PW406: { cat: 'config', sev: 'medium', cap: 20, title: 'No baseURL (absolute URLs leak into tests)' },
  PW407: { cat: 'config', sev: 'low', cap: 10, title: 'No reporter configured for CI consumption' },
  PW409: { cat: 'config', sev: 'low', cap: 10, title: 'No video-on-failure (debugging best practice)' },
  PW408: { cat: 'config', sev: 'low', cap: 10, title: 'No workers setting (default is the detected core count; set it explicitly for CI)' },
};
const CATEGORY_WEIGHT = { reliability: 30, locators: 20, assertions: 15, structure: 15, determinism: 10, config: 10 };

// ---------- profile ----------
let profile = { testIdAttribute: null, acceptedDeviations: [], ignore: [] };
const profilePath = opt('profile', path.join(ROOT, '.pw-audit.json'));
if (fs.existsSync(profilePath)) profile = { ...profile, ...JSON.parse(fs.readFileSync(profilePath, 'utf8')) };

// ---------- file discovery ----------
const SKIP_DIRS = new Set(['node_modules', '.git', 'results', 'test-results', 'playwright-report', 'dist', 'build', 'coverage', 'blob-report']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|cjs|mjs|ts|tsx|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const scanRoot = TESTS_DIR ? path.resolve(ROOT, TESTS_DIR) : ROOT;
const allFiles = walk(TESTS_DIR ? ROOT : scanRoot);
const inScope = (f) => f === scanRoot || f.startsWith(scanRoot + path.sep);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const allowedCreds = (profile.allowedCredentials || []).map((a) => {
  if (!a.path || !a.reason) { console.error('allowedCredentials entries need both "path" (regex) and "reason"'); process.exit(2); }
  return { path: a.path, reason: a.reason, re: new RegExp(a.path), count: 0 };
});
const ignoreRes = (profile.ignore || []).map((g) => new RegExp(g));
const usable = allFiles.filter((f) => !ignoreRes.some((r) => r.test(rel(f))));

const configFiles = usable.filter((f) => /playwright\.config\.[cm]?[jt]s$/.test(f));
const specFiles = usable.filter((f) => inScope(f) && /\.(spec|test)\.[cm]?[jt]sx?$/.test(f) && fileUsesPlaywright(f));
const pageFiles = usable.filter(
  (f) => inScope(f) && !specFiles.includes(f) && /(\/|^)(pages?|page-objects?|pageobjects?|components|fixtures|helpers)\//i.test(rel(f)) && fileUsesPlaywright(f, true)
);

function fileUsesPlaywright(f, loose) {
  const src = fs.readFileSync(f, 'utf8');
  if (/@playwright\/test|from ['"]playwright|require\(['"](@playwright\/test|playwright)/.test(src)) return true;
  if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(f) && /\b(test|it)(\.(only|skip|fixme))?\s*\(|test\.describe/.test(src)) return true;
  if (/(\/|^)playwright[_-]?tests?\//i.test(rel(f)) || /(\/|^)e2e\//i.test(rel(f))) return true;
  return !!loose && /\bpage\./.test(src);
}

// blank out comments, keep line numbers/columns
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      out += ' '.repeat(j - i);
      i = j;
    } else if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j === -1 ? n : j + 2;
      out += blank(src.slice(i, end));
      i = end;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (c !== '`' && src[j] === '\n') break;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

// ---------- findings ----------
const findings = [];
const stats = { specFiles: specFiles.length, pageFiles: pageFiles.length, tests: 0, assertions: 0, locators: { userVisible: 0, role: 0, testId: 0, aria: 0, css: 0, xpath: 0 }, routeUses: 0 };
const ignoreCache = {};
const accepted = {};
// Inline suppression: `// pw-audit-ignore PW201 reason` on the same line or the line above.
function isSuppressed(id, file, line) {
  if (!ignoreCache[file]) ignoreCache[file] = fs.readFileSync(file, 'utf8').split('\n');
  const L = ignoreCache[file];
  const re = new RegExp(`pw-audit-ignore[^\\n]*\\b${id}\\b`);
  return re.test(L[line - 1] || '') || re.test(L[line - 2] || '');
}
function add(id, file, line, snippet, note) {
  if (isSuppressed(id, file, line)) return;
  if (id === 'PW205') {
    const hit = allowedCreds.find((a) => a.re.test(rel(file)));
    if (hit) { hit.count++; return; }
  }
  if ((profile.acceptedDeviations || []).includes(id)) { accepted[id] = (accepted[id] || 0) + 1; return; }
  findings.push({ id, ...RULES[id], file: rel(file), line, snippet: (snippet || '').trim().slice(0, 140), note: note || undefined });
}

// auto-detect test id attribute (most common data-* attribute used in locator strings)
function detectTestIdAttr(files) {
  if (profile.testIdAttribute) return profile.testIdAttribute;
  for (const cf of configFiles) {
    const m = /testIdAttribute\s*:\s*['"]([\w-]+)['"]/.exec(fs.readFileSync(cf, 'utf8'));
    if (m) return m[1];
  }
  const counts = {};
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\[(data-[\w-]+)[~|^$*]?=/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : 'data-testid';
}
const TEST_ID_ATTR = detectTestIdAttr([...specFiles, ...pageFiles]);

function classifySelector(sel) {
  const s = sel.trim();
  if (/^(xpath=|\/\/|\.\/\/|\(\/\/)/.test(s)) return 'xpath';
  if (new RegExp(`\\[${TEST_ID_ATTR}[~|^$*]?=`).test(s) || /\[data-(testid|test|qa|cy|at)[~|^$*]?=/.test(s)) return 'testId';
  if (/^\[(aria-[\w-]+|role)[~|^$*]?=[^\]]*\](\[[^\]]+\])*(\s+[a-z0-9]+)?$/.test(s) || /^\[role=/.test(s)) return 'aria';
  if (/\[class[~|^$*]?=|(^|[\s>+~])\.[\w-]|\._|[a-z0-9]\.[A-Za-z_]/.test(s)) return 'class';
  if (/^#[\w-]+$/.test(s)) return 'id';
  if (/#[\w-]/.test(s) && !/\s/.test(s)) return 'id';
  return 'structural';
}

const ONE_SHOT = /\.(textContent|innerText|innerHTML|inputValue|allTextContents|allInnerTexts|isVisible|isHidden|isChecked|isEnabled|isDisabled|isEditable|count)\(\s*\)/;
const ASSERT_WORD = /\b(expect|assert|verify|toPass)\w*\s*[.(]|\.expect\w*\(|\.assert\w*\(|\.verify\w*\(/;

function scanTestCode(file, isSpec) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = stripComments(raw).split('\n');
  const isSpecOrPage = isSpec || !/(\/|^)helpers\//i.test(rel(file));
  const text = lines.join('\n');

  lines.forEach((ln, i) => {
    const n = i + 1;
    const prev = (lines[i - 1] || '').trim();

    if (/\bwaitForTimeout\s*\(/.test(ln)) add('PW001', file, n, ln);
    if (/\bwaitForSelector\s*\(|\bpage\.\$\$?\s*\(/.test(ln)) add('PW002', file, n, ln);
    if (/waitForLoadState\(\s*['"]networkidle['"]/.test(ln) || /waitUntil:\s*['"]networkidle['"]/.test(ln)) add('PW003', file, n, ln);
    if (/\b(test|describe)(\.\w+)?\.only\s*\(/.test(ln) || /\btest\.describe\.only\b/.test(ln)) add('PW005', file, n, ln);
    if (/force:\s*true/.test(ln) || /\.evaluate\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.click\(\)/.test(ln)) add('PW007', file, n, ln);
    if (isSpecOrPage && /new Promise\([^)]*setTimeout|\bawait\s+sleep\(|(^|[^.\w])setTimeout\s*\(/.test(ln) && !/waitForFunction|expect\.poll|timeout:|reject\(/.test(ln)) add('PW008', file, n, ln);
    if (/console\.(log|debug)\(/.test(ln) && isSpec && !/\[\[\w+\|[^\]]*\]\]/.test(ln)) add('PW206', file, n, ln);

    // one-shot reads: flag only when the value feeds an assertion or a branch, not when it is a stored read
    if (ONE_SHOT.test(ln)) {
      const inAssert = /expect\(\s*await/.test(ln);
      const stored = /(const|let|var)\s+\w+\s*=\s*await/.test(ln);
      const returned = /\breturn\b/.test(ln);
      const swallowed = /\.catch\(/.test(ln);
      const probe = /\.isVisible\(\)\.catch\(/.test(ln) && !inAssert;
      const afterAction = /\.(click|fill|press|check|selectOption|tap|goto|reload)\(/.test(prev) && !/waitFor|expect\(|toBe/.test(prev);
      if (probe && !afterAction) {
        add('PW010', file, n, ln, 'optional-element probe reads state once; prefer locator.or() or waitFor({ timeout }).then(() => true, () => false)');
      } else if (inAssert || stored || returned || swallowed) {
        add('PW004', file, n, ln, probe ? 'isVisible().catch() right after an action: state is read before the page settles' : undefined);
      }
    }

    // locators
    for (const m of ln.matchAll(/\.locator\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      const kind = classifySelector(m[2]);
      if (kind === 'xpath') { stats.locators.xpath++; add('PW101', file, n, ln); }
      else if (kind === 'class') { stats.locators.css++; add('PW102', file, n, ln); }
      else if (kind === 'id' || kind === 'structural') { stats.locators.css++; add('PW103', file, n, ln); }
      else if (kind === 'testId') stats.locators.testId++;
      else if (kind === 'aria') stats.locators.aria++;
    }
    for (const m of ln.matchAll(/\bxpath=/g)) if (!/\.locator\(/.test(ln)) add('PW101', file, n, ln);
    const roleN = (ln.match(/\.getByRole\(/g) || []).length;
    stats.locators.role += roleN;
    stats.locators.userVisible += roleN + (ln.match(/\.getBy(Label|Text|Placeholder|AltText|Title)\(/g) || []).length;
    stats.locators.testId += (ln.match(/\.getByTestId\(/g) || []).length;

    if (/\.(?:nth\s*\(|(?:first|last)\s*\(\s*\))/.test(ln)) add('PW105', file, n, ln);

    // hygiene / security
    if (/\bpage\.goto\(\s*['"`]https?:\/\//.test(ln) || /\.goto\(\s*['"`]https?:\/\//.test(ln)) add('PW204', file, n, ln);

    // race: waitForResponse/Request/event awaited directly after the triggering action
    if (/\bawait\s+[\w.]*waitFor(Response|Request|Event|URL)\s*\(/.test(ln) && /\.(click|fill|press|check|selectOption|tap|goto)\(/.test(prev) && !/Promise\.all|const\s+\w+\s*=/.test(prev)) {
      add('PW301', file, n, ln);
    }
    // only response-shaping counts as mocking; route.abort() for tracker blocking does not
    if (/routeFromHAR|\.fulfill\(|route\.fetch\(/.test(ln)) stats.routeUses++;
  });

  if (!isSpec) return;

  // test-level analysis
  const testStarts = [];
  lines.forEach((ln, i) => {
    if (/^\s*(test|it)(\.(skip|fixme|fail|only))?\s*\(\s*(['"`]|$)/.test(ln)) testStarts.push(i);
    if (/\btest\.describe\.serial\b|\bdescribe\.serial\b/.test(ln)) add('PW203', file, i + 1, ln);
    const sk = /^\s*(test|it)\.(skip|fixme)\s*\(\s*(['"`].*)?/.exec(ln);
    if (sk && /^\s*(test|it)\.(skip|fixme)\s*\(\s*['"`]/.test(ln)) {
      const ticketed = /\b[A-Z][A-Z0-9]+-\d+\b/.test(ln) || /^\s*\/\//.test(lines[i - 1] || '');
      add('PW006', file, i + 1, ln, ticketed ? 'Skipped with a ticket or comment' : 'Skipped with no ticket or comment');
    }
  });
  stats.tests += testStarts.length;

  testStarts.forEach((start, idx) => {
    const end = idx + 1 < testStarts.length ? testStarts[idx + 1] : lines.length;
    const body = lines.slice(start, end).join('\n');
    if (/^\s*(test|it)\.(skip|fixme)\s*\(\s*['"`]/.test(lines[start])) return;
    const asserted = ASSERT_WORD.test(body) || /\btoBe\w+\(|\btoHave\w+\(|\btoContain\w*\(|\btoEqual\(|\btoMatch\w*\(/.test(body);
    const conditionalSkip = /test\.skip\(\s*[^'"`)]/.test(body);
    stats.assertions += (body.match(/\bexpect\w*\s*[.(]/g) || []).length;
    if (!asserted && !/test\.step\(/.test(body) && !conditionalSkip) add('PW201', file, start + 1, lines[start]);
  });
}

// ---------- config analysis ----------
function scanConfig(file) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  const has = (re) => re.test(src);
  const line1 = 1;
  if (!has(/forbidOnly\s*:/)) add('PW401', file, line1, 'forbidOnly missing');
  if (!has(/\bretries\s*[:,}]/)) add('PW402', file, line1, 'retries missing');
  else if (/retries\s*:\s*0\b/.test(src)) add('PW402', file, line1, 'retries: 0', 'Retries disabled everywhere');
  const trace = /trace\s*:\s*['"]([\w-]+)['"]/.exec(src);
  if (!trace && !has(/\btrace\s*[:,}]/)) add('PW403', file, line1, 'trace missing');
  else if (trace && trace[1] === 'on') add('PW403', file, line1, "trace: 'on'", "Prefer 'on-first-retry' or 'retain-on-failure'");
  if (!has(/\bscreenshot\s*[:,}]/) || has(/\bscreenshot\s*:\s*['"]off['"]/)) add('PW404', file, line1, 'screenshot missing or off', "Set screenshot: 'only-on-failure'");
  if (!has(/\bvideo\s*[:,}]/) || has(/\bvideo\s*:\s*['"]off['"]/)) add('PW409', file, line1, 'video missing or off', "Set video: 'retain-on-failure'");
  if (!has(/fullyParallel\s*:\s*true/)) add('PW405', file, line1, 'fullyParallel not true');
  if (!has(/baseURL\s*:/)) add('PW406', file, line1, 'baseURL missing');
  if (!has(/reporter\s*:/)) add('PW407', file, line1, 'reporter missing');
  if (!has(/\bworkers\s*[:,}]/)) add('PW408', file, line1, 'workers missing', 'Set workers explicitly, e.g. process.env.CI ? 1 : undefined');
  return {
    file: rel(file),
    fullyParallel: has(/fullyParallel\s*:\s*true/),
    forbidOnly: has(/forbidOnly\s*:/),
    retries: has(/retries\s*:/),
    trace: trace ? trace[1] : null,
    screenshot: has(/\bscreenshot\s*[:,}]/) && !has(/\bscreenshot\s*:\s*['"]off['"]/),
    video: has(/\bvideo\s*[:,}]/) && !has(/\bvideo\s*:\s*['"]off['"]/),
    baseURL: has(/baseURL\s*:/),
    webServer: has(/webServer\s*:/),
    projects: (src.match(/name\s*:\s*['"][^'"]+['"]/g) || []).length,
    storageState: has(/storageState/),
  };
}

// ---------- run ----------
for (const f of specFiles) scanTestCode(f, true);
for (const f of pageFiles) scanTestCode(f, false);
const SECRET_RE = /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"`](?![\d\/]+['"`])(?!\/)[^'"`\s]{4,}['"`]/i;
const codeFiles = usable.filter((f) => inScope(f) && /\.[cm]?[jt]sx?$/.test(f) && !/\.d\.ts$/.test(f));
for (const f of codeFiles) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    if (SECRET_RE.test(ln) && !/process\.env|placeholder|label|name:/i.test(ln)) add('PW205', f, i + 1, ln);
  });
}
const configSummary = configFiles.map(scanConfig);
if (specFiles.length && stats.routeUses === 0) add('PW302', configFiles[0] || specFiles[0], 1, 'no page.route / fulfill usage found');

// ---------- diff filter (PR mode) ----------
let changed = null;
if (DIFF_BASE) {
  changed = {};
  const diff = execSync(`git diff --unified=0 ${DIFF_BASE}...HEAD`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let cur = null;
  for (const ln of diff.split('\n')) {
    const f = /^\+\+\+ b\/(.+)$/.exec(ln);
    if (f) { cur = f[1]; changed[cur] = changed[cur] || new Set(); continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(ln);
    if (h && cur) {
      const start = +h[1], len = h[2] === undefined ? 1 : +h[2];
      for (let k = 0; k < len; k++) changed[cur].add(start + k);
    }
  }
}
let reported = findings;
let legacyInTouched = [];
if (changed) {
  reported = findings.filter((f) => changed[f.file] && changed[f.file].has(f.line));
  legacyInTouched = findings.filter((f) => f.id !== 'PW105' && changed[f.file] && !changed[f.file].has(f.line));
  // config findings anchor at line 1; surface them whenever the config file itself changed
  for (const f of findings) if (f.id.startsWith('PW4') && changed[f.file] && !reported.includes(f)) reported.push(f);
}

// ---------- scoring ----------
// Suites up to 60 tests take full deductions; larger suites are scaled down so size alone is not punished.
const scale = Math.min(1, 60 / Math.max(stats.tests, 1));
const catDeduction = {};
const ruleCounts = {};
for (const f of findings) {
  ruleCounts[f.id] = (ruleCounts[f.id] || 0) + 1;
}
for (const [id, count] of Object.entries(ruleCounts)) {
  const r = RULES[id];
  const isConfig = r.cat === 'config';
  const raw = SEV_WEIGHT[r.sev] * count * (isConfig ? 1 : scale);
  catDeduction[r.cat] = (catDeduction[r.cat] || 0) + Math.min(raw, r.cap);
}
const categories = {};
let total = 0;
for (const [cat, w] of Object.entries(CATEGORY_WEIGHT)) {
  const score = Math.max(0, 100 - (catDeduction[cat] || 0));
  const grade = gradeOf(score);
  categories[cat] = { weight: w, score: Math.round(score), grade };
  total += (score * w) / 100;
}
const ORDER_GRADES = ['A', 'B', 'C', 'D', 'F'];
function gradeOf(s) {
  return s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';
}
const overall = { score: Math.round(total), grade: gradeOf(total) };
const caps = [];
if (findings.some((f) => f.sev === 'critical')) caps.push({ max: 'C', why: 'critical finding (PW005)' });
if (findings.some((f) => f.sev === 'high')) caps.push({ max: 'B', why: 'high-severity finding present' });
for (const c of caps) {
  if (ORDER_GRADES.indexOf(overall.grade) < ORDER_GRADES.indexOf(c.max)) {
    overall.grade = c.max;
    overall.cappedBy = `${c.why}: grade capped at ${c.max}`;
  }
}

const SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'sources.json'), 'utf8'));
const backingOf = (id) => (SOURCES.rules[id] || { backing: 'none', docs: [] });
const docUrls = (id) => [...backingOf(id).docs.map((d) => SOURCES.base + d), ...(backingOf(id).external || [])];
for (const f of findings) {
  f.backing = backingOf(f.id).backing;
  f.docs = docUrls(f.id);
}

const bySev = (arr) => arr.reduce((a, f) => ((a[f.sev] = (a[f.sev] || 0) + 1), a), {});
const loc = stats.locators;
const locTotal = loc.userVisible + loc.testId + loc.aria + loc.css + loc.xpath;

const result = {
  tool: 'playwright-audit/scan.js',
  mode: DIFF_BASE ? `pr (base ${DIFF_BASE})` : 'repo',
  root: ROOT,
  profile: { testIdAttribute: TEST_ID_ATTR, acceptedDeviations: profile.acceptedDeviations },
  stats: {
    specFiles: stats.specFiles,
    pageObjectFiles: stats.pageFiles,
    tests: stats.tests,
    assertions: stats.assertions,
    locatorMix: { ...loc, total: locTotal },
    routeUses: stats.routeUses,
  },
  config: configSummary,
  acceptedDeviations: accepted,
  allowedCredentials: allowedCreds.map(({ path, reason, count }) => ({ path, reason, suppressed: count })),
  score: DIFF_BASE ? undefined : { overall, categories },
  counts: { bySeverity: bySev(reported), byRule: Object.fromEntries(Object.entries(reported.reduce((a, f) => ((a[f.id] = (a[f.id] || 0) + 1), a), {})).sort()) },
  findings: reported.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  ...(DIFF_BASE ? { legacyDebtInTouchedFiles: legacyInTouched.length, blocking: reported.filter((f) => ['critical', 'high'].includes(f.sev)).length } : {}),
};

if (FORMAT === 'md') {
  const o = [];
  o.push(`# Playwright audit (${result.mode})`);
  o.push(`Specs: ${stats.specFiles} | Page objects: ${stats.pageFiles} | Tests: ${stats.tests} | Test-id attr: \`${TEST_ID_ATTR}\``);
  for (const a of allowedCreds) o.push(`Allowed credentials (\`${a.path}\`): ${a.count} suppressed. Reason: ${a.reason}`);
  if (result.score) {
    o.push(`\n**Overall: ${overall.grade} (${overall.score})**${overall.cappedBy ? ` — ${overall.cappedBy}` : ''}\n`);
    o.push('| Category | Weight | Score | Grade |', '|---|---|---|---|');
    for (const [c, v] of Object.entries(categories)) o.push(`| ${c} | ${v.weight} | ${v.score} | ${v.grade} |`);
  } else {
    o.push(`\nBlocking (critical/high) findings on added lines: **${result.blocking}**; legacy debt in touched files: ${result.legacyDebtInTouchedFiles}`);
  }
  o.push('\n| Rule | Sev | Location | Snippet |', '|---|---|---|---|');
  const positional = new Map();
  for (const f of result.findings) {
    if (f.id === 'PW105') {
      if (!positional.has(f.file)) positional.set(f.file, []);
      positional.get(f.file).push(f.line);
    } else {
      o.push(`| ${f.id} | ${f.sev} | ${f.file}:${f.line} | \`${f.snippet.replace(/\|/g, '\\|')}\` |`);
    }
  }
  if (positional.size) {
    o.push(`\n## PW105: ${result.counts.byRule.PW105} positional locator candidates (unscored, non-blocking)`);
    o.push('Review where an order change could select the wrong target. Intentional positional tests are not defects.');
    for (const [file, lines] of positional) o.push(`- ${file}: lines ${lines.join(', ')}`);
  }
  const hit = [...new Set(result.findings.map((f) => f.id))].sort();
  if (hit.length) {
    o.push('\n## Sources', '| Rule | Backing | Docs |', '|---|---|---|');
    for (const id of hit) {
      const b = backingOf(id);
      const tag = b.tag ? ` [${b.tag}]` : '';
      const base = b.tag === 'general-reviewer' ? 'general reviewer guidance (not Playwright guidance)'
        : b.tag === 'engineering-best-practice' ? 'partial: engineering best practice (not a Playwright requirement)'
        : b.backing === 'official' ? 'official'
        : b.backing === 'partial' ? 'partial (rule details are our convention)'
        : 'NONE: team convention, needs backing';
      const label = base + tag;
      o.push(`| ${id} | ${label} | ${docUrls(id).join(', ') || '-'} |`);
    }
  }
  console.log(o.join('\n'));
} else {
  console.log(JSON.stringify(result, null, 2));
}
if (!DIFF_BASE && stats.tests === 0) {
  console.error(`No Playwright tests found under ${scanRoot}. Check --root/--tests.`);
  process.exit(2);
}
process.exitCode = DIFF_BASE && result.blocking > 0 ? 1 : 0;
