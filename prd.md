# First English Book 产品需求文档（全量）

## 1. 产品定位

First English Book 是一个面向英语阅读学习者的 EPUB 阅读器，核心目标是：

- 提供可持续阅读的电子书体验（支持内置书籍与本地上传书籍）。
- 在阅读上下文中提供“按用户词汇量阈值筛选后的单词释义”。
- 保证连续滚动场景下的稳定性、进度可恢复性和可控的模型调用成本。

当前为 Nuxt 单页应用（`ssr: false`），前端负责阅读与预处理，后端负责模型调用与词汇量配置同步。

## 2. 用户与核心场景

- 用户画像：希望通过英文原著阅读提升词汇和语感的学习者。
- 核心场景：
  - 在书架选择书籍并进入阅读。
  - 上传自己的 EPUB 并继续上次阅读位置。
  - 根据自身词汇量只翻译“可能不会的词”。
  - 通过主题、字体、字号、行高、释义字号调整阅读体验。
  - 在网络波动或模型限流情况下仍保持可读与可恢复。

## 3. 页面与路由结构

- `/`：备案展示页（纯静态 HTML，展示颜璐与廖彬彬的生活记录）。
- `/official`：产品官网（看吧阅读器品牌页，提供功能介绍与阅读入口）。
- `/home`：书架首页。
- `/user`：个人中心（词汇量设置）。
- `/reader`：主阅读器页面。
- `/epub-native-test`：纯 `epub.js` 基线验证页（用于问题隔离与回归）。

## 4. 功能需求（按模块）

### 4.0 备案展示页（`/`）

- 根路径由服务端重定向到静态资源 `/beian-love-record.html`，不依赖前端路由渲染。
- 页面定位：个人生活记录展示，仅静态内容，不提供评论、发布、交易等交互能力。
- 展示主体：颜璐与廖彬彬的幸福生活记录与用途说明（备案场景）。
- 页面要求：
  - 支持移动端与桌面端自适应。
  - 仅使用静态 HTML + CSS，避免动态接口依赖。
  - 内容可在浏览器直接访问 `http://<host>:3000/` 展示。

### 4.0.1 产品官网（`/official`）

- 展示品牌信息：
  - 产品名：看吧阅读器
  - Slogan：一看一个不吱声
- 展示核心能力概览（EPUB、按词汇量释义、进度恢复）。
- 展示阅读器释义示意图（官网静态图），用于说明“点词查看中文释义”的交互形态。
- 官网不再展示“阅读流程”区块，聚焦品牌与核心释义能力说明。
- 首页 `hero-metrics` 模块固定展示三项核心价值：
  - `个性化难词预判`：按词汇量提前筛出可能不会的词，不做全量翻译。
  - `语境释义而非词典直译`：给出句中含义，帮助理解上下文。
  - `无痛习得路径`：通过持续阅读中的语境暴露自然提升英语。
- 官网功能卡移除“无缝进入阅读”“跨章节连续读”两项旧文案。
- 提供双入口 CTA：
  - `开始阅读`（进入 `/home`）
  - `快速体验`（进入 `/reader`）
- 官网需兼容移动端与桌面端，首屏信息在小屏可完整展示。

### 4.1 书架首页（`/home`）

- 内置 5 本 EPUB 书籍展示，支持封面提取与标题展示。
- 支持搜索过滤（按书名模糊匹配）。
- 支持上传本地 EPUB：
  - 校验扩展名和 MIME。
  - 显示上传进度卡片（上传中/失败态）。
  - 上传成功后写入 IndexedDB（Dexie）并加入书架。
- 上传书籍和内置书籍统一可点击进入阅读器。
- 支持书籍删除：
  - 支持通过“编辑”按钮进入编辑模式，也支持长按书籍快速进入编辑模式并选中当前书籍。
  - 编辑模式下支持多选书籍，并可一键“移出书架”。
  - 上传书籍移出后应从 IndexedDB 移除，并立即从书架消失。
  - 内置书籍支持“隐藏移出”，本地持久化后刷新页面仍保持隐藏。
- 页面底部固定 TabBar：
  - 首页按钮。
  - 上传按钮（触发文件选择）。
  - 个人中心按钮。

### 4.2 个人中心（`/user`）

- 词汇量设置范围：`1000~20000`。
- 交互方式：
  - 滑杆（步长 500）。
  - 数字输入（步长 100）。
- 读取策略：
  - 优先本地存储。
  - 其次读取服务端 `GET /api/readerLevel`。
  - 都不可用时使用默认值 `4000`。
- 保存策略：
  - 同时写本地和服务端 `POST /api/readerLevel`。
  - 支持部分成功提示（仅本地成功 / 仅服务端成功）。

### 4.3 阅读器（`/reader`）

#### 4.3.1 书籍加载

- 支持两类入口：
  - 内置书：`/reader?book=<path>`。
  - 上传书：`/reader?uploadId=<id>`（从 IndexedDB 读取 Blob）。
- 上传书使用稳定进度键 `upload:<id>`，避免 `blob:` URL 每次变化导致进度丢失。
- 默认书籍兜底为 `Normal People`。

#### 4.3.2 阅读模式与翻页

- 支持三种渲染模式：
  - `paginated`（左右翻页）。
  - `scrolled-continuous`（连续滚动）。
  - `scrolled-doc`（稳定滚动）。
- 默认策略：
  - `experimentalContinuous` 未显式关闭时默认连续滚动。
- 连续滚动兜底翻章：
  - 容器不可滚时，滚轮触发 `next/prev`。
  - 容器到章节上下边界继续滚动时，触发 `next/prev`。
  - 带冷却时间，避免频繁跳章。

#### 4.3.3 目录与阅读设置面板

- 目录面板：
  - 展示 EPUB TOC（含层级缩进）。
  - 点击章节跳转到对应 href。
- 配色面板（4 套）：
  - `浅灰`、`米色`、`浅绿`、`夜间`。
- 排版面板：
  - 字体（Georgia/Palatino/Avenir）。
  - 正文字号（14~28）。
  - 行高（1.2~2.2）。
  - 释义字号（11~22，默认 14）。
- 设置持久化到本地存储，刷新后生效。

#### 4.3.4 阅读进度持久化与恢复

- 使用 CFI 作为进度锚点，支持：
  - 章节跳转时更新。
  - 同章节滚动时按可见锚点更新。
- 恢复策略：
  - 优先本地存储（`first-english-book-location:<bookKey>`）。
  - 其次 Dexie `locations` 表。
  - 支持兼容历史 key 回迁。
- 关键稳定策略：
  - 全局单链路锚点抓取，避免多 iframe 并发覆盖。
  - 恢复阶段禁写，防止重进时旧位置覆盖新位置。
  - 连续滚动下使用“稳定检测”后再提交进度。

#### 4.3.5 可见段落识别与释义触发

- 在 iframe 内容中对段落打 `data-para-id`。
- 监听可见段落并通过 `postMessage` 回传父页面。
- 连续滚动下启用稳态约束：
  - 可见比例阈值：`>= 0.55`。
  - 可见段落同步防抖：`1800ms`。
  - 停滚后应用释义最短空闲：`1500ms`。
- 支持双击段落触发单段释义。

#### 4.3.6 单词预处理与批量释义

- 前端预处理规则：
  - 使用 `wink-lemmatizer` 做词形归一。
  - 基于 `public/coca-20000.json` 词频和词汇量阈值筛词。
  - 仅标注 rank 大于阈值或未收录词。
  - 同词只标第一次。
  - 人名过滤模式默认 `person_only`。
  - 生成 `annotatedText`（如 `[word]`）和 `targetWords`（小写去重）。
- 批处理策略：
  - 段落长度 `<=120` 字符时最多 3 段合并请求。
  - 长段落单段请求。
  - 请求间隔 `1000ms`。
  - 同批失败立即重试，最多 3 次（含首次）。
  - 触发限流时指数退避（上限 120s）。

#### 4.3.7 释义渲染与交互

- 将带中括号的标注词映射回段落文本并包裹可点击 token。
- 点击 token 弹出释义 tooltip（Floating UI 定位）。
- 桌面端支持“悬停 token + 按住 `Shift`”触发释义 tooltip，松开 `Shift` 自动收起。
- 移动端支持“长按查词”：
  - 长按已标注或未标注英文单词时，先弹出“查词”操作按钮。
  - 用户点击“查词”按钮后才触发单词级释义请求。
  - 优先读取当前选区单词；无选区时按触点附近词元解析。
  - 查词结果复用 tooltip 展示，并复用请求队列与限流退避策略。
- tooltip 定位采用“点击坐标（横向）+ 文本框（纵向）”混合锚定，并随行高动态调整偏移，避免远离或遮挡目标单词。
- tooltip 配色跟随主题亮暗自动切换。
- 点击空白处、滚动、页面隐藏/离开时自动关闭 tooltip。
- 去除点击闪烁（关闭 tap highlight 与过渡）。

#### 4.3.8 缓存与错误反馈

- Dexie 缓存释义结果，键维度：
  - `bookKey + paragraphId + 词汇配置签名`。
- 命中缓存直接渲染，减少重复模型请求。
- 用户每次在个人中心保存词汇量后，都会清空 `reader-definition-cache.definitions` 并广播跨标签失效信号，确保后续按最新词汇量重新生成释义。
- API 错误通过顶部 toast 呈现（含限流/鉴权/参数等提示）。

### 4.4 纯原生基线页（`/epub-native-test`）

- 直接以 `epub.js` 连续滚动渲染指定书籍，不挂业务释义链路。
- 用于对比验证“业务逻辑影响”与“底层渲染问题”。

## 5. 后端 API 需求

### 5.1 `GET /api/readerLevel`

- 读取 `prompt.md` 中的词汇量描述并返回：
  - `levelText`
  - `vocabularySize`

### 5.2 `POST /api/readerLevel`

- 入参：`vocabularySize`（`1000~20000`）。
- 更新 `prompt.md` 中词汇量文案。
- 在只读部署环境下支持运行时覆盖兜底。

### 5.3 `POST /api/querySentenceDefination`

- 入参支持：
  - `text`
  - `annotatedText`
  - `targetWords`
  - `vocabularySize`（可选覆盖）
- 服务端行为：
  - 读取并套用 prompt 模板。
  - 调用可配置模型平台（OpenAI 兼容接口）。
  - 强约束返回 JSON 可解析。
  - 校验 `sentence === annotatedText`（最终回传以 annotatedText 为准）。
  - 对 `meaning` 做键对齐：以 `targetWords` 为准过滤多余键、归并可匹配键，并对缺失键补兜底释义，避免因键偏差直接失败。
- 无目标词时直接返回空释义对象，避免无效模型调用。

## 6. 数据与存储设计

### 6.1 本地存储（localStorage）

- `first-english-book-vocabulary-size`
- `first-english-book-definition-cache-bust-at`
- `first-english-book-reader-theme`
- `first-english-book-reader-font`
- `first-english-book-reader-font-size`
- `first-english-book-reader-line-height`
- `first-english-book-meaning-font-size`
- `first-english-book-location:<bookKey>`

### 6.2 IndexedDB（Dexie）

- DB: `home-uploaded-books`
  - 表 `uploads`: 上传书籍 blob 与元信息。
- DB: `reader-definition-cache`
  - 表 `definitions`: 段落释义缓存。
  - 表 `locations`: 阅读位置缓存。

## 7. 模型与 Prompt 策略

- 默认模型通道：硅基流动（可切换）。
- 关键运行时配置：
  - 通用优先：`LLM_PROVIDER`、`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`、`LLM_HEADERS_JSON`
  - 硅基流动预设：`SILICONFLOW_API_KEY`、`SILICONFLOW_BASE_URL`、`SILICONFLOW_MODEL`
  - OpenRouter 预设：`OPENROUTER_API_KEY`、`OPENROUTER_BASE_URL`、`OPENROUTER_MODEL`、`OPENROUTER_SITE_URL`、`OPENROUTER_APP_NAME`
- Prompt 模板占位符：
  - `{{TEXT}}`
  - `{{ANNOTATED_TEXT}}`
  - `{{TARGET_WORDS}}`
- 词汇量配置会回写到 prompt 里的“我的英语水平”描述段落。

## 8. 测试与评测体系

### 8.1 API 用例系统（`reader-test/`）

- 测试用例目录：`reader-test/test-cases/*`。
- 执行报告目录：`reader-test/test-cases-runs/<run-id>/report.md`。
- 支持断言：
  - `status`
  - `json-path-exists`
  - `json-equals`
  - `json-type`
  - `json-array-min-length`
  - `json-has-keys`
  - `json-keys-exact`
  - `json-regex`
  - `response-time-max-ms`

### 8.2 AI 生成用例脚本

- `npm run test:case:generate -- --goal "<目标描述>"`
- 可由模型生成 `test.md + test.ts`，失败自动回退本地模板。

### 8.3 用例执行脚本

- `npm run test:cases:run -- --base-url http://localhost:3000`
- 串行执行用例并输出 Markdown 报告。

### 8.4 模型评测脚本

- `scripts/evaluate-models.mjs`：
  - 按阅读器真实预处理流程构造 `annotatedText/targetWords`。
  - 对多模型打分（JSON 合法性、键一致性、语义质量、速度）。
  - 产出 `model_eval_results.json` 与 `model_eval_results.xlsx`。

## 9. 非功能要求

- 构建要求：每次改动需通过 `npm run build`。
- 部署要求：提供阿里云一键部署脚本，支持“本地构建 -> 打包 `.output` -> 上传服务器 -> 远程重启服务（`server`）”；当重启失败时可通过启动命令兜底（适配 PM2 首发部署）。
- 稳定性要求：
  - 连续滚动跨章节不应明显跳变/闪烁。
  - 快速退出重进应尽量恢复到离开位置附近。
- 性能要求：
  - 释义请求限流与退避，避免模型端触发高频限额。
  - 本地缓存优先，减少重复调用。

## 10. 已上线关键里程碑（摘要）

- 2026-02-10：
  - 接入本地 fork `epub.js` 并完成连续滚动稳定性补丁。
  - 默认连续滚动策略落地，支持基线验证页。
  - 阅读器配色、排版、释义字号和交互细节优化。
- 2026-02-12：
  - 模型服务切换 OpenRouter。
  - 上传书籍稳定进度键与进度恢复链路修复。
  - 进度锚点精细化与快速退出场景鲁棒性增强。
- 2026-02-20：
  - 模型服务升级为“多平台通用配置”，默认回到硅基流动，可通过环境变量一键切换其他平台。
  - 新增阿里云部署脚本 `scripts/deploy-aliyun.sh`，支持构建产物上传与远程服务重启。
- 2026-02-13：
  - 首屏不可滚场景兜底翻章。
  - 连续滚动章节边界兜底翻章，提升连续阅读与恢复一致性。
- 2026-02-17：
  - 新增产品官网页（`/`），统一品牌表达“看吧阅读器”与 Slogan。
  - 官网加入功能介绍与阅读入口，作为默认访问落点。
  - 官网新增阅读器释义示意图（本地静态资源）用于展示点词释义效果。
  - 官网移除“阅读流程”区块，并下线两项非核心功能文案（无缝进入阅读、连续滚动）。
  - 官网亮点区调整为三项核心卖点：难词预判、语境释义、无痛习得路径。
- 2026-02-18：
  - 阅读器新增桌面端 `Shift` 辅助释义交互：悬停单词时按住 `Shift` 可显示释义，松开自动关闭。
