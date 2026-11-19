# Diagnosing LCP by phase

LCP (good at or under 2500 ms, poor over 4000 ms) is the time until the largest image or text block in the viewport is painted. `metrics.LCP.breakdown` splits it into four phases that add up to the whole. Find `breakdown.dominant`, state its milliseconds, name the element (`attribution.target`) and, for images, the resource (`attribution.url`), then fix that phase only. Skip any phase under 10% of the total.

| Phase key | What it covers | Typical share (rough rule of thumb, not a pass/fail threshold) |
|---|---|---|
| `timeToFirstByte` | Navigation start until the first byte of the HTML | about 40% |
| `resourceLoadDelay` | First byte until the browser starts fetching the LCP resource | under 10% |
| `resourceLoadDuration` | Download time of the LCP resource | about 40% |
| `elementRenderDelay` | Resource finished until the element is painted | under 10% |

Recommendations follow the dominant phase in milliseconds, not the share column.

If the LCP element is text with no resource, the two resource phases are near zero and the time sits in the first and last phases.

## timeToFirstByte dominant

- Measure the server: slow origin work, no caching, a cold function or database query.
- Redirect chains add whole round trips; link to the final URL.
- Serve HTML from a CDN or edge cache where the content allows it.
- On localhost this phase is misleading under emulated latency; see `conditions.md`.

## resourceLoadDelay dominant

The browser found the LCP resource late. Common causes:
- The image is set from JavaScript, or sits in a CSS background, so the preload scanner cannot see it. Put it in the HTML as an `img` with a `src`.
- The image is lazy-loaded (`loading="lazy"`) although it is above the fold. Remove it for the LCP image.
- Scripts or stylesheets ahead of it block discovery. Add `<link rel="preload" as="image">` or `fetchpriority="high"` on the LCP image.

## resourceLoadDuration dominant

The file is too heavy for the connection.
- Resize to the displayed size and use `srcset` and `sizes`.
- Use a modern format (AVIF or WebP) and an appropriate quality.
- Serve from a CDN with compression and HTTP caching.
- Reduce competing downloads at the same time (raise the LCP image priority, lower the rest).

## elementRenderDelay dominant

The resource is ready but the element is not painted.
- Render-blocking CSS or synchronous scripts in the head.
- The element is inserted by client-side rendering after a framework boots; render it on the server.
- A loading overlay, skeleton or animation hides the element; the largest paint only counts once visible.
- Long main-thread tasks between load and paint; split or defer them.

## Measuring a fix

Re-run under the same preset, at least 3 times, and compare medians. Report the phase that moved, in milliseconds. The lab run does not predict a field change; see `conditions.md`.

Note that the browser stops tracking LCP at the first user input. The collector waits for the load event before sending any input for that reason.

Approach informed by Addy Osmani's web-quality-skills (MIT) and web.dev.
