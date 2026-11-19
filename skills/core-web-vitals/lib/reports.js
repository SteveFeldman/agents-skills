'use strict';

const fs   = require('fs');
const path = require('path');
const { THRESHOLDS, RATING_ICONS } = require('./thresholds');
const { LAB_DISCLAIMER, UNSPECIFIED_COPY } = require('./conditions');

function _hasConditions(result) {
  const c = result.conditions;
  return Boolean(c) && c.preset !== 'unspecified';
}

function _conditionsText(result) {
  const c = result.conditions;
  if (!_hasConditions(result)) return UNSPECIFIED_COPY;
  return c.method ? `Conditions: ${c.label} (${c.method} throttling)` : `Conditions: ${c.label}`;
}

/** The conditions line and the lab disclaimer directly below it. */
function _conditionsLines(result) {
  return [_conditionsText(result), LAB_DISCLAIMER];
}


/**
 * Print a formatted Core Web Vitals report to stdout.
 *
 * @param {CWVResult} result
 */
function printReport(result) {
  const CORE   = ['LCP', 'INP', 'CLS'];
  const EXTRA  = ['FCP', 'TTFB'];

  console.log('\n══════════════════════════════════════════════');
  console.log('  Core Web Vitals Report');
  console.log(`  URL:  ${result.url}`);
  console.log(`  Time: ${result.collectedAt}`);
  for (const line of _conditionsLines(result)) console.log(`  ${line}`);
  for (const w of result.warnings || []) console.log(`  ⚠️   Warning: ${w}`);
  console.log('══════════════════════════════════════════════');

  console.log('\n📊  Core Web Vitals  (lab)');
  console.log('──────────────────────────────────────────────');
  for (const name of CORE) {
    const m = result.metrics[name];
    if (m) {
      const icon  = RATING_ICONS[m.rating] || '❔';
      const label = THRESHOLDS[name]?.label || name;
      const good  = name === 'CLS'
        ? `≤${THRESHOLDS[name].good}`
        : `≤${THRESHOLDS[name].good}ms`;
      console.log(`  ${icon}  ${label} (${name})`);
      console.log(`       Value:  ${m.formatted}   [Good: ${good}]`);
      _printAttribution(name, m.attribution);
      _printBreakdown(m.breakdown);
    } else {
      const label = THRESHOLDS[name]?.label || name;
      console.log(`  ⏳  ${label} (${name}) — not captured`);
      if (name === 'INP') {
        console.log('       Requires at least one user interaction.');
        console.log('       Use simulate:true or interact with the page first.');
      }
    }
  }

  console.log('\n📈  Additional Metrics');
  console.log('──────────────────────────────────────────────');
  for (const name of EXTRA) {
    const m = result.metrics[name];
    const label = THRESHOLDS[name]?.label || name;
    if (m) {
      const icon = RATING_ICONS[m.rating] || '❔';
      console.log(`  ${icon}  ${label} (${name}): ${m.formatted}`);
    } else {
      console.log(`  ⏳  ${label} (${name}) — not captured`);
    }
  }

  const allCore = CORE.every((n) => result.metrics[n]);
  const allGood = CORE.filter((n) => result.metrics[n]).every(
    (n) => result.metrics[n].rating === 'good',
  );

  console.log('\n──────────────────────────────────────────────');
  if (allCore && allGood) {
    console.log('  ✅  All Core Web Vitals are good in this lab run');
  } else if (allCore) {
    const failing = CORE.filter(
      (n) => result.metrics[n]?.rating !== 'good',
    ).join(', ');
    console.log(`  ⚠️   Metrics needing improvement: ${failing}`);
  } else {
    const missing = CORE.filter((n) => !result.metrics[n]).join(', ');
    console.log(`  ℹ️   Incomplete capture — missing: ${missing}`);
  }
  console.log(`  Collected in ${result.collectionDurationMs}ms`);
  console.log('══════════════════════════════════════════════\n');
}

function _printBreakdown(breakdown) {
  if (!breakdown) return;
  console.log('       Breakdown:');
  for (const r of _breakdownRows(breakdown)) {
    console.log(`         ${r.label.padEnd(24)} ${String(r.ms + 'ms').padStart(8)} ${String(r.pct + '%').padStart(5)}${r.dominant ? '  ◀ dominant' : ''}`);
  }
}

function _printAttribution(name, attribution) {
  if (!attribution) return;
  switch (name) {
    case 'LCP':
      if (attribution.target) console.log(`       Element: ${attribution.target}`);
      if (attribution.url)    console.log(`       Resource URL: ${attribution.url}`);
      break;
    case 'CLS':
      if (attribution.largestShiftTarget)
        console.log(`       Largest shift element: ${attribution.largestShiftTarget}`);
      break;
    case 'INP':
      if (attribution.interactionType && attribution.interactionTarget)
        console.log(`       ${attribution.interactionType} on: ${attribution.interactionTarget}`);
      break;
  }
}

/**
 * Print a side-by-side comparison of multiple CWV results.
 *
 * @param {CWVResult[]} results
 */
function printComparison(results) {
  const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  console.log('\n══════════════════════════════════════════════');
  console.log('  Core Web Vitals — Multi-URL Comparison');
  console.log('══════════════════════════════════════════════');

  const labels = results.map((r) => (_hasConditions(r) ? _conditionsText(r) : UNSPECIFIED_COPY));
  const shared = results.length > 0 && labels.every((l) => l === labels[0]);
  if (shared) {
    console.log(`  ${labels[0]}`);
    console.log(`  ${LAB_DISCLAIMER}`);
  }

  for (const [i, r] of results.entries()) {
    const shortUrl = r.url.replace(/^https?:\/\//, '').slice(0, 60);
    console.log(`\n  🌐  ${shortUrl}${r.warnings?.length > 0 ? ' ⚠' : ''}`);
    if (!shared) console.log(`     ${labels[i]}`);
    if (r.error) {
      console.log(`     ❌  Error: ${r.error}`);
      continue;
    }
    for (const name of METRICS) {
      const m = r.metrics[name];
      if (m) {
        const icon = RATING_ICONS[m.rating] || '❔';
        console.log(`     ${icon}  ${name}: ${m.formatted}`);
      }
    }
  }
  if (!shared) console.log(`\n  ${LAB_DISCLAIMER}`);
  console.log('\n══════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATIONS = {
  CLS: {
    'needs-improvement': [
      'Add explicit `width` and `height` attributes to all `<img>` and `<video>` elements.',
      'Reserve space for ads and embeds with CSS `aspect-ratio` or fixed dimensions.',
      'Avoid inserting DOM content above existing content after initial load.',
    ],
    poor: [
      'Audit all images and videos — missing dimensions are the #1 cause of poor CLS.',
      'Check for web fonts causing FOUT/FOIT — use `font-display: optional` or preload fonts.',
      'Investigate dynamically injected banners, cookie notices, and chat widgets that shift content.',
      'Use CSS `transform` animations instead of properties that trigger layout (top, left, height).',
    ],
  },
  FCP: {
    'needs-improvement': [
      'Eliminate render-blocking CSS — load critical styles inline, defer the rest.',
      'Preconnect to required origins: `<link rel="preconnect" href="https://fonts.gstatic.com">`.',
    ],
    poor: [
      'Inline critical CSS and defer all non-critical stylesheets.',
      'Check server TTFB — a slow server directly delays FCP.',
      'Remove or defer all render-blocking JavaScript in `<head>`.',
    ],
  },
  TTFB: {
    'needs-improvement': [
      'Use a CDN to serve cached responses closer to users.',
      'Enable HTTP/2 and compression (Brotli/gzip) on your server.',
    ],
    poor: [
      'Profile your server-side render time — add caching at the application or edge layer.',
      'Migrate to a CDN with edge caching; dynamic pages can be cached with stale-while-revalidate.',
      'Check for database queries or third-party API calls blocking the initial response.',
    ],
  },
};

const PHASE_RECOMMENDATIONS = {
  timeToFirstByte: [
    'Cache the HTML at a CDN or edge node so the document is served close to the visitor instead of rendered per request.',
    'Profile server render time and slow backend calls (database queries, upstream APIs) that run before the first byte is sent.',
    'Avoid redirect chains on the landing URL; link to the final canonical URL directly.',
  ],
  resourceLoadDelay: [
    'Put the LCP image in the initial HTML as an `<img>` with `fetchpriority="high"` so the preload scanner finds it immediately; preload it only if it is otherwise discovered late (CSS background, JS-injected).',
    'Do not lazy-load the LCP image; remove `loading="lazy"` and any JS that sets `src` after hydration.',
    'Remove render-blocking scripts and stylesheets that delay the browser from requesting the image.',
  ],
  resourceLoadDuration: [
    'Shrink the LCP resource: serve AVIF or WebP at the displayed size, with `srcset` and `sizes` for responsive widths.',
    'Serve the resource from a CDN over HTTP/2 or HTTP/3 with long-lived cache headers.',
    'Reduce competing downloads in the first seconds so the LCP resource gets full bandwidth.',
  ],
  elementRenderDelay: [
    'Remove render-blocking CSS and synchronous scripts that keep the element from painting once its resource has arrived.',
    'Render the LCP element on the server instead of waiting for client-side JavaScript to build it.',
    'If a web font gates the LCP text, use `font-display: swap` and preload the font file.',
  ],
  inputDelay: [
    'Break up long tasks that run during load and idle time so the main thread is free when the user interacts.',
    'Defer or lazy-load third-party scripts (tags, chat widgets, A/B tools) that occupy the main thread.',
    'Avoid starting heavy timers or polling loops that can overlap with user input.',
  ],
  processingDuration: [
    'Break up the event handler and yield to the main thread with `scheduler.yield()` between the visible update and the remaining work.',
    'Move non-urgent work (analytics, logging, state sync) out of the handler with `requestIdleCallback` or a deferred task.',
    'Move heavy computation to a Web Worker, and avoid forced synchronous layout by batching DOM reads before writes.',
  ],
  presentationDelay: [
    'Reduce the amount of DOM the interaction re-renders; scope updates to the changed subtree.',
    'Use `content-visibility: auto` on large off-screen sections to cut style and layout cost.',
    'Avoid expensive CSS selectors and layout-triggering style changes in the frame after the interaction.',
  ],
};

/**
 * Phase-keyed advice for LCP/INP: only for non-good metrics, only phases with
 * share >= 0.1, dominant phase first.
 *
 * @returns {Array<{key:string,label:string,items:string[]}>}
 */
function getPhaseRecommendations(metric) {
  if (!metric || metric.rating === 'good' || metric.rating === 'unknown') return [];
  const b = metric.breakdown;
  if (!b) return [];
  const picked = b.phases.filter((p) => p.share >= 0.1 && PHASE_RECOMMENDATIONS[p.key]);
  picked.sort((x, y) => (y.key === b.dominant) - (x.key === b.dominant));
  return picked.map((p) => ({ key: p.key, label: p.label, items: PHASE_RECOMMENDATIONS[p.key] }));
}

/** Breakdown rows shared by all report formats. */
function _breakdownRows(breakdown) {
  return breakdown.phases.map((p) => ({
    label: p.label,
    ms: Math.round(p.ms),
    pct: Math.round(p.share * 100),
    share: p.share,
    dominant: p.key === breakdown.dominant,
  }));
}

function getRecommendations(name, rating) {
  if (rating === 'good' || rating === 'unknown') return [];
  return RECOMMENDATIONS[name]?.[rating] ?? [];
}

/**
 * Recommendation groups for one metric: phase-keyed for LCP/INP, rating-keyed otherwise.
 * Returns [] or [{ metric, groups: [{ label, items }] }].
 */
function _recommendationGroups(name, m) {
  const groups = (name === 'LCP' || name === 'INP')
    ? getPhaseRecommendations(m).map((g) => ({ label: g.label, items: g.items }))
    : [{ label: null, items: getRecommendations(name, m.rating) }].filter((g) => g.items.length);
  return groups.length ? [{ metric: name, groups }] : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a Markdown report from one or more CWV results.
 *
 * @param {CWVResult|CWVResult[]} results
 * @param {object} [options]
 * @param {string} [options.title]
 * @returns {string} Markdown content
 */
function generateMarkdownReport(results, options = {}) {
  const list  = Array.isArray(results) ? results : [results];
  const title = options.title ?? 'Core Web Vitals Report';
  const now   = new Date().toISOString();
  const CORE  = ['LCP', 'INP', 'CLS'];
  const ALL   = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  const ratingBadge = (r) =>
    r === 'good' ? '✅ Good' : r === 'needs-improvement' ? '⚠️ Needs Improvement' : r === 'poor' ? '🔴 Poor' : '—';

  const lines = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Generated:** ${now}`);
  lines.push('');

  // ── Summary table (multi-URL) ──────────────────────────────────────────
  if (list.length > 1) {
    lines.push('## Summary');
    lines.push('');
    lines.push('| Page | LCP | INP | CLS | FCP | TTFB |');
    lines.push('|------|-----|-----|-----|-----|------|');
    for (const r of list) {
      const shortUrl = r.url ?? 'N/A';
      const cols = ALL.map((n) => {
        const m = r.metrics?.[n];
        return m ? `${m.formatted} ${m.ratingIcon}` : '—';
      });
      lines.push(`| ${shortUrl}${r.warnings?.length > 0 ? ' ⚠' : ''} | ${cols.join(' | ')} |`);
    }
    lines.push('');
  }

  // ── Per-page details ───────────────────────────────────────────────────
  lines.push('## Detailed Results');
  lines.push('');

  for (const r of list) {
    if (list.length > 1) {
      lines.push(`### ${r.url}`);
      lines.push('');
    }

    if (r.error) {
      lines.push(`❌ **Error:** ${r.error}`);
      lines.push('');
      continue;
    }

    lines.push(`**URL:** ${r.url}`);
    lines.push(`**Collected:** ${r.collectedAt ?? now}`);
    lines.push('');
    lines.push(..._conditionsLines(r).map((l) => `${l}  `));
    lines.push('');
    if (r.warnings && r.warnings.length) {
      lines.push('**Warnings:**');
      for (const w of r.warnings) lines.push(`- ${w}`);
      lines.push('');
    }

    // Metric table
    lines.push('| Metric | Value | Rating | Threshold |');
    lines.push('|--------|-------|--------|-----------|');
    for (const name of ALL) {
      const m = r.metrics?.[name];
      const t = THRESHOLDS[name];
      const threshold = t
        ? (t.unit === 'ms' ? `Good ≤${t.good}ms · Poor >${t.poor}ms` : `Good ≤${t.good} · Poor >${t.poor}`)
        : '—';
      if (m) {
        lines.push(`| **${name}** — ${t?.label ?? name} | ${m.formatted} | ${ratingBadge(m.rating)} | ${threshold} |`);
      } else {
        lines.push(`| **${name}** — ${t?.label ?? name} | — | — | ${threshold} |`);
      }
    }
    lines.push('');

    // Attribution
    const hasAttribution = CORE.some((n) => r.metrics?.[n]?.attribution);
    if (hasAttribution) {
      lines.push('#### Attribution');
      lines.push('');
      for (const name of CORE) {
        const m = r.metrics?.[name];
        if (!m?.attribution) continue;
        const a = m.attribution;
        lines.push(`**${name}:**`);
        if (name === 'LCP') {
          if (a.target)  lines.push(`- Element: \`${a.target}\``);
          if (a.url)     lines.push(`- Resource: \`${a.url}\``);
        }
        if (name === 'CLS') {
          if (a.largestShiftTarget) lines.push(`- Largest shifting element: \`${a.largestShiftTarget}\``);
          if (a.largestShiftValue != null) lines.push(`- Shift score: ${a.largestShiftValue.toFixed(4)}`);
        }
        if (name === 'INP') {
          if (a.interactionType && a.interactionTarget)
            lines.push(`- Interaction: \`${a.interactionType}\` on \`${a.interactionTarget}\``);
        }
        lines.push('');
      }
    }

    // Phase breakdowns
    for (const name of ['LCP', 'INP']) {
      const b = r.metrics?.[name]?.breakdown;
      if (!b) continue;
      lines.push(`#### ${name} breakdown`);
      lines.push('');
      lines.push('| Phase | Time | Share |');
      lines.push('|-------|------|-------|');
      for (const row of _breakdownRows(b)) {
        lines.push(`| ${row.label} | ${row.ms}ms | ${row.pct}%${row.dominant ? ' ◀ dominant' : ''} |`);
      }
      lines.push('');
    }

    // Recommendations
    const recs = CORE.flatMap((n) => {
      const m = r.metrics?.[n];
      if (!m) return [];
      return _recommendationGroups(n, m);
    });

    if (recs.length > 0) {
      lines.push('#### Recommendations');
      lines.push('');
      for (const { metric, groups } of recs) {
        lines.push(`**${metric} (${THRESHOLDS[metric].label}):**`);
        for (const g of groups) {
          lines.push('');
          if (g.label) { lines.push(`**${g.label}:**`); lines.push(''); }
          for (const rec of g.items) lines.push(`- ${rec}`);
        }
        lines.push('');
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('*Report generated by the [core-web-vitals skill](https://github.com/GoogleChrome/web-vitals)*');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML REPORT
// ─────────────────────────────────────────────────────────────────────────────

const RATING_COLORS = {
  good:               { bg: '#e6f9f0', border: '#0cce6b', text: '#0a5c30', badge: '#0cce6b' },
  'needs-improvement': { bg: '#fff8e6', border: '#ffa400', text: '#7a4e00', badge: '#ffa400' },
  poor:               { bg: '#fff0ef', border: '#ff4e42', text: '#7a1a14', badge: '#ff4e42' },
  unknown:            { bg: '#f5f5f5', border: '#ccc',    text: '#666',    badge: '#ccc'    },
};

/**
 * Generate a self-contained HTML report from one or more CWV results.
 *
 * @param {CWVResult|CWVResult[]} results
 * @param {object} [options]
 * @param {string} [options.title]
 * @returns {string} HTML content
 */
function generateHtmlReport(results, options = {}) {
  const list  = Array.isArray(results) ? results : [results];
  const title = options.title ?? 'Core Web Vitals Report';
  const now   = new Date().toLocaleString();
  const CORE  = ['LCP', 'INP', 'CLS'];
  const ALL   = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  function metricCard(name, metric) {
    const t = THRESHOLDS[name];
    if (!metric) {
      return `
        <div class="metric-card unknown">
          <div class="metric-name">${name}</div>
          <div class="metric-label">${t?.label ?? name}</div>
          <div class="metric-value">—</div>
          <div class="metric-rating">Not captured</div>
          <div class="metric-threshold">${t ? (t.unit === 'ms' ? `Good ≤${t.good}ms` : `Good ≤${t.good}`) : ''}</div>
        </div>`;
    }
    const c = RATING_COLORS[metric.rating] ?? RATING_COLORS.unknown;
    return `
      <div class="metric-card" style="background:${c.bg};border-top:4px solid ${c.border}">
        <div class="metric-name">${name}</div>
        <div class="metric-label">${t?.label ?? name}</div>
        <div class="metric-value" style="color:${c.border}">${metric.formatted}</div>
        <div class="metric-rating" style="background:${c.badge};color:#fff">${metric.rating.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</div>
        <div class="metric-threshold">${t ? (t.unit === 'ms' ? `Good ≤${t.good}ms · Poor >${t.poor}ms` : `Good ≤${t.good} · Poor >${t.poor}`) : ''}</div>
      </div>`;
  }

  const SEG_COLORS = ['#4361ee', '#7209b7', '#f72585', '#4cc9f0'];

  function breakdownBar(breakdown) {
    const rows = _breakdownRows(breakdown);
    const segs = rows.map((r, i) =>
      `<div class="bd-seg" style="width:${(r.share * 100).toFixed(1)}%;background:${SEG_COLORS[i % SEG_COLORS.length]}" title="${_esc(`${r.label}: ${r.ms}ms`)}"></div>`).join('');
    const legend = rows.map((r, i) =>
      `<span class="bd-key"><i style="background:${SEG_COLORS[i % SEG_COLORS.length]}"></i>${_esc(r.label)} ${r.ms}ms (${r.pct}%)${r.dominant ? ' ◀ dominant' : ''}</span>`).join('');
    return `<div class="bd-bar">${segs}</div><div class="bd-legend">${legend}</div>`;
  }

  function attributionSection(result) {
    const rows = [];
    for (const name of CORE) {
      const m = result.metrics?.[name];
      if (!m?.attribution && !m?.breakdown) continue;
      const a = m.attribution || {};
      const details = [];
      if (name === 'LCP') {
        if (a.target)                  details.push(['Element', `<code>${_esc(a.target)}</code>`]);
        if (a.url)                     details.push(['Resource URL', `<code class="url">${_esc(a.url)}</code>`]);
      }
      if (name === 'CLS') {
        if (a.largestShiftTarget) details.push(['Largest shifting element', `<code>${_esc(a.largestShiftTarget)}</code>`]);
        if (a.largestShiftValue != null) details.push(['Shift score', a.largestShiftValue.toFixed(4)]);
        if (a.loadState)          details.push(['Load state at shift', _esc(a.loadState)]);
      }
      if (name === 'INP') {
        if (a.interactionType && a.interactionTarget)
          details.push(['Interaction', `<code>${_esc(a.interactionType)}</code> on <code>${_esc(a.interactionTarget)}</code>`]);
        if (a.longAnimationFrameEntries?.length) {
          details.push(['Long animation frames', `${a.longAnimationFrameEntries.length} frame(s) blocked`]);
        }
      }
      const bar = m.breakdown ? breakdownBar(m.breakdown) : '';
      if (details.length === 0 && !bar) continue;
      const c = RATING_COLORS[m.rating] ?? RATING_COLORS.unknown;
      rows.push(`
        <div class="attribution-block" style="border-left:3px solid ${c.border}">
          <div class="attribution-metric" style="color:${c.border}">${name} — ${THRESHOLDS[name]?.label ?? name}</div>
          <table class="attribution-table">
            ${details.map(([k, v]) => `<tr><td class="attr-key">${k}</td><td class="attr-val">${v}</td></tr>`).join('')}
          </table>
          ${bar}
        </div>`);
    }
    return rows.length > 0
      ? `<h3>Attribution</h3><div class="attribution-grid">${rows.join('')}</div>`
      : '';
  }

  function recommendationsSection(result) {
    const recs = CORE.flatMap((n) => {
      const m = result.metrics?.[n];
      return m ? _recommendationGroups(n, m) : [];
    });
    if (recs.length === 0) return '';

    const html = recs.map(({ metric: name, groups }) => {
      const m = result.metrics[name];
      const c = RATING_COLORS[m?.rating] ?? RATING_COLORS.unknown;
      const body = groups.map((g) => `${g.label ? `<div class="rec-phase">${_esc(g.label)}</div>` : ''}<ul>${g.items.map((r) => `<li>${_esc(r)}</li>`).join('')}</ul>`).join('');
      return `
        <div class="rec-group">
          <div class="rec-metric-name" style="color:${c.border}">${name} — ${THRESHOLDS[name].label}</div>
          ${body}
        </div>`;
    }).join('');

    return `<h3>Recommendations</h3><div class="rec-section">${html}</div>`;
  }

  function summaryTable() {
    if (list.length < 2) return '';
    const rows = list.map((r) => {
      if (r.error) return `<tr><td>${_esc(r.url)}</td><td colspan="5" class="error">Error: ${_esc(r.error)}</td></tr>`;
      return `<tr>
        <td class="url-cell">${_esc(r.url)}${r.warnings?.length > 0 ? ' ⚠' : ''}</td>
        ${ALL.map((n) => {
          const m = r.metrics?.[n];
          const c = RATING_COLORS[m?.rating ?? 'unknown'];
          return `<td style="color:${c.border};font-weight:600">${m ? m.formatted : '—'}</td>`;
        }).join('')}
      </tr>`;
    });
    return `
      <section class="summary-section">
        <h2>Summary</h2>
        <table class="summary-table">
          <thead><tr><th>Page</th>${ALL.map((n) => `<th>${n}</th>`).join('')}</tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </section>`;
  }

  const pageDetails = list.map((r, i) => {
    const heading = list.length > 1 ? `<h2 class="page-heading">Page ${i + 1}: <span class="page-url">${_esc(r.url)}</span></h2>` : '';
    if (r.error) return `<section class="page-section">${heading}<p class="error">❌ Error: ${_esc(r.error)}</p></section>`;

    const coreCards  = CORE.map((n) => metricCard(n, r.metrics?.[n])).join('');
    const extraCards = ['FCP', 'TTFB'].map((n) => metricCard(n, r.metrics?.[n])).join('');

    const allGood = CORE.every((n) => r.metrics?.[n]?.rating === 'good');
    const summary = allGood
      ? `<div class="page-summary good">✅ All Core Web Vitals are good in this lab run</div>`
      : (() => {
          const failing = CORE.filter((n) => r.metrics?.[n] && r.metrics[n].rating !== 'good');
          const missing = CORE.filter((n) => !r.metrics?.[n]);
          const parts = [];
          if (failing.length) parts.push(`⚠️ Needs improvement: ${failing.join(', ')}`);
          if (missing.length) parts.push(`⏳ Not captured: ${missing.join(', ')}`);
          return `<div class="page-summary warn">${parts.join(' · ')}</div>`;
        })();

    const warningsList = r.warnings && r.warnings.length
      ? `<ul class="warnings">${r.warnings.map((w) => `<li>⚠️ ${_esc(w)}</li>`).join('')}</ul>`
      : '';

    return `
      <section class="page-section">
        ${heading}
        <p class="page-meta">URL: <a href="${_esc(r.url)}">${_esc(r.url)}</a> &nbsp;·&nbsp; Collected: ${r.collectedAt ?? now} &nbsp;·&nbsp; Duration: ${r.collectionDurationMs ?? '—'}ms</p>
        <p class="conditions">${_conditionsLines(r).map(_esc).join('<br>')}</p>
        ${warningsList}
        ${summary}
        <h3>Core Web Vitals</h3>
        <div class="metric-grid core-grid">${coreCards}</div>
        <h3>Additional Metrics</h3>
        <div class="metric-grid extra-grid">${extraCards}</div>
        ${attributionSection(r)}
        ${recommendationsSection(r)}
      </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #f8f9fa; color: #1a1a2e; line-height: 1.6; }
  a { color: #4361ee; }
  code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85em;
         background: #eef0f5; padding: 2px 5px; border-radius: 3px; word-break: break-all; }
  code.url { font-size: 0.78em; }

  header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
           color: #fff; padding: 2.5rem 2rem; }
  header h1 { font-size: 1.8rem; font-weight: 700; }
  header .subtitle { color: #a0aec0; margin-top: .25rem; font-size: .9rem; }

  .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }

  section { background: #fff; border-radius: 12px; padding: 2rem;
            margin-bottom: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  h2 { font-size: 1.3rem; color: #1a1a2e; margin-bottom: 1rem; padding-bottom: .5rem;
       border-bottom: 2px solid #f0f0f5; }
  h3 { font-size: 1rem; color: #4a5568; margin: 1.5rem 0 .75rem;
       text-transform: uppercase; letter-spacing: .05em; }

  .metric-grid { display: grid; gap: 1rem; }
  .core-grid  { grid-template-columns: repeat(3, 1fr); }
  .extra-grid { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 700px) {
    .core-grid, .extra-grid { grid-template-columns: 1fr; }
  }

  .metric-card { border-radius: 10px; padding: 1.25rem; border: 1px solid #e2e8f0;
                 border-top-width: 4px; }
  .metric-card.unknown { background: #f8f9fa; border-color: #dee2e6; border-top-color: #dee2e6; }
  .metric-name  { font-size: 1.4rem; font-weight: 800; letter-spacing: .02em; }
  .metric-label { font-size: .78rem; color: #718096; margin-top: .1rem; margin-bottom: .75rem; }
  .metric-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: .5rem; }
  .metric-rating { display: inline-block; padding: .2rem .65rem; border-radius: 9999px;
                   font-size: .75rem; font-weight: 700; color: #fff; letter-spacing: .03em; }
  .metric-threshold { font-size: .72rem; color: #a0aec0; margin-top: .5rem; }

  .page-meta { font-size: .85rem; color: #718096; margin-bottom: 1rem; }
  .page-heading { font-size: 1.2rem; margin-bottom: .25rem; }
  .page-url { font-weight: 400; font-size: .95rem; color: #4361ee; }
  .page-summary { padding: .65rem 1rem; border-radius: 8px; font-weight: 600;
                  font-size: .9rem; margin-bottom: 1.25rem; }
  .page-summary.good { background: #e6f9f0; color: #0a5c30; }
  .page-summary.warn { background: #fff8e6; color: #7a4e00; }

  .attribution-grid { display: flex; flex-direction: column; gap: .75rem; }
  .attribution-block { padding: .75rem 1rem; border-radius: 6px; background: #fafafa; }
  .attribution-metric { font-weight: 700; font-size: .85rem; margin-bottom: .4rem; }
  .attribution-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
  .attr-key { color: #718096; width: 180px; padding: .2rem 0; vertical-align: top; }
  .attr-val { color: #2d3748; padding: .2rem 0 .2rem .5rem; word-break: break-all; }

  .bd-bar { display: flex; height: 14px; border-radius: 4px; overflow: hidden; margin-top: .6rem; background: #e2e8f0; }
  .bd-seg { height: 100%; min-width: 0; }
  .bd-legend { display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-size: .75rem; color: #4a5568; margin-top: .4rem; }
  .bd-key i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }

  .rec-section { display: flex; flex-direction: column; gap: 1rem; }
  .rec-group { background: #fafafa; border-radius: 8px; padding: 1rem; }
  .rec-metric-name { font-weight: 700; font-size: .88rem; margin-bottom: .5rem; }
  .rec-phase { font-weight: 600; font-size: .82rem; color: #2d3748; margin: .5rem 0 .25rem; }
  .rec-group ul { padding-left: 1.25rem; }
  .rec-group li { font-size: .85rem; color: #4a5568; margin-bottom: .3rem; }

  .summary-section {}
  .summary-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  .summary-table th { background: #f7fafc; font-weight: 700; text-align: left;
                      padding: .6rem .75rem; border-bottom: 2px solid #e2e8f0; }
  .summary-table td { padding: .55rem .75rem; border-bottom: 1px solid #f0f0f5; }
  .summary-table .url-cell { font-size: .8rem; word-break: break-all; max-width: 300px; }

  .error { color: #e53e3e; font-weight: 600; }
  .conditions { color: #4a5568; font-size: .85rem; margin: .5rem 0; }
  .warnings { color: #975a16; font-size: .85rem; margin: .5rem 0 .5rem 1.2rem; }

  footer { text-align: center; padding: 2rem; color: #a0aec0; font-size: .8rem; }
</style>
</head>
<body>
<header>
  <h1>🌐 ${_esc(title)}</h1>
  <div class="subtitle">Generated ${now} · ${list.length} page${list.length > 1 ? 's' : ''} measured · Powered by google/web-vitals</div>
</header>
<div class="container">
  ${summaryTable()}
  ${pageDetails}
</div>
<footer>Report generated by the core-web-vitals skill · <a href="https://web.dev/vitals">web.dev/vitals</a></footer>
</body>
</html>`;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a CWV report to disk.
 * Auto-detects format from the file extension:
 *   .html → HTML report with visual metric cards and recommendations
 *   anything else (.md, .txt, etc.) → Markdown report
 *
 * @param {CWVResult|CWVResult[]} results
 * @param {string} outputPath  - e.g. '/tmp/cwv-report.html' or '/tmp/cwv-report.md'
 * @param {object} [options]   - passed to generateMarkdownReport / generateHtmlReport
 * @returns {string}           - the resolved output path
 */
function saveReport(results, outputPath, options = {}) {
  const resolved = path.resolve(outputPath);
  const ext      = path.extname(resolved).toLowerCase();
  const content  = ext === '.html'
    ? generateHtmlReport(results, options)
    : generateMarkdownReport(results, options);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');

  const format = ext === '.html' ? 'HTML' : 'Markdown';
  console.log(`📄 CWV ${format} report saved: ${resolved}`);
  return resolved;
}

module.exports = {
  printReport,
  printComparison,
  generateMarkdownReport,
  generateHtmlReport,
  saveReport,
};
