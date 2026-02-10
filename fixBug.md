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
  - 新增 `scheduleTrim()`：滚动活跃时先 `hide`，停止后再 `trim` 回收。
  - `destroy()` 增加 `trimTimeout/scrollTimeout` 清理。
- 在 `vendor/epubjs/LOCAL_PATCHES.md` 写入补丁背景与细节，便于后续升级合并。

### 验证

- 执行 `npm run build`，编译通过。
