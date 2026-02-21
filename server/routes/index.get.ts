import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createError, setResponseHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const htmlPath = resolve(process.cwd(), 'public', 'beian-love-record.html')

  try {
    const html = await readFile(htmlPath, 'utf8')
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return html
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `备案展示页加载失败: ${String((error as Error)?.message || error)}`
    })
  }
})
