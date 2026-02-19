export default {
  name: 'querySentenceDefination 支持单词级查词',
  endpoint: '/api/querySentenceDefination',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    text: 'fragile',
    annotatedText: '[fragile]',
    targetWords: ['fragile'],
    vocabularySize: 6000
  },
  timeoutMs: 30000,
  assertions: [
    { type: 'status', equals: 200 },
    { type: 'json-equals', path: 'sentence', equals: '[fragile]' },
    { type: 'json-type', path: 'meaning', valueType: 'object' },
    { type: 'json-keys-exact', path: 'meaning', keys: ['fragile'] },
    { type: 'json-type', path: 'meaning.fragile', valueType: 'string' },
    { type: 'response-time-max-ms', max: 20000 }
  ]
} as const
