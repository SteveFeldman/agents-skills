# Diagnosing INP by phase

INP (good at or under 200 ms, poor over 500 ms) is the worst, or close to the worst, interaction latency during a visit. Only clicks, taps and key presses count. Scrolling and hovering do not count toward INP. With no qualifying interaction there is no INP value at all, which is "not captured", not "zero".

`metrics.INP.breakdown` splits the slowest interaction into three phases. State the dominant phase in milliseconds and name the interaction (`attribution.interactionType` on `attribution.interactionTarget`).

| Phase key | What it covers |
|---|---|
| `inputDelay` | Input received until its event handlers start |
| `processingDuration` | Time the event handlers run |
| `presentationDelay` | Handlers done until the next frame is painted |

Skip any phase under 10% of the total.

## inputDelay dominant

The main thread was busy when the user acted.
- Long tasks from startup scripts, hydration, analytics or timers. Break them up and defer non-essential work.
- Heavy work scheduled right after load; the collector sends input after the load event, so work that runs shortly after load can show up here.
- Third-party scripts; check whether they run at the time of the input.

## processingDuration dominant

Your handlers are slow.
- Do the minimum needed to update the UI first, and defer the rest (`requestAnimationFrame` then `setTimeout`, or the scheduler API where available).
- Avoid synchronous layout reads after writes inside handlers.
- Reduce framework work per interaction: memoise, virtualise long lists, avoid re-rendering large trees.

## presentationDelay dominant

The frame after the handlers is slow to produce.
- Large DOM size makes style and layout expensive; reduce it.
- Expensive CSS (broad selectors, large paint areas, filters) on elements that change.
- Work triggered by the interaction that finishes after the handler, such as observers or effects.

## Getting a meaningful INP in the lab

- The default simulated input clicks safe, non-interactive spots and presses Tab and Shift; it will not exercise your real features. For the interaction that matters, pass `interact`:

```javascript
const result = await collectCWV(page, {
  conditions,
  interact: async (p) => {
    await p.getByRole('searchbox').click();
    await p.keyboard.type('red shoes', { delay: 80 });
  },
});
```

- Measure on the `mobile` preset; 4x CPU slowdown exposes handler cost.
- Keep the whole interaction on one document. A navigation during collection yields a warning and keeps only the pre-navigation metrics.
- The slowest interaction wins, so test the heaviest control (menu, filter, add to cart), not the page centre.

Approach informed by Addy Osmani's web-quality-skills (MIT) and web.dev.
