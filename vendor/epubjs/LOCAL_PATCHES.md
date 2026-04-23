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

## 2026-04-23 iOS 微信浏览器打开书籍时报 `replacements[i]` TypeError

### Symptoms

- 在 iOS 微信内置浏览器打开书籍详情或进入阅读前的资源准备阶段时，控制台连续报错：
  - `undefined is not an object (evaluating 'replacements[i]')`
- 报错栈指向 `vendor/epubjs/src/utils/replacements.js` 与 `vendor/epubjs/src/resources.js`。

### Root Causes

1. `Resources.replacements()` 在批量生成资源替换 URL 后，对失败项执行了 `filter()`。
2. `filter()` 会压缩数组，导致 `replacementUrls` 的索引与原始 `this.urls` 不再一一对应。
3. iOS 微信中个别资源更容易创建失败，放大了这个错位问题。
4. `substitute()` 默认假设 `replacements` 一定存在且索引可取，缺少兜底判定。

### Patch Summary

- `vendor/epubjs/src/resources.js`
  - 保留 `replacementUrls` 的原始索引结构，失败项写为 `null`，不再 `filter()` 压缩。
  - `get(path)` 在目标替换 URL 缺失时，回退到按需 `createUrl(path)`，避免返回空值。
  - 为 `createUrl/replacements/replaceCss/createCssFile/relativeTo/get/substitute` 增加销毁态保护，避免对象销毁后异步回调继续访问 `this.settings`。
  - 为 `replaceCss()` 的异步回调补充 `this.urls / this.replacementUrls` 判空，避免销毁后继续执行 `this.urls.indexOf(...)`。
  - 新增 `destroyed` 标记，`destroy()` 后将内部数组重置为空数组而非 `undefined`，降低后续异步访问风险。
  - `process/split/splitUrls` 增加空输入容错，避免 manifest 或资源列表异常时继续抛错。
- `vendor/epubjs/src/book.js`
  - 新增 `destroyed` 标记，对 `open/openEpub/openContainer/openPackaging/openManifest/load/unpack/loadNavigation/store/replacements/coverUrl` 增加销毁态和空值保护。
  - 关键异步链在回调执行前确认 `Book/Resources` 仍然存活且实例未切换，避免销毁后继续 `resolve` 或写入状态。
  - `destroy()` 现在会同步销毁 `storage`，减少离线缓存与资源替换链在页面退出后的残留回调。
- `vendor/epubjs/src/utils/replacements.js`
  - 为 `content / urls / replacements` 增加数组与类型兜底判断。
  - 仅在 `url` 与对应 `replacement` 都是字符串时才执行替换。

### Files

- `vendor/epubjs/src/resources.js`
- `vendor/epubjs/src/book.js`
- `vendor/epubjs/src/utils/replacements.js`
