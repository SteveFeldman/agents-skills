# Diagnosing CLS

CLS (good at or under 0.1, poor over 0.25) sums layout shifts that happen without a recent user input. It is unitless. Two questions identify the fix, and they are different things: what **caused** the shift, and which element **moved**.

`attribution.largestShiftTarget` names the element that moved most in the largest shift. It is the victim, not necessarily the cause. The cause is usually something that arrived or changed size just before: a late image, an ad slot, an injected banner, a font swap.

## Shift source (what caused it)

| Source | Signs | Fix |
|---|---|---|
| Image or video without reserved space | Content below jumps when the media loads | Set `width` and `height` attributes or CSS `aspect-ratio` |
| Ad, embed or widget slot | Slot grows after the response arrives | Reserve the slot's minimum height; do not collapse an unfilled slot above content |
| Content injected above existing content | Banners, cookie notices, promos pushing the page down | Insert below the fold, overlay with fixed or absolute position, or reserve space up front |
| Web font swap | Text reflows when the font loads | Preload the font, use `font-display: optional` or a metric-matched fallback (`size-adjust`) |
| Late-rendered client UI | Placeholder replaced by a different-sized component | Match the skeleton size to the final size |
| Animations on layout properties | Animating `top`, `height`, `margin` | Animate `transform` and `opacity` instead |

## Shifted element (what moved)

Use `largestShiftTarget` to find where to look, then check the elements directly above and beside it for the source in the table. Fixing the shifted element's own styles rarely helps; fix what pushed it.

## Lab caveats

- CLS is cumulative over the page's life. The collector reads it after load plus the wait; shifts from later lazy-loaded content are not seen unless you extend `waitAfterLoad`.
- Shifts within 500 ms after a click or key press are excluded by the browser. Simulated input may therefore hide a shift that follows an interaction; and shifts caused by scrolling to lazy content appear only if you scroll in `interact`.
- A page can shift differently with a cold cache, other viewport sizes, or consent states. Name the preset and the state you measured.

Approach informed by Addy Osmani's web-quality-skills (MIT) and web.dev.
