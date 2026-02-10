import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

const TEST_ROOT = path.resolve('reader-test')
const CASES_DIR = path.join(TEST_ROOT, 'test-cases')
const RUNS_DIR = path.join(TEST_ROOT, 'test-cases-runs')

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
    baseUrl: 'http://localhost:3000',
    onlyCase: '',
    dryRun: false,
    runId: ''
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--base-url') {
      out.baseUrl = String(argv[i + 1] || '').trim() || out.baseUrl
      i += 1
      continue
    }
    if (arg === '--case') {
      out.onlyCase = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (arg === '--run-id') {
      out.runId = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (arg === '--dry-run') {
      out.dryRun = true
    }
  }

  return out
}

const formatRunId = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('-')
}

const listCaseFiles = (onlyCase) => {
  const entries = readdirSync(CASES_DIR, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (onlyCase && entry.name !== onlyCase) continue
    const tsFile = path.join(CASES_DIR, entry.name, 'test.ts')
    try {
      if (statSync(tsFile).isFile()) {
        files.push({ slug: entry.name, file: tsFile })
      }
    } catch {
      // ignore invalid folder
    }
  }
  return files.sort((a, b) => a.slug.localeCompare(b.slug))
}

const normalizeMethod = (method) => {
  const m = String(method || 'GET').trim().toUpperCase()
  if (m === 'GET' || m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
    return m
  }
  return 'GET'
}

const buildUrl = (baseUrl, endpoint, query) => {
  const url = new URL(String(endpoint || ''), baseUrl)
  if (query && typeof query === 'object') {
    for (const [key, rawValue] of Object.entries(query)) {
      if (rawValue === undefined || rawValue === null) continue
      url.searchParams.set(key, String(rawValue))
    }
  }
  return url
}

const parseJsonOrNull = (text) => {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const pathTokens = (rawPath) =>
  String(rawPath || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((token) => token.trim())
    .filter(Boolean)

const getByPath = (source, rawPath) => {
  const tokens = pathTokens(rawPath)
  let current = source
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = current[token]
  }
  return current
}

const arrayEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) return false
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }
  return true
}

const evaluateAssertion = (assertion, context) => {
  const type = String(assertion?.type || '').trim()
  if (!SUPPORTED_ASSERTIONS.has(type)) {
    return { pass: false, message: `不支持的断言类型: ${type || 'EMPTY'}` }
  }

  if (type === 'status') {
    const expected = Number(assertion.equals)
    const pass = Number.isFinite(expected) && context.status === expected
    return { pass, message: pass ? `HTTP 状态码=${context.status}` : `期望状态码=${expected}, 实际=${context.status}` }
  }

  if (type === 'response-time-max-ms') {
    const max = Number(assertion.max)
    const pass = Number.isFinite(max) && context.elapsedMs <= max
    return { pass, message: pass ? `耗时 ${context.elapsedMs}ms <= ${max}ms` : `耗时 ${context.elapsedMs}ms > ${max}ms` }
  }

  if (context.jsonBody === null) {
    return { pass: false, message: '响应不是 JSON，无法执行 JSON 断言' }
  }

  const value = getByPath(context.jsonBody, assertion.path)

  if (type === 'json-path-exists') {
    const pass = value !== undefined
    return { pass, message: pass ? `路径存在: ${assertion.path}` : `路径不存在: ${assertion.path}` }
  }

  if (type === 'json-equals') {
    const expected = assertion.equals
    const pass = JSON.stringify(value) === JSON.stringify(expected)
    return {
      pass,
      message: pass
        ? `路径值匹配: ${assertion.path}`
        : `路径值不匹配: ${assertion.path}, expected=${JSON.stringify(expected)}, actual=${JSON.stringify(value)}`
    }
  }

  if (type === 'json-type') {
    const expectedType = String(assertion.valueType || '').trim()
    const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
    const pass = actualType === expectedType
    return {
      pass,
      message: pass ? `类型匹配: ${assertion.path}=${actualType}` : `类型不匹配: ${assertion.path}, expected=${expectedType}, actual=${actualType}`
    }
  }

  if (type === 'json-array-min-length') {
    const min = Number(assertion.min)
    const pass = Array.isArray(value) && value.length >= min
    return {
      pass,
      message: pass ? `数组长度满足: ${value.length} >= ${min}` : `数组长度不满足: ${Array.isArray(value) ? value.length : 'N/A'} < ${min}`
    }
  }

  if (type === 'json-has-keys') {
    const keys = Array.isArray(assertion.keys) ? assertion.keys.map((k) => String(k)) : []
    const pass = !!value && typeof value === 'object' && !Array.isArray(value) && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    return {
      pass,
      message: pass ? `对象包含指定键: ${keys.join(', ')}` : `对象缺少指定键: ${keys.join(', ')}`
    }
  }

  if (type === 'json-keys-exact') {
    const expectedKeys = (Array.isArray(assertion.keys) ? assertion.keys : []).map((k) => String(k)).sort()
    const actualKeys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : []
    const pass = arrayEqual(actualKeys, expectedKeys)
    return {
      pass,
      message: pass ? `对象键完全匹配: ${expectedKeys.join(', ')}` : `对象键不匹配: expected=${expectedKeys.join(', ')}, actual=${actualKeys.join(', ')}`
    }
  }

  if (type === 'json-regex') {
    try {
      const regex = new RegExp(String(assertion.pattern || ''), String(assertion.flags || ''))
      const pass = regex.test(String(value ?? ''))
      return {
        pass,
        message: pass ? `正则匹配成功: ${assertion.path}` : `正则匹配失败: ${assertion.path}`
      }
    } catch (error) {
      return { pass: false, message: `无效正则: ${String(error?.message || error)}` }
    }
  }

  return { pass: false, message: `未处理断言类型: ${type}` }
}

const truncate = (text, max = 800) => {
  const str = String(text || '')
  if (str.length <= max) return str
  return `${str.slice(0, max)} ...(truncated)`
}

const toJson = (value) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const executeCase = async ({ slug, definition, baseUrl, dryRun }) => {
  const started = performance.now()
  const endpoint = String(definition.endpoint || '').trim()
  const method = normalizeMethod(definition.method)
  const timeoutMs = Number(definition.timeoutMs || 30000)
  const assertions = Array.isArray(definition.assertions) ? definition.assertions : []

  if (!endpoint) {
    return {
      slug,
      name: String(definition.name || slug),
      pass: false,
      elapsedMs: 0,
      status: 0,
      responseText: '',
      assertionResults: [{ pass: false, message: '缺少 endpoint 配置', assertion: { type: 'internal' } }],
      requestSummary: { method, endpoint, body: definition.body, headers: definition.headers, query: definition.query }
    }
  }

  if (dryRun) {
    const elapsedMs = Math.round(performance.now() - started)
    return {
      slug,
      name: String(definition.name || slug),
      pass: true,
      elapsedMs,
      status: 0,
      responseText: 'dry-run: skipped request',
      assertionResults: assertions.map((assertion) => ({ pass: true, message: 'dry-run: skipped assertion', assertion })),
      requestSummary: { method, endpoint, body: definition.body, headers: definition.headers, query: definition.query }
    }
  }

  const url = buildUrl(baseUrl, endpoint, definition.query)
  const headers = { ...(definition.headers && typeof definition.headers === 'object' ? definition.headers : {}) }

  let body = undefined
  if (definition.body !== undefined) {
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
    body = typeof definition.body === 'string' ? definition.body : JSON.stringify(definition.body)
  }

  let status = 0
  let responseText = ''
  let requestError = ''
  let jsonBody = null

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs)
    })
    status = response.status
    responseText = await response.text()
    jsonBody = parseJsonOrNull(responseText)
  } catch (error) {
    requestError = String(error?.message || error)
  }

  const elapsedMs = Math.round(performance.now() - started)

  const context = {
    status,
    responseText,
    jsonBody,
    elapsedMs,
    requestError
  }

  const assertionResults = []
  if (requestError) {
    assertionResults.push({ pass: false, message: `请求失败: ${requestError}`, assertion: { type: 'request' } })
  }

  for (const assertion of assertions) {
    assertionResults.push({
      ...evaluateAssertion(assertion, context),
      assertion
    })
  }

  const pass = assertionResults.length > 0 && assertionResults.every((item) => item.pass)

  return {
    slug,
    name: String(definition.name || slug),
    pass,
    elapsedMs,
    status,
    responseText: requestError ? requestError : responseText,
    assertionResults,
    requestSummary: {
      method,
      endpoint,
      query: definition.query,
      headers,
      body: definition.body
    }
  }
}

const buildReport = ({ runId, startedAt, finishedAt, baseUrl, results, dryRun }) => {
  const total = results.length
  const passed = results.filter((item) => item.pass).length
  const failed = total - passed
  const durationSec = ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2)

  const lines = []
  lines.push('# 测试报告')
  lines.push('')
  lines.push(`- 运行 ID: ${runId}`)
  lines.push(`- 开始时间: ${startedAt.toISOString()}`)
  lines.push(`- 结束时间: ${finishedAt.toISOString()}`)
  lines.push(`- 目标地址: ${baseUrl}`)
  lines.push(`- 执行模式: ${dryRun ? 'dry-run（仅校验用例结构）' : 'real-run（真实请求）'}`)
  lines.push(`- 用例总数: ${total}`)
  lines.push(`- 通过: ${passed}`)
  lines.push(`- 失败: ${failed}`)
  lines.push(`- 总耗时: ${durationSec}s`)
  lines.push('')
  lines.push('## 汇总')
  lines.push('')
  lines.push('| 用例目录 | 状态 | 耗时(ms) | HTTP状态 |')
  lines.push('| --- | --- | ---: | ---: |')
  for (const item of results) {
    lines.push(`| ${item.slug} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.elapsedMs} | ${item.status} |`)
  }

  lines.push('')
  lines.push('## 详情')
  lines.push('')

  for (const item of results) {
    lines.push(`### ${item.slug}`)
    lines.push('')
    lines.push(`- 名称: ${item.name}`)
    lines.push(`- 状态: ${item.pass ? 'PASS' : 'FAIL'}`)
    lines.push(`- 耗时: ${item.elapsedMs}ms`)
    lines.push(`- HTTP 状态码: ${item.status}`)
    lines.push('')
    lines.push('请求配置：')
    lines.push('```json')
    lines.push(toJson(item.requestSummary))
    lines.push('```')
    lines.push('')
    lines.push('断言结果：')
    lines.push('')
    lines.push('| 断言类型 | 状态 | 说明 |')
    lines.push('| --- | --- | --- |')
    for (const assertionResult of item.assertionResults) {
      lines.push(`| ${assertionResult.assertion?.type || 'N/A'} | ${assertionResult.pass ? 'PASS' : 'FAIL'} | ${assertionResult.message.replace(/\|/g, '\\|')} |`)
    }
    lines.push('')
    lines.push('响应片段：')
    lines.push('```text')
    lines.push(truncate(item.responseText, 1200))
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

const validateCaseDefinition = (slug, definition) => {
  if (!definition || typeof definition !== 'object') {
    throw new Error(`用例 ${slug} 导出内容必须是对象`) 
  }
  const assertions = definition.assertions
  if (!Array.isArray(assertions) || assertions.length === 0) {
    throw new Error(`用例 ${slug} 缺少 assertions，或 assertions 为空`) 
  }
  for (const assertion of assertions) {
    const type = String(assertion?.type || '').trim()
    if (!SUPPORTED_ASSERTIONS.has(type)) {
      throw new Error(`用例 ${slug} 使用了不支持的断言: ${type || 'EMPTY'}`)
    }
  }
}

const run = async () => {
  const args = parseArgs(process.argv.slice(2))

  mkdirSync(RUNS_DIR, { recursive: true })

  const caseFiles = listCaseFiles(args.onlyCase)
  if (caseFiles.length === 0) {
    throw new Error(`未在 ${CASES_DIR} 下找到可执行用例`) 
  }

  const runId = args.runId || formatRunId()
  const startedAt = new Date()
  const results = []

  for (const item of caseFiles) {
    const fileUrl = `${pathToFileURL(item.file).href}?v=${Date.now()}`
    const module = await import(fileUrl)
    const definition = module.default
    validateCaseDefinition(item.slug, definition)

    // 串行执行，避免并发对后端造成瞬时压力。
    const result = await executeCase({
      slug: item.slug,
      definition,
      baseUrl: args.baseUrl,
      dryRun: args.dryRun
    })
    results.push(result)
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${item.slug} (${result.elapsedMs}ms)`)
  }

  const finishedAt = new Date()
  const report = buildReport({
    runId,
    startedAt,
    finishedAt,
    baseUrl: args.baseUrl,
    results,
    dryRun: args.dryRun
  })

  const runDir = path.join(RUNS_DIR, runId)
  mkdirSync(runDir, { recursive: true })
  const reportPath = path.join(runDir, 'report.md')
  writeFileSync(reportPath, report)

  console.log(`\nReport: ${reportPath}`)

  const failedCount = results.filter((item) => !item.pass).length
  if (failedCount > 0) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
