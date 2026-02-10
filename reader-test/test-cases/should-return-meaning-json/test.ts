export default {
  name: 'querySentenceDefination 返回 sentence 和 meaning',
  endpoint: '/api/querySentenceDefination',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    text: 'The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass.'
  },
  timeoutMs: 30000,
  assertions: [
    { type: 'status', equals: 200 },
    { type: 'json-type', path: 'sentence', valueType: 'string' },
    { type: 'json-type', path: 'meaning', valueType: 'object' },
    { type: 'json-regex', path: 'sentence', pattern: '\\[[^\\]]+\\]' },
    { type: 'json-has-keys', path: 'meaning', keys: ['lighthouse', 'relentless', 'devising', 'fragile'] },
    { type: 'response-time-max-ms', max: 20000 }
  ]
} as const
