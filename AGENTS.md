请始终使用中文回复。

每次修改代码或文档后，必须执行 `npm run build`，确保无编译错误。

# First English Book（看吧阅读器）协作说明

## 1. 项目定位
- 项目类型：AI 辅助英语阅读产品（Nuxt 单页应用 + 模型服务接口）。
- 目标用户：通过英文原著阅读提升词汇和语感的学习者。
- 核心价值：在不打断阅读流的前提下，按用户词汇量动态标注“可能不会”的词，并给出语境释义。
- 工程定位：强调“可上线、可迭代、可评测、可维护”，不是一次性 Demo。

## 2. 技术栈与工程能力标签
- 前端：Nuxt 4、Vue 3、TypeScript、TailwindCSS、epub.js（本地 fork）。
- 存储：Dexie + IndexedDB（书籍、阅读进度、释义缓存）。
- 后端：Nuxt Server API（模型代理、词汇量配置读写）。
- AI 能力：按可见段落筛词、批处理请求、失败重试、限流退避、结果缓存。
- 工程化：自动化测试脚本生成与执行、缺陷记录闭环、PRD 持续同步。

## 3. 当前目录结构（需随代码变更同步）
- `app/app.vue`：应用入口。
- `app/pages/index.vue`：根路由兜底页（跳转 `/home`）。
- `app/pages/official.vue`：官网页（品牌与功能入口）。
- `app/pages/home.vue`：书架首页。
- `app/pages/user.vue`：个人中心（词汇量、模型配置）。
- `app/pages/reader.vue`：阅读器路由页（挂载 `ReaderShell`）。
- `app/pages/epub-native-test.vue`：纯 epub.js 基线验证页。
- `app/components/ReaderShell.vue`：阅读器主 UI 与交互容器。
- `app/components/BottomTabBar.vue`：底部导航。
- `app/composables/useReader.ts`：阅读器核心逻辑（加载、进度、释义请求、批处理等）。
- `app/constants/storageKeys.ts`：本地存储 key 常量。
- `app/constants/readerPreferences.ts`：阅读器偏好配置常量。
- `app/utils/readerDefinitionCache.ts`：释义缓存工具与跨标签失效广播。
- `server/api/querySentenceDefination.post.ts`：释义接口（模型调用与返回格式约束）。
- `server/api/readerLevel.get.ts`：读取词汇量配置。
- `server/api/readerLevel.post.ts`：更新词汇量配置。
- `server/routes/index.get.ts`：根路径重定向到 `/home`。
- `server/utils/prompt.ts`：词汇量配置读写与解析。
- `server/assets/prompt.md`：部署时 prompt 模板。
- `scripts/test-system/generate-test-case.mjs`：生成测试用例（`test.md` + `test.ts`）。
- `scripts/test-system/run-test-cases.mjs`：执行测试并输出报告。
- `reader-test/README.md`：测试体系说明。
- `reader-test/test-cases/*`：单用例文档与脚本。
- `reader-test/test-cases-runs/<run-id>/report.md`：测试执行报告归档。
- `vendor/epubjs/`：本地 fork 的 epub.js（基于 `v0.3.93`）。
- `public/landing/example.png`：官网释义示意图。
- `public/beian-love-record.html`：备案静态展示页。

## 4. 关键能力说明
- 释义触发链路：可见段落去重 -> 缓存命中判断 -> 组批请求 -> 渲染回填。
- 批处理策略：短段落（`<=120` 字符）最多 `3` 段一批，长段落单独请求。
- 请求控制：批次间隔 `1000ms`，带退避限流；失败最多重试 `3` 次（含首次）。
- 缓存一致性：用户保存设置后清空 Dexie `definitions`，并通过 `first-english-book-definition-cache-bust-at` 做跨标签失效广播。

## 5. API 自测基线
```bash
curl -sS -X POST "http://localhost:3000/api/querySentenceDefination" \
  -H "Content-Type: application/json" \
  -d '{"text":"The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass."}'
```

## 6. 文档维护规范
- 翻译/模型接入策略发生变化时：同步更新 `chooseAPI.md`。
- 修复缺陷后：同步更新 `fixBug.md`（问题现象、根因、方案、回归结论）。
- 新功能或关键行为变更后：同步更新 `reader-test/` 用例与报告。
- 产品能力或交互变化后：同步更新 `prd.md`。

## 7. 协作原则
- 优先保证阅读主链路稳定，新增能力不得破坏现有阅读、释义、进度恢复能力。
- 涉及模型调用策略的变更，必须同时说明成本、准确性、稳定性三项影响。
- 提交前需完成构建校验，必要时补充或更新对应测试用例与回归说明。
