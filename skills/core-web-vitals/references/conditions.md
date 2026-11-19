# Measurement conditions

## Presets

| Preset | Report label | Emulation | Network | CPU |
|---|---|---|---|---|
| `mobile` (default) | Mobile (Moto G Power, Slow 4G, 4× CPU) | 412x823, DPR 1.75, mobile and touch, Moto G Power user agent | 150 ms latency, 1638.4 kbps down, 750 kbps up (Slow 4G) | 4x slowdown |
| `desktop` | Desktop (1350×940, 40ms RTT, 10 Mbps) | 1350x940, DPR 1 | 40 ms latency, 10 Mbps both ways | none |
| `none` | No throttling (unthrottled host machine) | none | none | none, explicitly unthrottled |

`createMeasuredPage(browser, preset, contextOptions)` returns `{ context, page, conditions }`. `conditions` carries the preset name, its label, the throttling method and the values; pass it to `collectCWV` so every report states it. The context always sets `bypassCSP: true` so the injected library works on strict-CSP pages.

## Why mobile is the default

Most real visits are on phones, and mobile hardware on a mobile network exposes the problems that fast machines hide. A desktop result on a developer laptop says little about the slowest users, so measure `mobile` unless the question is specifically about desktop. Use `none` when you want the host machine's raw numbers, and say so.

Consequences:
- Throttled presets (`mobile`, `desktop`) need Chromium, because they use the Chrome DevTools Protocol. `createMeasuredPage` throws on other browsers.
- `measureMultipleUrls` defaults to mobile and therefore requires Chromium. For other browsers pass `preset: 'none'`.

## DevTools-applied versus Lighthouse-simulated throttling

This skill applies throttling live through DevTools: the browser really is slower, and the page really loads over the slowed connection. Lighthouse by default loads unthrottled and then computes what the load would have looked like under slow conditions (simulated throttling). The two methods give different numbers for the same page, so do not compare a value from this skill with a Lighthouse score or subtract one from the other. Compare like with like: same tool, same preset.

## Local servers

On a local or loopback server, emulated network latency may not show up in the TTFB metric. Chrome's navigation timing on loopback is not shifted by DevTools latency emulation, so compare total load time instead, or test against a deployed URL. Localhost LCP is also usually unrealistically fast; do not report it as representative.

## Headless

- `run.js` from playwright-dev defaults to a visible browser; `HEADLESS=true` runs headless. Both work for CWV.
- Headless and headed runs can differ a little. Pick one for a series of comparisons and stay with it.
- Do not add GPU-related launch flags to chase a number; keep the launch arguments the same across runs you intend to compare.
- Run the browser on an otherwise idle machine. Other load adds noise, especially with CPU throttling.

## Lab versus field

- Lab data (this skill) is one synthetic load under fixed conditions. It is repeatable and good for diagnosing and for catching regressions.
- Field data is the 75th percentile (p75) of real visits over the previous 28 days. It is what Google's page experience assessment uses. Find it in PageSpeed Insights (the field section at the top), Search Console (Core Web Vitals report), or the user's own RUM.
- Never subtract a lab number from a field number, or present one as the other. The populations, devices, networks, caches and time windows differ, so the difference means nothing. Use lab data to find and fix a cause, then wait for field data (about 28 days of new visits) to confirm the effect.
