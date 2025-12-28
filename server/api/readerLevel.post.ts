import { createError } from 'h3'
import { updatePromptLevel } from '../utils/prompt'

type RequestBody = {
  vocabularySize?: number | string
}

const normalizeVocabularySize = (raw: number) => {
  const rounded = Math.round(raw)
  const min = 1000
  const max = 20000
  if (rounded < min || rounded > max) {
    return null
  }
  return rounded
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)
  const vocabularySize = Number(body?.vocabularySize)

  if (!Number.isFinite(vocabularySize)) {
    throw createError({ statusCode: 400, statusMessage: '词汇量必须是数字' })
  }

  const normalized = normalizeVocabularySize(vocabularySize)

  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: '词汇量需要在 1000 到 20000 之间' })
  }

  try {
    return await updatePromptLevel(normalized)
  } catch {
    throw createError({ statusCode: 500, statusMessage: '更新 prompt.md 失败' })
  }
})
