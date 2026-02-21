export default {
  name: 'querySentenceDefination 返回 meaning 键对齐 targetWords',
  endpoint: '/api/querySentenceDefination',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    text: "The keeper didn't ignore the fragile glass.",
    annotatedText: "The keeper [didn't] ignore the [fragile] glass.",
    targetWords: ["didn't", 'fragile'],
    vocabularySize: 6000
  },
  timeoutMs: 30000,
  assertions: [
    { type: 'status', equals: 200 },
    { type: 'json-equals', path: 'sentence', equals: "The keeper [didn't] ignore the [fragile] glass." },
    { type: 'json-type', path: 'meaning', valueType: 'object' },
    { type: 'json-keys-exact', path: 'meaning', keys: ["didn't", 'fragile'] },
    { type: 'json-type', path: "meaning.didn't", valueType: 'string' },
    { type: 'json-type', path: 'meaning.fragile', valueType: 'string' },
    { type: 'response-time-max-ms', max: 20000 }
  ]
} as const
