# Core Web Vitals Investigation Guide

## Overview

Core Web Vitals are Google's key user experience metrics that directly impact search rankings and ecommerce conversion rates. This document provides investigation frameworks for declining performance and optimization strategies.

**Current Core Web Vitals (as of March 2024):**
1. **Largest Contentful Paint (LCP)** - Loading performance
2. **Interaction to Next Paint (INP)** - Interactivity (replaced FID)
3. **Cumulative Layout Shift (CLS)** - Visual stability

## Performance Thresholds

### Good Performance Targets
- **LCP:** ≤ 2.5 seconds
- **INP:** ≤ 200 milliseconds  
- **CLS:** ≤ 0.1

### Critical Failure Points
- **LCP:** > 4.0 seconds (immediate investigation required)
- **INP:** > 500 milliseconds (significant user impact)
- **CLS:** > 0.25 (major layout instability)

## Investigation Framework

### 1. Initial Triage Questions
- Which metric(s) are declining?
- When did the decline start? (correlate with deployments)
- Is it affecting all pages or specific page types?
- Mobile vs desktop differences?
- Geographic variations?

### 2. Data Collection Priority
1. **Real User Monitoring (RUM) data** - Primary source of truth
2. **Lab data** - For reproducible testing
3. **Business metrics correlation** - Impact on conversions
4. **User feedback** - Qualitative insights

## LCP Investigation Playbook

### Common Causes in Ecommerce
1. **Large product images** - Most frequent culprit
2. **Slow server response times** - TTFB > 800ms
3. **Render-blocking resources** - Critical CSS/JS
4. **Client-side rendering delays** - JavaScript execution
5. **CDN misconfigurations** - Cache misses, wrong origins

### Investigation Steps
```bash
# 1. Check TTFB first
curl -w "@curl-format.txt" -o /dev/null https://your-site.com

# 2. Identify LCP element
# Use Chrome DevTools Performance tab or:
console.log(performance.getEntriesByType('largest-contentful-paint'));

# 3. Analyze resource loading
# Check Network tab for:
# - Large image downloads
# - Blocking resources
# - Failed requests
```

### Quick Fixes Checklist
- [ ] Preload LCP image: `<link rel="preload" as="image" href="hero.jpg">`
- [ ] Add `fetchpriority="high"` to LCP image
- [ ] Check image compression and format (WebP/AVIF)
- [ ] Verify CDN cache hit rates
- [ ] Review server response times

## INP Investigation Playbook

### Understanding INP
INP measures ALL user interactions throughout the session, not just the first. It captures the worst interaction latency.

### Common Ecommerce INP Issues
1. **Heavy JavaScript execution** - Cart updates, filtering
2. **Third-party scripts** - Analytics, reviews, chat widgets
3. **Inefficient event handlers** - Search autocomplete, form validation
4. **Long tasks** - Product data processing
5. **Memory leaks** - SPA navigation issues

### Investigation Steps
```javascript
// 1. Monitor long tasks
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.log('Long task detected:', entry.duration, 'ms');
    }
  }
});
observer.observe({entryTypes: ['longtask']});

// 2. Track specific interactions
document.addEventListener('click', (event) => {
  const startTime = performance.now();
  // Your interaction handler
  requestAnimationFrame(() => {
    const duration = performance.now() - startTime;
    if (duration > 200) {
      console.warn('Slow interaction:', duration, 'ms', event.target);
    }
  });
});
```

### Optimization Priorities
1. **Break up long tasks** - Use `scheduler.postTask()` or `setTimeout()`
2. **Debounce expensive operations** - Search, filtering
3. **Defer non-critical JavaScript** - Analytics, widgets
4. **Optimize event handlers** - Use passive listeners
5. **Implement code splitting** - Load only necessary code

## CLS Investigation Playbook

### High-Risk Elements in Ecommerce
1. **Images without dimensions** - Product photos, banners
2. **Dynamic content insertion** - Promotional banners, reviews
3. **Web fonts** - Custom typography loading
4. **Third-party embeds** - Social media, reviews
5. **Ad placements** - Dynamic advertising content

### Investigation Steps
```javascript
// 1. Track layout shifts in real-time
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      console.log('Layout shift:', entry.value, entry.sources);
    }
  }
});
observer.observe({entryTypes: ['layout-shift']});

// 2. Identify shifting elements
// Check entry.sources for specific DOM elements
```

### Prevention Strategies
```css
/* Reserve space for images */
.product-image {
  aspect-ratio: 1/1; /* or specific ratio */
  width: 100%;
}

/* Stable font loading */
@font-face {
  font-family: 'Custom Font';
  font-display: swap; /* or block for critical text */
  src: url('font.woff2') format('woff2');
}
```

## Performance Regression Analysis

### Deployment Correlation
1. **Check deployment timeline** against performance drops
2. **Review changed files** - Focus on critical path resources
3. **Analyze bundle size changes** - JavaScript, CSS increases
4. **Third-party updates** - Analytics, widgets, CDN changes

### A/B Test Impact Analysis
```javascript
// Monitor performance by experiment variant
gtag('event', 'web_vitals', {
  metric_name: 'LCP',
  metric_value: lcpValue,
  experiment_variant: getExperimentVariant(),
  page_type: getPageType()
});
```

## Monitoring Setup

### Essential Metrics Collection
```javascript
import {getCLS, getINP, getLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  // Include contextual data for investigation
  const data = {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    page_type: getPageType(),
    user_agent: navigator.userAgent,
    connection_type: navigator.connection?.effectiveType,
    timestamp: Date.now()
  };
  
  // Send to your analytics platform
  analytics.track('core_web_vital', data);
}

getCLS(sendToAnalytics);
getINP(sendToAnalytics);
getLCP(sendToAnalytics);
```

### Alert Thresholds
- **LCP > 3.0s** for any page type
- **INP > 300ms** sustained over 1 hour
- **CLS > 0.15** for product/checkout pages
- **Week-over-week degradation > 20%**

## Business Impact Assessment

### Correlation Analysis
```sql
-- Example query to correlate CWV with conversions
SELECT 
  date,
  avg_lcp,
  avg_inp, 
  avg_cls,
  conversion_rate,
  revenue_per_session
FROM performance_metrics p
JOIN business_metrics b ON p.date = b.date
ORDER BY date DESC;
```

### Impact Estimation
- **1 second LCP improvement** ≈ 8% conversion increase
- **100ms INP improvement** ≈ 5% engagement increase  
- **0.1 CLS improvement** ≈ 3% bounce rate reduction

## Investigation Tools

### Primary Tools
1. **Chrome DevTools Performance Tab** - Detailed analysis
2. **WebPageTest** - Comprehensive testing with video
3. **PageSpeed Insights** - Combined lab and field data
4. **Search Console Core Web Vitals Report** - Historical trends

### Advanced Analysis
1. **Lighthouse CI** - Automated performance testing
2. **SpeedCurve/Catchpoint** - Continuous monitoring
3. **Real User Monitoring platforms** - DataDog, New Relic
4. **Chrome UX Report (CrUX)** - Google's field data

### Investigation Commands
```bash
# Lighthouse CI for regression testing
lhci autorun --upload.target=temporary-public-storage

# WebPageTest API for automated testing  
curl "https://www.webpagetest.org/runtest.php?url=https://example.com&k=API_KEY&f=json"

# Chrome UX Report API
curl "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"origin": "https://example.com"}'
```

## Quick Diagnostic Checklist

### When Performance Suddenly Drops
1. **Recent deployments?** - Code, infrastructure, third-party
2. **CDN issues?** - Cache hit rates, origin response times
3. **Third-party degradation?** - Analytics, ads, widgets
4. **Traffic spikes?** - Server performance under load
5. **Geographic issues?** - Regional CDN problems
6. **Mobile vs desktop?** - Device-specific problems

### Emergency Response
1. **Identify scope** - All pages or specific sections
2. **Check infrastructure** - Server health, CDN status
3. **Review recent changes** - Code, configuration, content
4. **Implement quick wins** - Cache headers, image optimization
5. **Create rollback plan** - If deployment-related

## Optimization Priority Matrix

### High Impact, Low Effort
- Image optimization (format, compression)
- Critical resource preloading
- Cache header optimization
- Third-party script auditing

### High Impact, High Effort  
- Code splitting implementation
- Server-side rendering optimization
- Database query optimization
- Infrastructure upgrades

### Low Impact, Low Effort
- Minification improvements
- Font loading optimization
- Minor JavaScript optimizations
- CSS cleanup

This investigation guide provides a systematic approach to diagnosing and resolving Core Web Vitals performance issues, with specific focus on ecommerce applications and maintaining optimal user experience.