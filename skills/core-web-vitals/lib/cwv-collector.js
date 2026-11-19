'use strict';

/**
 * Core Web Vitals collector for Playwright (public API barrel).
 *
 * Usage:
 *   const { collectCWV, printReport, assertCWV } = require('/path/to/cwv-collector');
 *   const result = await collectCWV(page, { simulate: true });
 *   printReport(result);
 *   assertCWV(result, { LCP: 2500, CLS: 0.1 });
 */

const { THRESHOLDS, getRating, formatValue } = require('./thresholds');
const { collectCWV, assertCWV, measureMultipleUrls, WEB_VITALS_CDN, WEB_VITALS_VERSION } = require('./collect');
const { PRESETS, createMeasuredPage } = require('./conditions');
const {
  printReport,
  printComparison,
  generateMarkdownReport,
  generateHtmlReport,
  saveReport,
} = require('./reports');

module.exports = {
  collectCWV,
  createMeasuredPage,
  PRESETS,
  printReport,
  assertCWV,
  measureMultipleUrls,
  printComparison,
  generateMarkdownReport,
  generateHtmlReport,
  saveReport,
  THRESHOLDS,
  WEB_VITALS_CDN,
  WEB_VITALS_VERSION,
  getRating,
  formatValue,
};
