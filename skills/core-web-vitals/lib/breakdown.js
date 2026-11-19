'use strict';

const PHASES = {
  LCP: [
    ['timeToFirstByte', 'Time to first byte'],
    ['resourceLoadDelay', 'Resource load delay'],
    ['resourceLoadDuration', 'Resource load duration'],
    ['elementRenderDelay', 'Element render delay'],
  ],
  INP: [
    ['inputDelay', 'Input delay'],
    ['processingDuration', 'Processing duration'],
    ['presentationDelay', 'Presentation delay'],
  ],
};

/**
 * Turn web-vitals attribution into ordered phases with time and share.
 *
 * @param {'LCP'|'INP'|string} name
 * @param {object|null} attribution
 * @returns {{phases: Array<{key:string,label:string,ms:number,share:number}>, dominant: string}|null}
 */
function getBreakdown(name, attribution) {
  const defs = PHASES[name];
  if (!defs || !attribution) return null;

  const phases = [];
  for (const [key, label] of defs) {
    const v = attribution[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    phases.push({ key, label, ms: Math.max(0, v), share: 0 });
  }
  if (phases.length === 0) return null;

  const sum = phases.reduce((s, p) => s + p.ms, 0);
  for (const p of phases) p.share = sum > 0 ? p.ms / sum : 0;

  const dominant = phases.reduce((best, p) => (p.ms > best.ms ? p : best), phases[0]).key;
  return { phases, dominant };
}

module.exports = { getBreakdown };
