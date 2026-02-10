# 产品功能记录（增量）

## 2026-02-10 阅读稳定性增强

- 阅读器底层切换到本地 fork 的 `epubjs`（`vendor/epubjs`）以支持定制修复。
- 新增纯原生验证页：`/epub-native-test`，用于隔离业务逻辑验证 `epub.js` 基线行为。
- 完成连续滚动跨章节稳定化补丁（进度跳变与内容闪烁方向），当前补丁说明见：
  - `vendor/epubjs/LOCAL_PATCHES.md`
