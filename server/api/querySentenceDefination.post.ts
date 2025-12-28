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

type RequestBody = { text?: string; paragraph?: string } | string | null

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

  return null
}

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

export default defineEventHandler(async (event) => {
  const paragraph = normalizeText(await readBody<RequestBody>(event))

  if (!paragraph) {
    throw createError({ statusCode: 400, statusMessage: '缺少英文段落 text' })
  }

  const {
    siliconflow: { apiKey, baseUrl, model }
  } = useRuntimeConfig()

  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: '未配置 SILICONFLOW_API_KEY' })
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
      messages: [{ role: 'user', content: prompt }],
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
