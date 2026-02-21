# reader-test

这是阅读器项目的测试工程目录，包含两类内容：

- `test-cases/`：测试用例目录，每个用例包含 `test.md`（说明）和 `test.ts`（自动化脚本）。
- `test-cases-runs/`：测试执行结果目录，每次执行会按时间创建子目录并生成 `report.md`。

## 目录结构

```text
reader-test/
  test-cases/
    should-align-meaning-keys-to-target-words/
      test.md
      test.ts
    should-return-meaning-json/
      test.md
      test.ts
    should-support-single-word-lookup/
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
- `--base-url`：模型 API 地址（默认按 `TEST_AI_PROVIDER/LLM_PROVIDER` 选择，当前默认硅基流动兼容地址）
- `--api-key`：模型 API Key

说明：如果 AI 生成失败，会自动回退到本地模板，确保产物可用。

模型平台切换（通用）：

- `TEST_AI_PROVIDER`：脚本专用平台标识（如 `siliconflow` / `openrouter`）
- `TEST_AI_BASE_URL`：脚本专用 Base URL（可直接写到 `/chat/completions`）
- `TEST_AI_API_KEY`：脚本专用 API Key
- 未提供 `TEST_AI_*` 时，会回退读取 `LLM_PROVIDER/LLM_BASE_URL/LLM_API_KEY`

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

- 目标页面：`/reader`（PC 桌面端）
- 场景：检查按住 `Shift` 的释义快捷交互
- 关注点：
  - 鼠标悬停在可释义单词上时，按住 `Shift` 应弹出对应释义 tooltip
  - 保持按住 `Shift` 在不同可释义单词间移动时，tooltip 应随当前单词更新
  - 松开 `Shift` 后，Shift 触发的 tooltip 应自动关闭
  - 点击触发释义能力仍保持可用，不受 Shift 交互影响

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

- 目标页面：`/home`
- 场景：检查书架“编辑模式批量移出”能力
- 关注点：
  - 点击顶部“编辑”按钮后应进入编辑模式，再次点击“完成”应退出编辑模式
  - 长按任意非“上传中”书籍应进入编辑模式，并自动选中该书籍
  - 编辑模式下可多选书籍，“全选/取消全选”按钮状态应正确切换
  - 点击“移出书架”后应先弹出确认提示；确认后批量移出已选书籍
  - 移出上传书籍后应立即从列表消失，刷新页面后不应恢复
  - 移出内置书籍后应立即隐藏，刷新页面后仍保持隐藏
  - 编辑模式下点击书籍不应误触发进入阅读页

- 目标页面：`/`
- 场景：检查备案静态展示页直出
- 关注点：
  - 浏览器直接访问根路径时，应展示“颜璐 和 廖彬彬”的生活记录页，不应先出现 SPA 壳页面
  - 页面应为纯展示内容，无登录、评论、发布、交易等交互入口
  - 页面包含“记录说明”并声明仅用于个人生活展示与备案说明
  - 移动端宽度下排版正常，无横向溢出

- 目标页面：`/official`
- 场景：检查产品官网入口与响应式展示
- 关注点：
  - 首屏应显示“看吧阅读器”与 Slogan “一看一个不吱声”
  - `开始阅读` 按钮应跳转 `/home`，`快速体验` 按钮应跳转 `/reader`
  - 应展示“阅读器释义示意图”图片卡片，图片可正常加载且不变形
  - 页面中不应再出现“阅读流程”区块
  - 首页 `hero-metrics` 模块应展示三个亮点：`个性化难词预判`、`语境释义而非词典直译`、`无痛习得路径`
  - 功能卡中不应再出现“无缝进入阅读”“跨章节连续读”旧文案
  - 移动端宽度下模块应单列布局，内容无横向溢出

- 目标页面：`/user` + `/reader`
- 场景：检查词汇量保存触发释义缓存清理（同标签）
- 关注点：
  - 在阅读器产生释义缓存后进入个人中心点击“保存设置”（即使词汇量数值不变）
  - `reader-definition-cache.definitions` 应被清空
  - 再次回到阅读器时，同段落应重新触发释义请求
  - 阅读进度缓存 `locations` 不应被清空

- 目标页面：`/reader`（标签 A） + `/user`（标签 B）
- 场景：检查跨标签词汇量保存后的缓存失效同步
- 关注点：
  - 标签 B 点击“保存设置”后，应写入 `first-english-book-definition-cache-bust-at`
  - 标签 A 应响应 `storage` 事件并执行释义缓存失效流程（重复触发不报错）
  - 标签 A 后续进入的新段落应按最新状态重建释义缓存

- 目标页面：`/reader`（移动端触屏）
- 场景：检查未自动标注词的“长按查词”能力
- 关注点：
  - 在正文中长按英文单词（包含未被自动中括号标注的词）应先弹出“查词”按钮
  - 点击“查词”按钮后再弹出释义 tooltip
  - 同一词重复长按应可快速复用结果，不出现明显重复等待
  - 长按后若接口失败，应出现顶部错误提示，不应导致阅读器卡死

## 工程脚本冒烟项

- 目标脚本：`scripts/deploy-aliyun.sh`
- 场景：检查阿里云部署脚本参数解析与流程连通性
- 关注点：
  - 执行 `npm run deploy:aliyun -- --help` 可输出帮助信息
  - 缺少 `--host` 或 `--path` 时应直接报错退出
  - 未传 `--key` 时应提示可输入私钥路径（或回车使用默认 `~/.ssh` 配置）
  - 传入不存在的 `--key` 路径时应报错退出
  - 指定 `--port` 时上传阶段不应出现 `scp: stat local "22"` 类端口误解析错误
  - 当 `--restart` 失败且传入 `--start` 时，脚本应自动执行启动命令并继续完成部署
  - 传入 `--skip-build` 时应跳过本地构建阶段
