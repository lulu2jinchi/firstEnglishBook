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
- `--base-url`：模型 API 地址（默认硅基流动 OpenAI 兼容地址）
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
  - 在“字体与排版”中调节“释义字号”后，单词释义 tooltip 字体同步变化
  - 刷新页面后释义字号保持上次设置值
