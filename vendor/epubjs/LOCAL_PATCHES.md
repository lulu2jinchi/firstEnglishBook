# Local Patches (firstEnglishBook)

This file records behavior fixes applied on top of upstream `epubjs@0.3.93`.

## 2026-02-10 - continuous manager cross-section scroll jitter/flicker

### Symptoms

- In `manager: "continuous"` + `flow: "scrolled-continuous"` mode on mobile,
  fast upward scrolling around chapter boundaries could cause:
  - progress relocation jitter (location briefly jumps)
  - visible content flicker (iframe repaint / teardown-rebuild effect)

### Root Causes

1. `check()` could read stale `this.scrollTop / this.scrollLeft` while view
   prepend/append and recycle work was still happening.
2. `SCROLLED` events were emitted before `check()` finished, so relocation
   could be calculated against transient view state.
3. `update()` repeatedly called `view.show()` for already-visible iframes,
   triggering unnecessary forced repaint logic.
4. Offscreen views were destroyed too aggressively during active momentum
   scrolling, causing rapid teardown and re-render near section boundaries.

### Patch Summary

- Added real-time scroll sync helpers:
  - `getScrollPosition()`
  - `syncScrollPosition()`
- `check()` now re-syncs scroll offsets before boundary calculation.
- `scrolled()` now waits for queued `check()` before emitting `SCROLLED`, and
  drops stale callbacks with `scrolledRequestId`.
- `update()` calls `view.show()` only when visibility is actually hidden.
- Introduced delayed trim strategy via `scheduleTrim()`:
  - postpone `trim()` until scroll delta calms down
- `trim()` now computes recycle range from currently visible views instead of
  relying on `displayed()` only, so cleanup remains effective without forcing
  offscreen views hidden during active scrolling.
- Added timer cleanup in `destroy()` to avoid stale async callbacks.

### Files

- `vendor/epubjs/src/managers/continuous/index.js`
