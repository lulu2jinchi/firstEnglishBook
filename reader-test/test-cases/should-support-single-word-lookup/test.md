# should-support-single-word-lookup

## 用例目标

验证 `/api/querySentenceDefination` 在“长按查词”场景下（单词级输入）能返回稳定、可渲染的释义结果。

## 前置条件

- Nuxt 服务已启动（默认 `http://localhost:3000`）。
- 后端可访问 OpenRouter 模型接口（或已配置可用模型）。

## 测试步骤

1. 发送 POST 请求到 `/api/querySentenceDefination`。
1. 请求体显式传入：
   - `text: "fragile"`
   - `annotatedText: "[fragile]"`
   - `targetWords: ["fragile"]`
1. 校验 sentence 回传、meaning 键集合和类型。

## 预期结果

- HTTP 状态码为 `200`。
- 响应 `sentence` 严格等于 `[fragile]`。
- 响应 `meaning` 是对象，且键集合严格等于 `["fragile"]`。
- `meaning.fragile` 为非空字符串。

## 对应脚本

- `test.ts`
