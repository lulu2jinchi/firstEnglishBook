# Bug 修复记录

## 2026-02-10 跨章节快速上滑导致进度跳变与内容闪烁

### 现象

- 在移动端模式下，`scrolled-continuous` 连续滚动跨章节时，阅读进度会突然跳变。
- 在快速连续上滑时，正文出现闪烁（章节边界附近明显）。

### 根因

1. `epub.js` continuous 管理器在章节 prepend/append + trim 的过程中，`check()` 可能使用了非实时滚动位置。
2. `SCROLLED` 事件触发早于 `check()` 完成，导致 relocation 基于瞬态状态计算。
3. 已可见视图反复执行 `show()`，触发 iframe 强制重绘逻辑。
4. 滚动期间离屏视图被过早 `destroy()`，造成 iframe 频繁卸载重建。

### 解决方案

- 在 `vendor/epubjs/src/managers/continuous/index.js` 中：
  - 新增实时滚动同步：`getScrollPosition()` / `syncScrollPosition()`。
  - `check()` 计算边界前强制同步当前滚动偏移。
  - `scrolled()` 等待 `check()` 完成后再发 `SCROLLED`，并用 `scrolledRequestId` 丢弃过期回调。
  - `update()` 对已显示视图仅在 hidden 状态下才调用 `show()`。
  - 新增 `scheduleTrim()`：滚动活跃时不立即回收，停止后再 `trim`。
  - `trim()` 基于当前可见区计算可回收范围（而不是仅依赖 displayed 列表），避免“只显示一章节/空白区”。
  - `destroy()` 增加 `trimTimeout/scrollTimeout` 清理。
- 在 `vendor/epubjs/LOCAL_PATCHES.md` 写入补丁背景与细节，便于后续升级合并。

### 验证

- 执行 `npm run build`，编译通过。

## 2026-02-10 reader 页面仅显示单章节（未连续加载）

### 现象

- 访问 `/reader?book=...` 时，看起来只显示一个章节内容，上下滚动不会持续加载前后章节。

### 根因

1. `ReaderShell` 默认将“滚动引擎”设为稳定模式（`experimentalContinuous=false`），对应 `scrolled-doc`。
2. `useReader` 在触屏设备上通过 coarse pointer 检测强制禁用连续滚动，进一步固定为单章节渲染。

### 解决方案

- `app/components/ReaderShell.vue`
  - 将 `experimentalContinuousScroll` 默认值从 `false` 改为 `true`（无 query 时默认启用连续滚动）。
- `app/composables/useReader.ts`
  - 移除触屏设备强制降级逻辑（不再因 coarse pointer 自动禁用连续滚动）。
- 仍保留手动切换能力：用户可在“滚动引擎”里切回稳定模式，或使用 query 参数显式关闭。

### 验证

- 访问 `http://localhost:3000/reader?book=book/Hold+Me+Tight+Seven+Conversations+For+A+Lifetime+Of+Love+(Dr.+Sue+Johnson)+(Z-Library).epub`。
- 默认即为连续滚动模式，可跨章节持续加载上下内容。

## 2026-02-10 reader 连续滚动上滑仍有跳变（与 epub-native-test 行为不一致）

### 现象

- `epub-native-test` 基线页上滑已稳定；
- 但 `/reader` 上滑跨章节仍会出现跳变。

### 根因

- `/reader` 在 `attachContentHooks` 中存在 `wheel fallback`：
  - 当容器被判断为“不可滚动”时，会 `preventDefault()` 并触发 `rendition.prev()/next()`。
  - 这会在连续滚动模式下引入额外翻章动作，表现为上滑跳变。
- `epub-native-test` 不包含这段逻辑，所以两页表现不同。

### 解决方案

- `app/composables/useReader.ts`
  - 在 `handleWheelFallback` 中，`scrolled-continuous` 模式直接 `return`，禁用 fallback。
  - 连续滚动完全交给 epub.js continuous manager 处理章节边界。
  - 连续滚动模式下禁用“可见段落自动同步/自动释义”链路（停滚后不再自动改写段落 DOM），避免停下瞬间触发回流导致跳变。
  - 仍保留双击段落的手动释义能力，兼顾可用性与滚动稳定性。

## 2026-02-10 实验性连续滚动恢复翻译能力（稳态触发）

### 诉求

- 在 `scrolled-continuous` 模式下，也需要保留单词翻译能力。

### 调整

- 重新启用连续模式的“可见段落自动同步/自动释义”。
- 为降低停滚跳变风险，增加稳态约束：
  - 连续模式可见段落同步防抖提升为 `1800ms`；
  - 连续模式仅处理可见比例 `>= 0.55` 的段落；
  - 连续模式段落改写前的停滚窗口提升为 `1500ms`。
- 连续模式下仍保持禁用 `wheel fallback (prev/next)`，避免额外翻章。

## 2026-02-10 夜间模式释义气泡对比度不足

### 现象

- 切换到 `夜间` 主题后，点击单词出现的释义 tooltip 仍是固定深色底。
- 在深色阅读背景上层次不明显，文字可读性下降。

### 根因

- 释义 tooltip 样式在 `useReader.ts` 中使用固定颜色（深底浅字），没有根据阅读主题切换。

### 解决方案

- 在 `app/composables/useReader.ts` 增加 tooltip 配色同步逻辑：
  - 根据当前阅读背景亮度自动判定浅色/深色主题。
  - 深色主题（夜间）下切换为浅底深字气泡，并补充浅色边框。
  - 浅色主题下保持深底浅字。
- 在 `setReaderTheme` 内同步刷新 tooltip 样式，确保切换主题后立即生效。

### 验证

- 切换到 `夜间` 主题后，点击单词，释义气泡为浅底深字。
- 切回浅色主题后，释义气泡恢复深底浅字。
- 执行 `npm run build`，编译通过。
