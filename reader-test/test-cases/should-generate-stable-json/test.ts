export default {
  "name": "验证接口在输入含生词句子时返回稳定 JSON",
  "endpoint": "/api/querySentenceDefination",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "text": "The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass."
  },
  "timeoutMs": 30000,
  "assertions": [
    {
      "type": "status",
      "equals": 200
    },
    {
      "type": "json-type",
      "path": "sentence",
      "valueType": "string"
    },
    {
      "type": "json-type",
      "path": "meaning",
      "valueType": "object"
    },
    {
      "type": "json-regex",
      "path": "sentence",
      "pattern": "\\[[^\\]]+\\]"
    },
    {
      "type": "response-time-max-ms",
      "max": 20000
    }
  ],
  "meta": {
    "goal": "验证接口在输入含生词句子时返回稳定 JSON",
    "generatedAt": "2026-02-10T03:30:57.412Z",
    "generatedBy": "scripts/test-system/generate-test-case.mjs"
  }
} as const
