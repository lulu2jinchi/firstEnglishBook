import { createError } from 'h3'
import { parsePromptLevel, readPromptTemplate } from '../utils/prompt'

export default defineEventHandler(async () => {
  try {
    const content = await readPromptTemplate()
    return parsePromptLevel(content)
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: '读取 prompt.md 失败'
    })
  }
})
