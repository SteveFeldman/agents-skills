# Troubleshooting

**The report says "Measurement conditions were not recorded".**
`web-vitals` is vendored in `lib/vendor/` and injected through `page.evaluate`, so there is no network dependency. Page CSP does not block it. A page made with a plain `browser.newContext()` still measures, but its conditions are not recorded and results are likely unthrottled desktop; use `createMeasuredPage` so the conditions are recorded.

**Conditions show "unspecified".**
The page was created outside `createMeasuredPage`, or `conditions` was not passed to `collectCWV`. Rerun with both. Results are likely unthrottled desktop until then.

**INP is not captured.**
- INP needs a click, tap or key press. Scrolling does not count toward INP.
- Keep `simulate: true` (default) or pass `interact`. The simulated input avoids links and other interactive elements, so a page whose only elements are interactive may get no qualifying input; use `interact` to click something specific.
- A navigation during collection discards the later document's metrics (see the warning).

**A warning says the page navigated during collection.**
The page left the original document, for example a link click or a script redirect. Metrics are from before the navigation and INP may be missing. Same-document changes such as `pushState` do not trigger this. Split a multi-page flow into one run per page.

**LCP is missing or 0.**
- Wait for the page to render the largest element before collecting; raise `waitAfterLoad` or wait for a selector first.
- A page that never reaches the `load` event within 15 s produces a warning and may report a truncated LCP.

**Runs disagree.**
Single runs vary by 10 to 20%. Take at least 3 runs, report the median (Pattern 7 in `patterns.md`), compare on the same preset, and keep cache state the same. Do not call a regression from one run.

**localhost looks much faster than production.**
Local servers have near-zero latency, and under emulation the TTFB metric may still not reflect the configured latency (see `conditions.md`). Test a deployed URL for anything you report.

**CLS is unexpectedly high.**
See `cls.md`: separate the shift source from the shifted element.

**Auth-gated or cookie-gated pages.**
Pass a saved storage state as the third argument:

```javascript
const { page, conditions } = await createMeasuredPage(browser, 'mobile', {
  storageState: '/tmp/auth-state.json',
});
```

**`createMeasuredPage` throws about Chromium, or `measureMultipleUrls` returns errors.**
`mobile` and `desktop` use Chrome DevTools throttling. `createMeasuredPage` throws in Firefox or WebKit; `measureMultipleUrls` does not throw for that, it returns an error entry for each URL. An unknown preset name throws up front. In Firefox or WebKit, use `preset: 'none'` and say the result is unthrottled.

**Headless versus headed numbers differ.**
Expected to a small degree. Use one mode for a comparison series. Headless mode is set by the `headless` option in the script's `chromium.launch()`; `HEADLESS=true` has no effect on these scripts.

**Tips**
- Navigate first with `waitUntil: 'domcontentloaded'`, then collect; `networkidle` is fragile with analytics beacons.
- Compare across deploys under the same preset; that is where lab data helps most.
