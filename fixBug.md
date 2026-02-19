# Bug 修复记录

## 2026-02-19 自动释义漏词时无法手动查词

### 现象

- 在 `/reader` 阅读时，部分词不会被自动标注为可点击释义。
- 用户即使已在移动端长按选中该词，也没有直接查词入口。

### 根因

1. 现有交互只支持“自动标注词 -> 点击/Shift 查看释义”。
2. 缺少针对未标注词的触屏手势链路（长按触点取词/选区取词）。

### 解决方案

- `app/composables/useReader.ts`
  - 新增 iframe 文档级长按查词监听（`touchstart/touchmove/touchend/selectionchange`）。
  - 长按后优先解析选区中的单词；若无选区，则按触点附近文本节点解析词元。
  - 长按仅弹出“查词”操作按钮，点击按钮后才真正发起释义请求。
  - 已有标注词优先直接复用现有 `markerMeaningMap`，未标注词走单词级 API 请求。
  - 新增单词级释义缓存与请求去重，复用现有请求队列/限流退避与错误 toast。
  - 统一复用现有 tooltip 渲染能力与顶层 dismiss 链路，在内容销毁时移除长按监听，避免泄漏。

### 验证

- 移动端长按已标注词与未标注词，先出现“查词”按钮；点击后出现释义 tooltip。
- 同词重复长按不会频繁重复请求，体验稳定。
- 编译验证：`npm run build` 通过。

## 2026-02-18 PC 端按住 Shift 无法查看释义

### 现象

- 在 `/reader` 的桌面端阅读场景中，用户只能通过点击单词查看释义。
- 按住 `Shift` 键不会触发释义气泡，无法满足“键盘辅助查看释义”的交互需求。

### 根因

1. `app/composables/useReader.ts` 中的释义展示仅绑定了 `click` 事件。
2. 没有记录“当前悬停单词”状态，也没有 `Shift keydown/keyup` 监听链路。

### 解决方案

- `app/composables/useReader.ts`
  - 新增文档级 `Shift` 键监听（`keydown/keyup`）：
    - `keydown(Shift)` 时，若当前悬停在可释义单词上，直接展示 tooltip。
    - `keyup(Shift)` 时，若 tooltip 由 Shift 触发，则自动收起。
  - 新增单词悬停状态记录（`mouseenter/mousemove/mouseleave`）：
    - 记录当前悬停 token 与鼠标坐标锚点。
    - 悬停期间若检测到 `event.shiftKey === true`，立即展示释义。
  - 保留原有点击触发行为，点击打开释义不受影响。
  - 在 iframe 内容销毁时移除 `Shift` 监听，避免事件泄漏。

### 验证

- 鼠标悬停在可释义单词上，按住 `Shift` 可直接显示释义 tooltip。
- 保持按住 `Shift` 在不同单词间移动，tooltip 跟随当前单词更新。
- 松开 `Shift` 后，Shift 触发的 tooltip 自动关闭；点击触发逻辑仍可正常使用。
- `npm run build` 在当前环境仍被 Node 动态库缺失阻塞（`libicui18n.74.dylib`）。

## 2026-02-17 词汇量变更后释义缓存未失效

### 现象

- 用户在 `/user` 修改并保存词汇量后，阅读器仍可能命中旧的段落释义缓存。
- 在跨标签页同时打开阅读器时，另一个标签页不会立即感知词汇量配置变更。

### 根因

1. 释义缓存写入了 Dexie `definitions`，但缺少“词汇量保存后统一失效”链路。
2. 页面之间没有用于缓存失效同步的本地广播键，跨标签页无法及时清理内存态与持久缓存。

### 解决方案

- 新增 `app/constants/storageKeys.ts`，统一管理：
  - `first-english-book-vocabulary-size`
  - `first-english-book-definition-cache-bust-at`
- 新增 `app/utils/readerDefinitionCache.ts`：
  - `clearDefinitionCacheSilently()`：静默清空 Dexie `definitions`
  - `broadcastDefinitionCacheBust()`：每次保存写入 bust 时间戳
- `app/pages/user.vue`：
  - 每次点击“保存设置”后，无条件执行缓存清理与 bust 广播。
- `app/composables/useReader.ts`：
  - 监听 `storage` 事件中的 bust key，收到后清理 `definitions`，并重置 `pendingDefinitionMap` 与 `paragraphDefinitionStatus`。

### 验证

- 同标签保存词汇量后，`reader-definition-cache.definitions` 被清空，`locations` 保持不变。
- 跨标签页保存词汇量后，阅读页可收到失效信号并执行缓存清理（幂等）。
- `npm run build` 在当前环境仍被 Node 动态库缺失阻塞（`libicui18n.74.dylib`）。

## 2026-02-17 调整行高后 tooltip 偶发遮挡单词（三次优化）

### 现象

- 调整行高后，tooltip 在部分点击位置会压住目标单词，影响阅读与复查。

### 根因

- 二次优化时采用“点击坐标优先锚定”，纵向也直接使用点击点，导致锚点可能落在单词中线附近。
- 在顶部空间不足触发 `flip` 时，浮层与单词垂直间隔不足，出现遮挡。

### 解决方案

- `app/composables/useReader.ts`
  - 水平方向继续使用点击点（保证指向准确）。
  - 纵方向改为固定锚定“单词文本框 top + 文本高度”，不再使用点击 y。
  - 调整 tooltip 偏移范围到 `4~8px`，保证与目标词有最小安全距离。

### 验证

- 行高调至 `2.0x`/`2.2x` 后连续点击不同单词，tooltip 不应遮挡目标词。
- 执行 `npm run build`，编译通过。

## 2026-02-17 调整行高后释义 tooltip 离单词过远（二次优化）

### 现象

- 在阅读器中调大“行高”后，点击单词的释义 tooltip 与目标词垂直距离偏大。

### 根因

- 旧定位主要锚定在单词 `span` 行框；行高变大时行框留白增加，导致 tooltip 起始锚点上移。

### 解决方案

- `app/composables/useReader.ts`
  - tooltip 定位改为“点击坐标优先锚定”，以实际点击位置作为参考点。
  - 保留文本矩形兜底（`Range.getClientRects`），用于非点击触发场景。
  - 将 `offset` 改为与 `readerLineHeight` 联动的动态值（`2~6px`）。

### 验证

- 将行高调至 `2.0x` 或更高后点击单词，tooltip 与目标词保持贴近。
- 执行 `npm run build`，编译通过。

## 2026-02-13 Normal People 首屏封面无法下滑进入正文

### 现象

- 访问 `http://localhost:3000/reader?book=book/Normal+People+(Sally+Rooney)+(Z-Library).epub`。
- 首屏停留在封面，向下滚动（滚轮/触摸）没有反应，无法进入下一章节。

### 根因

1. 该书首个 spine 项是封面页，初始渲染时容器不可滚（`scrollHeight === clientHeight`）。
2. 连续滚动模式下此前完全禁用了 `wheel fallback`（`prev/next`），用于规避跨章节跳变。
3. 在“不可滚首屏”场景下，没有滚动事件驱动 continuous manager 继续推进，导致卡在封面。

### 解决方案

- `app/composables/useReader.ts`
  - 调整 `handleWheelFallback` 策略：不再按模式直接禁用；改为“仅当容器不可滚时”允许 wheel 触发 `rendition.next()/prev()`。
  - 保留原有纵向滚轮判定与冷却时间限制，避免可滚状态下引入额外翻章干扰。

### 验证

- Playwright 复测上述 URL：
  - 修复前：`.epub-container` 为 `scrollHeight=798`、`clientHeight=798`，滚轮后 `scrollTop` 仍为 `0`。
  - 修复后：下滑后容器变为 `scrollHeight=1488`，`scrollTop=690`，可继续滚动进入后续章节。
- 执行 `npm run build`，编译通过。

## 2026-02-13 连续滚动章节边界卡住导致进度恢复偏前

### 现象

- 在 `Normal People` 连续向下阅读后，滚动会卡在章节边界附近。
- 退出再进入时，阅读进度常常恢复到较前位置，看起来像“记不住进度”。

### 根因

1. 上一版仅在“容器完全不可滚”时触发 `wheel fallback`。
2. 到章节底部时常见状态是“容器可滚但已到边界”（`scrollHeight > clientHeight` 且 `scrollTop` 已接近最大值）。
3. 该状态不会触发兜底翻章，后续章节无法继续 append，进度锚点只能停留在较早 CFI。

### 解决方案

- `app/composables/useReader.ts`
  - `handleWheelFallback` 改为“边界感知”：
    - 容器不可滚时触发兜底翻章；
    - 或者在向下滚且命中底边界时触发 `next`；
    - 或者在向上滚且命中顶边界时触发 `prev`。
  - 保留冷却时间与纵向滚轮判定，避免普通滚动过程频繁翻章。

### 验证

- Playwright 连续下滑 20 次，`scrollHeight` 从 `1488` 持续增长到 `16316`，说明章节可持续追加。
- 滚动到深位置后退出重进：
  - 退出前保存 `cfi=epubcfi(/6/28!/4/2/2[Chapter9]/16[pagebreak-rw_95]/14[p818]/1:0)`；
  - 重进后从中后段恢复（`scrollTop=5349`），不再回到开头。
- 执行 `npm run build`，编译通过。

## 2026-02-12 Hold Me Tight 快速退出场景仍有进度偏移（二次修复）

### 现象

- 在 `Hold Me Tight` 中快速连续滚动后立即退出，重进时偶发回到更早位置。
- 尤其在多 iframe 可见或章节标题区，恢复位置容易与退出前首屏不一致。

### 根因

1. 进度抓取曾在多个内容文档内并行触发，存在“后写覆盖前写”的竞态。
2. 重进加载阶段的自动 `commitProgress` 可能把已保存的精确 CFI 覆盖为粗粒度位置。
3. 锚点仅取元素起点时，对标题/短块容忍度低，视觉恢复偏差较明显。

### 解决方案

- `app/composables/useReader.ts`
  - 改为单一“全局可见锚点”抓取链路：跨 iframe 统一计算当前可见阅读锚点，避免多文档互相覆盖。
  - 恢复期禁写：当存在保存进度并执行恢复时，先只更新 UI，不立即写回存储，防止加载阶段反向覆盖。
  - 锚点精度提升：优先使用 `cfiFromRange(视口中上部光标点)`，失败再回退 `cfiFromElement`。
  - 仍保留 `relocated` 提交链路作为章节跳转兜底。

### 验证

- 快速滚动后立即退出再重进，`hmtscfal` 缓存 CFI 不再被加载阶段覆盖。
- 在正文段落场景下，退出前后首屏文本保持一致。
- 执行 `npm run build`，编译通过。

## 2026-02-12 指定书籍（Hold Me Tight）退出重进进度回退

### 现象

- 访问 `/reader?book=book/Hold+Me+Tight+Seven+Conversations+For+A+Lifetime+Of+Love+(Dr.+Sue+Johnson)+(Z-Library).epub`。
- 滚动到中后段后退出并重进，阅读位置会回退到更早位置，和退出前不一致。

### 根因

1. 进度锚点提交放在“可见段落 ID 去重”之后，当可见段落集合未变化时不会刷新锚点 CFI。
2. 连续滚动中 `rendition.currentLocation()` 偶发返回偏前章节位置，作为兜底提交时会覆盖正确进度。

### 解决方案

- `app/composables/useReader.ts`
  - 将“可见锚点 CFI 提交”前移到去重判断之前，保证每次稳态同步都可刷新进度锚点。
  - 移除基于 `rendition.currentLocation()` 的滚动兜底提交，避免偶发回退覆盖。
  - 保留 `relocated` 与可见锚点提交双链路：章节跳转与停留阅读都可持续更新进度。

### 验证

- 在上述 URL 滚动后退出重进，重进首屏文本与退出前一致。
- 本地实测缓存 key `hmtscfal` 的 CFI 在退出重进前后保持一致，不再被回退覆盖。
- 执行 `npm run build`，编译通过。

## 2026-02-12 同章节内滚动后重进恢复位置偏差

### 现象

- 在同一章节内向下滚动一段后退出阅读并重新进入，恢复位置明显偏前，不是离开时看到的段落。

### 根因

1. 进度提交主要依赖 `relocated` 事件。
2. 用户在章节内滚动时，不一定触发新的 `relocated`，导致保存的 CFI 停留在章节锚点附近。
3. 重进时按旧 CFI 恢复，表现为“进度恢复不一致”。

### 解决方案

- `app/composables/useReader.ts`
  - 新增 `commitProgressByCfi`，支持直接按 CFI 提交/持久化进度。
  - 在 `attachContentHooks` 的可见段落同步链路中，取首个可见段落，调用 `contents.section.cfiFromElement(...)` 生成锚点 CFI 并持久化。
  - 保留原 `relocated` 提交路径，作为章节跳转场景保障。

### 验证

- 复测步骤：进入 `/reader?uploadId=1`，在同章节内滚动后退出再进入。
- 结果：离开前可见首段与重进后可见首段一致；缓存 CFI 从 `.../8/1:0` 更新为 `.../28/1:0` 并被正确恢复。
- 执行 `npm run build`，编译通过。

## 2026-02-12 上传书籍阅读进度无法恢复

### 现象

- 上传到书架的 EPUB 打开阅读后，即使已滚动到中间位置，退出再进入仍回到开头。

### 根因

1. 阅读器进度缓存 key 默认由 `bookPath` 推导。
2. 上传书籍在 `/reader` 页通过 `uploadId` 从 IndexedDB 取出后，会重新生成新的 `blob:` URL。
3. 同一本上传书籍每次进入时 `bookPath` 都变化，导致写入和读取使用了不同 key，进度无法命中。

### 解决方案

- `app/components/ReaderShell.vue`
  - 新增 `storageBookKey`，上传书籍场景使用稳定键：`upload:<id>`。
  - 调用 `useReader` 时把稳定键传入，替代临时 `blob:` 地址参与进度持久化。
- `app/composables/useReader.ts`
  - `UseReaderOptions` 新增 `storageBookKey` 可选参数。
  - 进度 key 计算改为“优先外部稳定键，回退原有 `bookPath` 推导逻辑”。

### 验证

- 上传 EPUB 后进入阅读，滚动到任意中间位置，退出再进入同一本上传书籍，能恢复到上次位置。
- 执行 `npm run build`，编译通过。

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

## 2026-02-10 点击单词出现背景闪烁

### 现象

- 点击段落中的可释义单词时，单词区域会出现一次背景闪烁，观感突兀。

### 根因

- 单词标记元素 `reader-meaning-token` 未显式禁用 WebKit 点击高亮，触发默认 tap highlight 视觉反馈。

### 解决方案

- 在 `app/composables/useReader.ts` 的单词标记创建逻辑中，补充样式：
  - `-webkit-tap-highlight-color: transparent`
  - `background-color: transparent`
  - `transition: none`

### 验证

- 在阅读器中点击任意可释义单词，不再出现背景闪烁。
- 执行 `npm run build`，编译通过。
