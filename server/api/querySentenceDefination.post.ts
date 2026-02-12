import { createError } from 'h3'
import { applyPromptLevel, readPromptTemplate } from '../utils/prompt'

interface ChatChoiceMessage {
  content?: string
}

interface ChatChoice {
  message?: ChatChoiceMessage
}

interface ChatCompletionResponse {
  choices?: ChatChoice[]
}

type RequestBody =
  | {
      text?: string
      paragraph?: string
      annotatedText?: string
      targetWords?: string[]
      vocabularySize?: number | string
    }
  | string
  | null

type SentenceDefinitionResponse = {
  sentence: string
  meaning: Record<string, string>
}

const annotatedTextPlaceholder = '{{ANNOTATED_TEXT}}'
const targetWordsPlaceholder = '{{TARGET_WORDS}}'

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const parseJsonContent = (raw: string) => {
  const direct = tryParseJson(raw)
  if (direct) return direct

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return tryParseJson(fenced[1].trim())
  }

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1)
    const extracted = tryParseJson(candidate)
    if (extracted) return extracted
  }

  return null
}

const strictJsonSystemPrompt =
  '你是严格的 JSON 生成器。只输出一个合法 JSON 对象，不要输出任何额外文字、解释或代码块。'

const buildMessages = (prompt: string) => [
  { role: 'system', content: strictJsonSystemPrompt },
  { role: 'user', content: prompt }
]

const normalizeText = (body: RequestBody): string => {
  if (typeof body === 'string') {
    return body.trim()
  }

  if (body && typeof body === 'object') {
    if (typeof body.text === 'string') {
      return body.text.trim()
    }
    if (typeof body.paragraph === 'string') {
      return body.paragraph.trim()
    }
  }

  return ''
}

const normalizeAnnotatedText = (body: RequestBody, fallbackText: string): string => {
  if (body && typeof body === 'object' && typeof body.annotatedText === 'string') {
    const trimmed = body.annotatedText.trim()
    if (trimmed) return trimmed
  }
  return fallbackText
}

const normalizeWordKey = (word: string) =>
  word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[^a-z'-]+|[^a-z'-]+$/g, '')

const normalizeTargetWords = (raw: unknown) => {
  if (!Array.isArray(raw)) return []
  const targetWords: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const normalized = normalizeWordKey(item)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    targetWords.push(normalized)
  }
  return targetWords
}

const extractTargetWordsFromAnnotatedText = (text: string) => {
  const targetWords: string[] = []
  const seen = new Set<string>()
  const matches = text.matchAll(/\[([^\]]+)\]/g)
  for (const matched of matches) {
    const normalized = normalizeWordKey(matched[1] || '')
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    targetWords.push(normalized)
  }
  return targetWords
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const normalizeVocabularySize = (raw: number) => {
  if (!Number.isFinite(raw)) return null
  const rounded = Math.round(raw)
  const min = 1000
  const max = 20000
  if (rounded < min || rounded > max) {
    return null
  }
  return rounded
}

const normalizeMeaningMap = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const meaning: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (typeof rawValue !== 'string') continue
    const key = normalizeWordKey(rawKey)
    const value = rawValue.trim()
    if (!key || !value) continue
    meaning[key] = value
  }
  return meaning
}

const hasExactWordKeys = (meaning: Record<string, string>, targetWords: string[]) => {
  const expected = [...targetWords].sort()
  const actual = Object.keys(meaning).sort()
  return JSON.stringify(actual) === JSON.stringify(expected)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)
  const paragraph = normalizeText(body)

  if (!paragraph) {
    throw createError({ statusCode: 400, statusMessage: '缺少英文段落 text' })
  }

  const bodyConfig = typeof body === 'object' && body !== null ? body : {}
  const hasVocabularySize = Object.prototype.hasOwnProperty.call(bodyConfig, 'vocabularySize')
  const normalizedVocabularySize = normalizeVocabularySize(Number(bodyConfig.vocabularySize))

  if (hasVocabularySize && normalizedVocabularySize === null) {
    throw createError({ statusCode: 400, statusMessage: '词汇量需要在 1000 到 20000 之间' })
  }

  if (
    Object.prototype.hasOwnProperty.call(bodyConfig, 'annotatedText') &&
    typeof bodyConfig.annotatedText !== 'string'
  ) {
    throw createError({ statusCode: 400, statusMessage: 'annotatedText 必须是字符串' })
  }

  if (
    Object.prototype.hasOwnProperty.call(bodyConfig, 'targetWords') &&
    !Array.isArray(bodyConfig.targetWords)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'targetWords 必须是字符串数组' })
  }

  const annotatedText = normalizeAnnotatedText(body, paragraph)
  const normalizedTargetWords = normalizeTargetWords(bodyConfig.targetWords)
  const targetWords =
    normalizedTargetWords.length > 0
      ? normalizedTargetWords
      : extractTargetWordsFromAnnotatedText(annotatedText)

  if (targetWords.length === 0) {
    return {
      sentence: paragraph,
      meaning: {}
    } satisfies SentenceDefinitionResponse
  }

  const { openrouter } = useRuntimeConfig()
  const apiKey = openrouter.apiKey?.trim() || ''
  const baseUrl = openrouter.baseUrl?.trim() ? normalizeBaseUrl(openrouter.baseUrl) : ''
  const model = openrouter.model?.trim() || ''
  const siteUrl = openrouter.siteUrl?.trim() || ''
  const appName = openrouter.appName?.trim() || ''

  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: '服务端未配置 API Key' })
  }

  if (!baseUrl) {
    throw createError({ statusCode: 500, statusMessage: '服务端未配置 Base URL' })
  }

  if (!model) {
    throw createError({ statusCode: 500, statusMessage: '服务端未配置模型名称' })
  }

  let prompt = ''
  try {
    const promptTemplate = await readPromptTemplate()
    const tunedTemplate =
      normalizedVocabularySize !== null ? applyPromptLevel(promptTemplate, normalizedVocabularySize) : promptTemplate
    prompt = tunedTemplate
      .replace('{{TEXT}}', paragraph)
      .replace(annotatedTextPlaceholder, annotatedText)
      .replace(targetWordsPlaceholder, JSON.stringify(targetWords))
  } catch {
    throw createError({ statusCode: 500, statusMessage: '读取 prompt.md 失败' })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }

  if (siteUrl) {
    headers['HTTP-Referer'] = siteUrl
  }

  if (appName) {
    headers['X-Title'] = appName
  }

  const response = await $fetch<ChatCompletionResponse>(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: {
      model,
      messages: buildMessages(prompt),
      stream: false,
      temperature: 0.3
    }
  })

  const content = response.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw createError({ statusCode: 502, statusMessage: '大模型未返回内容' })
  }

  const parsed = parseJsonContent(content) as
    | {
        sentence?: unknown
        meaning?: unknown
      }
    | null

  if (!parsed) {
    throw createError({ statusCode: 502, statusMessage: '大模型返回内容无法解析为 JSON' })
  }

  const modelSentence = typeof parsed.sentence === 'string' ? parsed.sentence : ''
  if (modelSentence && modelSentence !== annotatedText) {
    // eslint-disable-next-line no-console
    console.warn('大模型返回 sentence 与预处理文本不一致，已回退为 annotatedText')
  }

  const meaning = normalizeMeaningMap(parsed.meaning)
  if (!meaning) {
    throw createError({ statusCode: 502, statusMessage: '大模型返回缺少 meaning 对象' })
  }

  if (!hasExactWordKeys(meaning, targetWords)) {
    throw createError({ statusCode: 502, statusMessage: '大模型返回 meaning 键集合与 targetWords 不一致' })
  }

  return {
    sentence: annotatedText,
    meaning
  } satisfies SentenceDefinitionResponse
})
