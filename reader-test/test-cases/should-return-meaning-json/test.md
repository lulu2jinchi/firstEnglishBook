# should-return-meaning-json

## 用例目标

验证 `/api/querySentenceDefination` 在输入英文句子后，返回可解析 JSON，并包含 `sentence` 与 `meaning` 字段。

## 前置条件

- Nuxt 服务已启动（默认 `http://localhost:3000`）。
- 后端可访问 OpenRouter 模型接口（或已配置可用模型）。

## 测试步骤

1. 发送 POST 请求到 `/api/querySentenceDefination`。
1. 请求体包含一段英文文本。
1. 校验响应状态码、字段类型和关键释义键。

## 预期结果

- HTTP 状态码为 `200`。
- 响应 `sentence` 字段是字符串。
- 响应 `meaning` 字段是对象。
- `meaning` 至少包含 `lighthouse/relentless/devising/fragile` 四个键。

## 对应脚本

- `test.ts`
