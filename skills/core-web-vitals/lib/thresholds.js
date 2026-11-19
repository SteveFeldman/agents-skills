'use strict';

// Google-defined thresholds (good / needs-improvement boundary, poor boundary)
const THRESHOLDS = {
  LCP:  { good: 2500,  poor: 4000,  unit: 'ms', label: 'Largest Contentful Paint' },
  INP:  { good: 200,   poor: 500,   unit: 'ms', label: 'Interaction to Next Paint' },
  CLS:  { good: 0.1,   poor: 0.25,  unit: '',   label: 'Cumulative Layout Shift' },
  FCP:  { good: 1800,  poor: 3000,  unit: 'ms', label: 'First Contentful Paint' },
  TTFB: { good: 800,   poor: 1800,  unit: 'ms', label: 'Time to First Byte' },
};

const RATING_ICONS = { good: '✅', 'needs-improvement': '⚠️ ', poor: '🔴', unknown: '❔' };

function getRating(name, value) {
  const t = THRESHOLDS[name];
  if (!t || value == null) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function formatValue(name, value) {
  if (value == null) return 'N/A';
  const t = THRESHOLDS[name];
  if (t?.unit === 'ms') return `${Math.round(value)}ms`;
  return Number(value).toFixed(4);
}

module.exports = { THRESHOLDS, RATING_ICONS, getRating, formatValue };
