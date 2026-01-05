import { createError } from 'h3'
import { readPromptTemplate } from '../utils/prompt'

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
      baseUrl?: string
      apiKey?: string
      model?: string
    }
  | string
  | null

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

const buildPrompt = async (text: string) => {
  const promptTemplate = await readPromptTemplate()
  return promptTemplate.replace('{{TEXT}}', text)
}

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

const pickConfigValue = (value?: string, fallback?: string) => {
  const trimmed = value?.trim() ?? ''
  if (trimmed) return trimmed
  return fallback?.trim() ?? ''
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)
  const paragraph = normalizeText(body)

  if (!paragraph) {
    throw createError({ statusCode: 400, statusMessage: '缺少英文段落 text' })
  }

  const { siliconflow } = useRuntimeConfig()
  const bodyConfig = typeof body === 'object' && body !== null ? body : {}
  const apiKey = pickConfigValue(bodyConfig.apiKey, siliconflow.apiKey)
  const baseUrlRaw = pickConfigValue(bodyConfig.baseUrl, siliconflow.baseUrl)
  const model = pickConfigValue(bodyConfig.model, siliconflow.model)
  const baseUrl = baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : ''

  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: '未配置 API Key' })
  }

  if (!baseUrl) {
    throw createError({ statusCode: 400, statusMessage: '未配置 Base URL' })
  }

  if (!model) {
    throw createError({ statusCode: 400, statusMessage: '未配置模型名称' })
  }

  let prompt = ''
  try {
    prompt = await buildPrompt(paragraph)
  } catch {
    throw createError({ statusCode: 500, statusMessage: '读取 prompt.md 失败' })
  }


  const response = await $fetch<ChatCompletionResponse>(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
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


  const parsed = parseJsonContent(content)

  if (!parsed) {
    throw createError({ statusCode: 502, statusMessage: '大模型返回内容无法解析为 JSON' })
  }

  return parsed
})
