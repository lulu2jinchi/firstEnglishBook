# should-align-meaning-keys-to-target-words

## 用例目标

验证 `/api/querySentenceDefination` 在显式传入 `targetWords` 时，返回的 `meaning` 键集合会严格对齐目标词集合。

## 前置条件

- Nuxt 服务已启动（默认 `http://localhost:3000`）。
- 后端已配置可用模型。

## 测试步骤

1. 发送 POST 请求到 `/api/querySentenceDefination`。
1. 请求体显式传入：
   - `text`
   - `annotatedText`
   - `targetWords`
1. 校验响应状态码、sentence 回传及 `meaning` 键集合。

## 预期结果

- HTTP 状态码为 `200`。
- 响应 `sentence` 严格等于请求的 `annotatedText`。
- 响应 `meaning` 是对象，且键集合严格等于 `targetWords`。
- `meaning` 中每个目标词对应值均为字符串。

## 对应脚本

- `test.ts`
