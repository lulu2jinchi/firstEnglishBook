# reader-test

这是阅读器项目的测试工程目录，包含两类内容：

- `test-cases/`：测试用例目录，每个用例包含 `test.md`（说明）和 `test.ts`（自动化脚本）。
- `test-cases-runs/`：测试执行结果目录，每次执行会按时间创建子目录并生成 `report.md`。

## 目录结构

```text
reader-test/
  test-cases/
    should-return-meaning-json/
      test.md
      test.ts
  test-cases-runs/
```

## 用例脚本约定（test.ts）

`test.ts` 默认导出一个对象，字段如下：

- `name`: 用例名称
- `endpoint`: 接口路径（如 `/api/querySentenceDefination`）
- `method`: `GET|POST|PUT|PATCH|DELETE`
- `headers`: 可选请求头对象
- `query`: 可选 query 参数对象
- `body`: 可选请求体
- `timeoutMs`: 请求超时（毫秒）
- `assertions`: 断言数组

支持断言类型：

- `status`
- `json-path-exists`
- `json-equals`
- `json-type`
- `json-array-min-length`
- `json-has-keys`
- `json-keys-exact`
- `json-regex`
- `response-time-max-ms`

## 命令

1. AI 生成测试用例（`test.md` + `test.ts`）

```bash
npm run test:case:generate -- --goal "验证接口返回可解析 JSON，且包含 sentence 与 meaning 字段"
```

可选参数：

- `--slug`：指定用例目录名
- `--endpoint`：指定目标接口，默认 `/api/querySentenceDefination`
- `--text`：指定测试文本
- `--model`：指定模型名
- `--base-url`：模型 API 地址（默认 OpenRouter OpenAI 兼容地址）
- `--api-key`：模型 API Key

说明：如果 AI 生成失败，会自动回退到本地模板，确保产物可用。

2. 执行所有测试并生成报告

```bash
npm run test:cases:run -- --base-url http://localhost:3000
```

可选参数：

- `--case <slug>`：只跑某一个用例
- `--dry-run`：只校验用例结构，不发请求
- `--run-id`：指定运行目录名

执行完成后会生成：

```text
reader-test/test-cases-runs/<run-id>/report.md
```

## 手工回归项（UI）

当前 `reader-test` 自动化主要覆盖接口层。针对阅读器滚动稳定性问题，新增以下手工回归基线：

- 目标页面：`/epub-native-test`
- 场景：移动端模式下，连续快速上滑并跨章节滚动
- 关注点：
  - 是否出现阅读位置跳变
  - 是否出现正文闪烁
- 补丁说明参考：`vendor/epubjs/LOCAL_PATCHES.md`

- 目标页面：`/reader?book=book/Hold+Me+Tight+Seven+Conversations+For+A+Lifetime+Of+Love+(Dr.+Sue+Johnson)+(Z-Library).epub`
- 场景：默认参数（不带 `experimentalContinuous`）直接进入阅读
- 关注点：
  - 默认应进入连续滚动（不是单章节稳定模式）
  - 上下滚动时应持续加载前后章节

- 目标页面：`/reader?book=book/Normal+People+(Sally+Rooney)+(Z-Library).epub`
- 场景：首屏封面页下滑进入正文
- 关注点：
  - 首屏若为封面且不可滚，首次下滑应可进入后续章节，不应卡死在封面
  - 进入正文后容器应具备可滚高度，可继续连续下滑

- 目标页面：`/reader?book=book/Normal+People+(Sally+Rooney)+(Z-Library).epub`
- 场景：章节边界连续滚动与进度恢复
- 关注点：
  - 连续下滑到章节底部后，再次下滑应能进入下一章节，不应卡在边界
  - 阅读到中后段后退出再进入，应恢复到接近离开前的位置，不应回到开头

- 目标页面：`/reader?book=book/Hold+Me+Tight+Seven+Conversations+For+A+Lifetime+Of+Love+(Dr.+Sue+Johnson)+(Z-Library).epub`
- 场景：实验性连续滚动下停滚后观察释义
- 关注点：
  - 停留一段时间后可见段落应出现可点击单词释义
  - 跨章节上滑停下后不应出现明显回弹跳变

- 目标页面：`/reader`
- 场景：检查阅读器设置入口按钮布局
- 关注点：
  - 目录、配色、排版 3 个按钮固定在右下角悬浮区
  - 按钮点击后可正常打开对应设置面板
  - 移动端与桌面端均不遮挡核心阅读内容

- 目标页面：`/reader`
- 场景：检查“字体与排版”弹窗内容
- 关注点：
  - 仅展示字体、字号、行高设置项
  - 不再展示“滚动引擎”设置项

- 目标页面：`/reader`
- 场景：检查释义字号设置生效
- 关注点：
  - 初始默认释义字号应为 `14px`
  - 在“字体与排版”中调节“释义字号”后，单词释义 tooltip 字体同步变化
  - 刷新页面后释义字号保持上次设置值

- 目标页面：`/reader`
- 场景：检查阅读配色选项
- 关注点：
  - 配色面板展示 `浅灰`、`米色`、`浅绿`、`夜间` 四个主题
  - 蓝色边框只在当前选中主题卡上出现，其他卡片不显示蓝边
  - 切换主题后阅读背景、边框与按钮强调色同步变化

- 目标页面：`/reader`
- 场景：检查夜间模式释义气泡可读性
- 关注点：
  - 切换到 `夜间` 主题后，点词释义气泡应为浅底深字
  - 切回浅色主题后，释义气泡恢复深底浅字

- 目标页面：`/reader`
- 场景：检查点词交互是否有背景闪烁
- 关注点：
  - 点击可释义单词时，不应出现单词背景闪烁
  - 释义 tooltip 仍可正常弹出

- 目标页面：`/reader`
- 场景：检查行高变大时释义 tooltip 贴合度
- 关注点：
  - 将“行高”调至 `2.0x` 及以上后点击单词，tooltip 不应明显远离目标词
  - tooltip 不应覆盖被点击单词文本（上方或下方翻转时都需保持可见）
  - 连续点击不同单词时，tooltip 应围绕点击位置稳定出现

- 目标页面：`/reader?uploadId=<已上传书籍ID>`
- 场景：检查上传书籍阅读进度恢复
- 关注点：
  - 进入上传书籍后滚动到中间位置，退出阅读页再进入同一本上传书籍
  - 阅读位置应恢复到上次进度，不应回到开头

- 目标页面：`/reader?uploadId=<已上传书籍ID>`
- 场景：检查同章节内滚动后的精确恢复
- 关注点：
  - 在同一章节内滚动到新段落（不跨章节），退出阅读页再进入同一本上传书籍
  - 重进后首屏可见段落应与退出前基本一致，不应回退到章节开头锚点

- 目标页面：`/reader?book=book/Hold+Me+Tight+Seven+Conversations+For+A+Lifetime+Of+Love+(Dr.+Sue+Johnson)+(Z-Library).epub`
- 场景：检查内置书籍进度回退问题
- 关注点：
  - 连续滚动到中后段后退出并重进同一路由
  - 重进后首屏文本应与退出前一致，不应跳回更早章节

- 目标页面：`/reader?book=book/Hold+Me+Tight+Seven+Conversations+For+A+Lifetime+Of+Love+(Dr.+Sue+Johnson)+(Z-Library).epub`
- 场景：检查“快速退出”进度一致性
- 关注点：
  - 连续快速滚动后立即退出阅读页（不等待停滚防抖）
  - 立刻重进同一路由后，首屏正文应与退出前保持一致

- 目标页面：`/`
- 场景：检查产品官网入口与响应式展示
- 关注点：
  - 首屏应显示“看吧阅读器”与 Slogan “一看一个不吱声”
  - `开始阅读` 按钮应跳转 `/home`，`快速体验` 按钮应跳转 `/reader`
  - 应展示“阅读器释义示意图”图片卡片，图片可正常加载且不变形
  - 页面中不应再出现“阅读流程”区块
  - 首页 `hero-metrics` 模块应展示三个亮点：`个性化难词预判`、`语境释义而非词典直译`、`无痛习得路径`
  - 功能卡中不应再出现“无缝进入阅读”“跨章节连续读”旧文案
  - 移动端宽度下模块应单列布局，内容无横向溢出
