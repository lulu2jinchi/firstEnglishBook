# 测试报告

- 运行 ID: 2026-02-20-18-01-35
- 开始时间: 2026-02-20T10:01:35.755Z
- 结束时间: 2026-02-20T10:01:35.797Z
- 目标地址: http://localhost:3000
- 执行模式: dry-run（仅校验用例结构）
- 用例总数: 1
- 通过: 1
- 失败: 0
- 总耗时: 0.04s

## 汇总

| 用例目录 | 状态 | 耗时(ms) | HTTP状态 |
| --- | --- | ---: | ---: |
| should-align-meaning-keys-to-target-words | PASS | 0 | 0 |

## 详情

### should-align-meaning-keys-to-target-words

- 名称: querySentenceDefination 返回 meaning 键对齐 targetWords
- 状态: PASS
- 耗时: 0ms
- HTTP 状态码: 0

请求配置：
```json
{
  "method": "POST",
  "endpoint": "/api/querySentenceDefination",
  "body": {
    "text": "The keeper didn't ignore the fragile glass.",
    "annotatedText": "The keeper [didn't] ignore the [fragile] glass.",
    "targetWords": [
      "didn't",
      "fragile"
    ],
    "vocabularySize": 6000
  },
  "headers": {
    "Content-Type": "application/json"
  }
}
```

断言结果：

| 断言类型 | 状态 | 说明 |
| --- | --- | --- |
| status | PASS | dry-run: skipped assertion |
| json-equals | PASS | dry-run: skipped assertion |
| json-type | PASS | dry-run: skipped assertion |
| json-keys-exact | PASS | dry-run: skipped assertion |
| json-type | PASS | dry-run: skipped assertion |
| json-type | PASS | dry-run: skipped assertion |
| response-time-max-ms | PASS | dry-run: skipped assertion |

响应片段：
```text
dry-run: skipped request
```
