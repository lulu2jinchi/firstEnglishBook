import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const TEST_ROOT = path.resolve('reader-test')
const CASES_DIR = path.join(TEST_ROOT, 'test-cases')
const DEFAULT_MODEL = "Qwen/Qwen3-14B"
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_ENDPOINT = '/api/querySentenceDefination'
const DEFAULT_TEXT = 'The old lighthouse stood against the relentless winds, its keeper devising ways to preserve the fragile glass.'

const SUPPORTED_ASSERTIONS = new Set([
  'status',
  'json-path-exists',
  'json-equals',
  'json-type',
  'json-array-min-length',
  'json-has-keys',
  'json-keys-exact',
  'json-regex',
  'response-time-max-ms'
])

const parseArgs = (argv) => {
  const out = {
    goal: '',
    slug: '',
    endpoint: DEFAULT_ENDPOINT,
    text: DEFAULT_TEXT,
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL,
    apiKey: ''
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--goal') {
      out.goal = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (arg === '--slug') {
      out.slug = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (arg === '--endpoint') {
      out.endpoint = String(argv[i + 1] || '').trim() || DEFAULT_ENDPOINT
      i += 1
      continue
    }
    if (arg === '--text') {
      out.text = String(argv[i + 1] || '').trim() || DEFAULT_TEXT
      i += 1
      continue
    }
    if (arg === '--model') {
      out.model = String(argv[i + 1] || '').trim() || DEFAULT_MODEL
      i += 1
      continue
    }
    if (arg === '--base-url') {
      out.baseUrl = String(argv[i + 1] || '').trim() || DEFAULT_BASE_URL
      i += 1
      continue
    }
    if (arg === '--api-key') {
      out.apiKey = String(argv[i + 1] || '').trim()
      i += 1
    }
  }

  return out
}

const slugify = (value) => {
  const result = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return result || `test-case-${Date.now()}`
}

const readApiKeyFromChooseApi = () => {
  const file = path.resolve('chooseAPI.md')
  if (!existsSync(file)) return ''
  const text = readFileSync(file, 'utf8')
  const matched = text.match(/\bsk-[A-Za-z0-9]+\b/)
  return matched ? matched[0] : ''
}

const parseJsonOrNull = (raw) => {
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const parseJsonContent = (raw) => {
  const direct = parseJsonOrNull(raw)
  if (direct) return direct

  const fenced = String(raw || '').match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const parsed = parseJsonOrNull(fenced[1].trim())
    if (parsed) return parsed
  }

  const firstBrace = String(raw || '').indexOf('{')
  const lastBrace = String(raw || '').lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return parseJsonOrNull(String(raw).slice(firstBrace, lastBrace + 1))
  }

  return null
}

const ensureAssertions = (assertions) => {
  if (!Array.isArray(assertions)) return []
  return assertions
    .filter((item) => item && typeof item === 'object' && SUPPORTED_ASSERTIONS.has(String(item.type || '').trim()))
    .map((item) => ({ ...item }))
}

const defaultCaseDefinition = ({ goal, endpoint, text, title }) => ({
  name: title,
  endpoint,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    text
  },
  timeoutMs: 30000,
  assertions: [
    { type: 'status', equals: 200 },
    { type: 'json-type', path: 'sentence', valueType: 'string' },
    { type: 'json-type', path: 'meaning', valueType: 'object' },
    { type: 'json-regex', path: 'sentence', pattern: '\\[[^\\]]+\\]' },
    { type: 'response-time-max-ms', max: 20000 }
  ],
  meta: {
    goal
  }
})

const buildSystemPrompt = () =>
  [
    '你是测试用例生成器。必须只输出一个合法 JSON 对象，不允许输出解释和代码块。',
    '你输出的 JSON 必须遵循以下结构：',
    '{',
    '  "caseSlug": "kebab-case",',
    '  "caseTitle": "中文标题",',
    '  "description": "用例描述",',
    '  "preconditions": ["前置条件1"],',
    '  "steps": ["步骤1"],',
    '  "expected": ["预期1"],',
    '  "testDefinition": {',
    '    "name": "中文标题",',
    '    "endpoint": "/api/xxx",',
    '    "method": "GET|POST|PUT|PATCH|DELETE",',
    '    "headers": {"Content-Type": "application/json"},',
    '    "query": {"k": "v"},',
    '    "body": {},',
    '    "timeoutMs": 30000,',
    '    "assertions": [',
    '      {"type":"status","equals":200},',
    '      {"type":"json-path-exists","path":"sentence"},',
    '      {"type":"json-type","path":"meaning","valueType":"object"},',
    '      {"type":"json-regex","path":"sentence","pattern":"\\\\[[^\\\\]]+\\\\]"},',
    '      {"type":"json-has-keys","path":"meaning","keys":["fragile"]},',
    '      {"type":"response-time-max-ms","max":20000}',
    '    ]',
    '  }',
    '}',
    '断言 type 只能使用：status/json-path-exists/json-equals/json-type/json-array-min-length/json-has-keys/json-keys-exact/json-regex/response-time-max-ms',
    '只允许输出 JSON。'
  ].join('\n')

const buildUserPrompt = ({ goal, endpoint, text, slugHint }) =>
  [
    `目标: ${goal}`,
    `端点: ${endpoint}`,
    `测试文本: ${text}`,
    `slug建议: ${slugHint}`,
    '请生成可执行 API 自动化用例，关注 JSON 合法性、字段存在性、语义稳定性、速度。'
  ].join('\n')

const generateByAi = async ({ apiKey, baseUrl, model, goal, endpoint, text, slugHint }) => {
  if (!apiKey) {
    throw new Error(
      '缺少 API Key：请设置 TEST_AI_API_KEY/OPENROUTER_API_KEY，或在 chooseAPI.md 中提供 sk- 开头 key'
    )
  }

  const payload = {
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPrompt({ goal, endpoint, text, slugHint })
      }
    ],
    temperature: 0.2,
    stream: false
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000)
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`AI 请求失败: HTTP ${response.status} ${message.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = String(data?.choices?.[0]?.message?.content || '')
  const parsed = parseJsonContent(content)
  if (!parsed) {
    throw new Error('AI 返回内容无法解析为 JSON')
  }
  return parsed
}

const toCaseArtifacts = ({ goal, endpoint, text, aiData, fallbackSlug }) => {
  const caseTitle = String(aiData?.caseTitle || 'AI 生成测试用例').trim() || 'AI 生成测试用例'
  const description = String(aiData?.description || goal || '').trim() || '由 AI 生成的接口自动化用例。'
  const preconditions = Array.isArray(aiData?.preconditions) ? aiData.preconditions.map((item) => String(item)) : []
  const steps = Array.isArray(aiData?.steps) ? aiData.steps.map((item) => String(item)) : []
  const expected = Array.isArray(aiData?.expected) ? aiData.expected.map((item) => String(item)) : []

  const slug = slugify(aiData?.caseSlug || fallbackSlug)
  const fallback = defaultCaseDefinition({
    goal,
    endpoint,
    text,
    title: caseTitle
  })

  const rawDefinition = aiData?.testDefinition && typeof aiData.testDefinition === 'object' ? aiData.testDefinition : fallback
  const assertions = ensureAssertions(rawDefinition.assertions)

  const caseDefinition = {
    ...fallback,
    ...rawDefinition,
    name: String(rawDefinition.name || caseTitle),
    endpoint: String(rawDefinition.endpoint || endpoint || DEFAULT_ENDPOINT),
    method: String(rawDefinition.method || 'POST').toUpperCase(),
    timeoutMs: Number(rawDefinition.timeoutMs || 30000),
    assertions: assertions.length ? assertions : fallback.assertions,
    meta: {
      ...((rawDefinition.meta && typeof rawDefinition.meta === 'object') ? rawDefinition.meta : {}),
      generatedAt: new Date().toISOString(),
      generatedBy: 'scripts/test-system/generate-test-case.mjs',
      goal
    }
  }

  const markdown = [
    `# ${caseTitle}`,
    '',
    '## 用例目标',
    '',
    description,
    '',
    '## 前置条件',
    '',
    ...(preconditions.length ? preconditions.map((item) => `- ${item}`) : ['- 服务已启动，可访问目标接口。']),
    '',
    '## 测试步骤',
    '',
    ...(steps.length ? steps.map((item) => `1. ${item}`) : ['1. 按 test.ts 中定义发送请求。', '1. 校验响应断言。']),
    '',
    '## 预期结果',
    '',
    ...(expected.length ? expected.map((item) => `- ${item}`) : ['- 所有断言通过。']),
    '',
    '## 对应脚本',
    '',
    '- `test.ts`',
    '',
    '## 生成信息',
    '',
    `- 生成时间: ${new Date().toISOString()}`,
    '- 生成方式: AI + 本地兜底校验'
  ].join('\n')

  const tsSource = `export default ${JSON.stringify(caseDefinition, null, 2)} as const\n`

  return {
    slug,
    markdown,
    tsSource,
    caseDefinition
  }
}

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.goal) {
    throw new Error('缺少参数: --goal "描述你要测试的目标"')
  }

  mkdirSync(CASES_DIR, { recursive: true })

  const apiKey =
    args.apiKey ||
    process.env.TEST_AI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    readApiKeyFromChooseApi()

  const fallbackSlug = args.slug || slugify(args.goal)

  let aiData
  try {
    aiData = await generateByAi({
      apiKey,
      baseUrl: args.baseUrl,
      model: args.model,
      goal: args.goal,
      endpoint: args.endpoint,
      text: args.text,
      slugHint: fallbackSlug
    })
  } catch (error) {
    console.warn(`AI 生成失败，使用兜底模板: ${String(error?.message || error)}`)
    aiData = {
      caseSlug: fallbackSlug,
      caseTitle: args.goal,
      description: 'AI 生成失败，使用本地模板生成。',
      preconditions: ['服务启动且接口可访问。'],
      steps: ['发送请求并校验 JSON 结构。'],
      expected: ['接口返回稳定、可解析结果。'],
      testDefinition: defaultCaseDefinition({
        goal: args.goal,
        endpoint: args.endpoint,
        text: args.text,
        title: args.goal
      })
    }
  }

  const artifacts = toCaseArtifacts({
    goal: args.goal,
    endpoint: args.endpoint,
    text: args.text,
    aiData,
    fallbackSlug
  })

  const caseDir = path.join(CASES_DIR, artifacts.slug)
  mkdirSync(caseDir, { recursive: true })
  const mdPath = path.join(caseDir, 'test.md')
  const tsPath = path.join(caseDir, 'test.ts')

  writeFileSync(mdPath, artifacts.markdown)
  writeFileSync(tsPath, artifacts.tsSource)

  console.log(`Created: ${caseDir}`)
  console.log(`- ${mdPath}`)
  console.log(`- ${tsPath}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
