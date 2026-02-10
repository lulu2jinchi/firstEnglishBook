# 测试报告

- 运行 ID: 2026-02-10-11-29-49
- 开始时间: 2026-02-10T03:29:49.567Z
- 结束时间: 2026-02-10T03:29:49.601Z
- 目标地址: http://localhost:3000
- 执行模式: dry-run（仅校验用例结构）
- 用例总数: 1
- 通过: 1
- 失败: 0
- 总耗时: 0.03s

## 汇总

| 用例目录 | 状态 | 耗时(ms) | HTTP状态 |
| --- | --- | ---: | ---: |
| should-return-meaning-json | PASS | 0 | 0 |

## 详情

### should-return-meaning-json

- 名称: querySentenceDefination 返回 sentence 和 meaning
- 状态: PASS
- 耗时: 0ms
- HTTP 状态码: 0

请求配置：
```json
{
  "method": "POST",
  "endpoint": "/api/querySentenceDefination",
  "body": {
    "text": "The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass."
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
| json-type | PASS | dry-run: skipped assertion |
| json-type | PASS | dry-run: skipped assertion |
| json-regex | PASS | dry-run: skipped assertion |
| json-has-keys | PASS | dry-run: skipped assertion |
| response-time-max-ms | PASS | dry-run: skipped assertion |

响应片段：
```text
dry-run: skipped request
```
