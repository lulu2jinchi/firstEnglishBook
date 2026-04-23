# First English Book 产品需求文档（整理版）

更新时间：2026-02-25  
适用范围：`firstEnglishBook` 当前主分支实现

## 1. 产品概述

First English Book（看吧阅读器）是一个面向英语学习者的 EPUB 阅读产品，目标是让用户在连续阅读中完成词汇习得，而不是在阅读流程中频繁跳出查词。

核心价值：
- 支持持续阅读（内置书 + 本地上传书）。
- 按用户词汇量阈值筛选“可能不会的词”并给出语境释义。
- 在连续滚动场景下保证进度可恢复与请求成本可控。

技术形态：
- 前端：Nuxt 4 SPA（`ssr: false`）+ Vue 3 + TypeScript。
- 后端：Nuxt Server API（词汇量配置 + 模型调用代理）。

## 2. 用户与使用场景

目标用户：
- 希望通过英文原著阅读提升词汇与语感的学习者。

核心场景：
- 进入书架选择书籍后开始阅读。
- 上传本地 EPUB，退出后继续上次进度。
- 根据词汇量仅提示可能不熟词，不做整段机翻。
- 在网络抖动或模型限流时保持可读和可恢复。

## 3. 页面与路由

- `/`：默认入口，重定向到 `/home`。
- `/home`：书架首页。
- `/reader`：阅读器主页面。
- `/user`：个人中心（词汇量设置）。
- `/official`：官网展示页（品牌与入口）。
- `/epub-native-test`：纯 epub.js 基线验证页（无业务释义链路）。
- `/beian-love-record.html`：备案静态页面。

## 4. 功能需求

### 4.1 默认入口（`/`）

- 服务端路由重定向到 `/home`（302）。
- 客户端兜底页保持无感跳转，不停留在中间态。

### 4.2 书架首页（`/home`）

- 展示 5 本内置 EPUB，支持封面提取与标题展示。
- 首页顶部展示“你的英语书架”概览，包含书架数量、上传数量与搜索/导入提示。
- 支持书名搜索过滤。
- 提供显式 `导入` 入口，支持空书架与空搜索结果态提示。
- 支持上传本地 EPUB（扩展名/MIME 校验）。
- 上传完成后写入 IndexedDB（`home-uploaded-books.uploads`）并入书架。
- 支持编辑模式批量移出：
  - 点击“编辑”或长按书籍进入编辑模式。
  - 可全选/取消全选并批量移出。
  - 上传书籍移出后从 IndexedDB 删除。
  - 内置书籍移出后仅本地隐藏并持久化。
- 书籍卡片区分“内置书库”与“本地导入”，默认点击继续阅读；编辑态点击用于选择。
- 底部 TabBar：书架、导入、设置。

### 4.3 个人中心（`/user`）

- 词汇量范围：`1000~20000`。
- 交互方式：
  - 滑杆步长 `500`。
  - 数字输入步长 `100`。
  - 提供常用词汇量预设快捷按钮。
- 读取策略：本地优先 -> 服务端 -> 默认值 `4000`。
- 保存策略：本地与服务端并行保存，支持部分成功文案反馈。
- 页面展示当前阈值、状态徽标、阈值影响说明，帮助用户理解“释义密度”变化。
- 每次点击“保存设置”后：
  - 清空 Dexie `reader-definition-cache.definitions`。
  - 写入 `first-english-book-definition-cache-bust-at` 触发跨标签缓存失效广播。

### 4.4 阅读器（`/reader`）

#### 4.4.1 书籍加载
- 支持两类入口：
  - 内置书：`/reader?book=<path>`。
  - 上传书：`/reader?uploadId=<id>`（从 Dexie 读取 Blob）。
- 上传书使用稳定进度键：`upload:<id>`，避免 `blob:` URL 变化导致进度丢失。
- 默认兜底书籍：`Normal People`。

#### 4.4.2 渲染模式与翻页
- 支持模式：
  - `paginated`（左右翻页）
  - `scrolled-continuous`（连续滚动）
  - `scrolled-doc`（稳定滚动）
- 默认策略：
  - `experimentalContinuous` 未显式关闭时，优先 `scrolled-continuous`。
  - 不支持连续滚动时回退到 `scrolled-doc`。
- 连续滚动兜底翻章：
  - 容器不可滚时滚轮触发 `next/prev`。
  - 到章节边界继续滚动时触发 `next/prev`。
  - 内置冷却，避免频繁跳章。

#### 4.4.3 目录与阅读设置
- 目录面板：展示 TOC（层级缩进），支持点击跳转。
- 顶部悬浮工具层展示阅读状态、当前位置与模式切换入口。
- 主题面板：`浅灰`、`米色`、`浅绿`、`夜间`。
- 排版面板：
  - 字体：Georgia / Palatino / Avenir
  - 正文字号：`14~28`（默认 `20`）
  - 行高：`1.2~2.2`（默认 `1.4`）
  - 释义字号：`11~22`（默认 `18`）
- 设置面板支持显式关闭按钮与 `Escape` 关闭。
- 所有设置持久化到 localStorage。

#### 4.4.4 阅读进度持久化
- 使用 CFI 作为进度锚点。
- 位置写入双存储：
  - localStorage：`first-english-book-location:<bookKey>`
  - Dexie：`reader-definition-cache.locations`
- 恢复优先级：localStorage -> Dexie -> 默认位置。
- 稳定策略：
  - 进度恢复阶段禁止写入，防止旧值覆盖。
  - 连续滚动采用“稳定检测后提交”策略。

#### 4.4.5 段落识别与释义触发
- 在 iframe 段落写入 `data-para-id`。
- 可见段落通过 `postMessage` 回传父页面。
- 连续滚动阈值：
  - 可见比例：`>= 0.55`
  - 可见段落同步防抖：`1800ms`
  - 停滚后最小空闲：`1500ms`
- 支持双击段落触发单段释义。

#### 4.4.6 预处理与批量请求
- 前端预处理：
  - `wink-lemmatizer` 词形归一。
  - 基于 `public/coca-20000.json` 与词汇量阈值筛词。
  - 仅标注 rank > 阈值或未收录词。
  - 同词只标注首次出现。
  - 专有名词过滤模式默认 `person_only`。
  - 生成 `annotatedText` 和 `targetWords`。
- 批处理策略：
  - 段落长度 `<=120`：最多 `3` 段合并请求。
  - 长段落：单段请求。
  - 批次间隔：`1000ms`。
  - 同批失败重试：最多 `3` 次（含首次）。
  - 限流触发指数退避：上限 `120s`。

#### 4.4.7 释义渲染与交互
- 标注词渲染为可点击 token。
- 点击 token 展示 tooltip（Floating UI 定位）。
- 桌面端：悬停 + 按住 `Shift` 显示释义，松开自动关闭。
- 移动端：长按触发“查词”按钮，确认后发起单词级释义请求。
- tooltip 交互：
  - 跟随主题亮暗切换。
  - 点击空白、滚动、页面隐藏/离开时自动关闭。

#### 4.4.8 缓存与错误反馈
- 释义缓存键：`bookKey + paragraphId + 词汇配置签名`。
- 命中缓存直接渲染，减少模型请求。
- API 错误通过顶部 toast 提示（限流/鉴权/参数/服务异常）。

### 4.5 官网页（`/official`）

- 首屏展示品牌、核心价值、阅读器示意图，并在首屏保留下一屏能力区的可见提示。
- 对外分享时提供标题、描述、canonical 与 Open Graph/Twitter 基础元信息。
- 提供入口：
  - `开始阅读` -> `/home`
  - `快速体验` -> `/reader`
- 支持移动端与桌面端适配。

### 4.6 纯基线验证页（`/epub-native-test`）

- 使用纯 epub.js 连续滚动，不挂业务释义逻辑。
- 用于区分“业务链路问题”与“底层渲染问题”。

## 5. 后端 API 需求

### 5.1 `GET /api/readerLevel`
- 功能：读取 `prompt.md` 的词汇量配置。
- 返回：`levelText`、`vocabularySize`。

### 5.2 `POST /api/readerLevel`
- 入参：`vocabularySize`（`1000~20000`）。
- 行为：更新 `prompt.md` 中英语水平描述。
- 约束：只读部署环境支持运行时覆盖兜底。

### 5.3 `POST /api/querySentenceDefination`
- 入参：`text`、`annotatedText`、`targetWords`、`vocabularySize`（可选）。
- 服务端要求：
  - 按 prompt 模板构造请求并调用可配置模型平台（OpenAI 兼容协议）。
  - 响应必须可解析为 JSON。
  - 返回 `sentence` 对齐 `annotatedText`。
  - `meaning` 键按 `targetWords` 对齐（过滤多余键、修复可匹配键、缺失项补兜底）。
- 当 `targetWords` 为空时直接返回空释义，避免无效模型调用。

## 6. 数据与存储

### 6.1 localStorage
- `first-english-book-vocabulary-size`
- `first-english-book-definition-cache-bust-at`
- `first-english-book-reader-theme`
- `first-english-book-reader-font`
- `first-english-book-reader-font-size`
- `first-english-book-reader-line-height`
- `first-english-book-meaning-font-size`
- `first-english-book-location:<bookKey>`

### 6.2 IndexedDB（Dexie）
- `home-uploaded-books`
  - `uploads`：上传书籍 Blob 与元信息。
- `reader-definition-cache`
  - `definitions`：段落释义缓存。
  - `locations`：阅读位置缓存。

## 7. 运行时配置

默认模型通道：`siliconflow`（可切换）。

通用变量：
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `LLM_HEADERS_JSON`

Provider 预设：
- SiliconFlow：`SILICONFLOW_API_KEY`、`SILICONFLOW_BASE_URL`、`SILICONFLOW_MODEL`
- OpenRouter：`OPENROUTER_API_KEY`、`OPENROUTER_BASE_URL`、`OPENROUTER_MODEL`、`OPENROUTER_SITE_URL`、`OPENROUTER_APP_NAME`

## 8. 测试与评测

### 8.1 API 用例系统
- 用例目录：`reader-test/test-cases/*`
- 运行报告：`reader-test/test-cases-runs/<run-id>/report.md`
- 执行命令：`npm run test:cases:run -- --base-url http://localhost:3000`

### 8.2 用例生成
- 命令：`npm run test:case:generate -- --goal "<目标描述>"`
- 生成产物：`test.md + test.ts`（失败时回退模板）。

### 8.3 模型评测
- 脚本：`scripts/evaluate-models.mjs`
- 产物：`model_eval_results.json`、`model_eval_results.xlsx`

## 9. 非功能要求

- 所有改动提交前必须通过 `npm run build`。
- 连续滚动跨章节不应明显跳变或闪烁。
- 进度恢复应尽量回到离开位置附近。
- 模型请求需具备限流与退避机制，避免高频触发配额限制。
- 缓存优先策略应显著降低重复调用。

## 10. 部署要求

- 提供阿里云一键部署脚本：`scripts/deploy-aliyun.sh`。
- 支持流程：本地构建 -> 打包 `.output` -> 上传服务器 -> 重启服务。
- 当启用 `--nginx-80-proxy` 时：
  - 应用域名统一反代到应用端口。
  - 支持备案页独立域名直出静态页面。

## 11. 里程碑（摘要）

- 2026-02-10：连续滚动稳定性补丁落地，新增纯基线验证页。
- 2026-02-12：上传书籍稳定进度键与恢复链路修复。
- 2026-02-13：章节边界兜底翻章能力上线。
- 2026-02-17：新增官网页 `/official`，完善品牌展示与入口。
- 2026-02-18：新增桌面端 `Shift` 辅助释义交互。
- 2026-02-20：模型配置升级为多平台通用配置，新增阿里云部署脚本。
