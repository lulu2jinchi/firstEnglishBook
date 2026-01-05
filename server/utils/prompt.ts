import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { useStorage } from 'nitropack/runtime'

const promptFilePath = resolve(process.cwd(), 'prompt.md')
const levelLinePattern = /我的英语水平大约是「([^」]+)」/
const levelScopePattern = /对「[^」]+」来说\*\*可能不熟/
const vocabNumberPattern = /(\d{2,6})/
const promptAssetKey = 'prompt.md'
let runtimePromptOverride: string | null = null

export type PromptLevel = {
  levelText: string
  vocabularySize: number | null
}

const shouldIgnoreWriteError = () =>
  process.env.VERCEL === '1' || process.env.NITRO_PRESET === 'vercel'

const readPromptFromAssets = async () => {
  try {
    const asset = await useStorage('assets:server').getItemRaw<
      Uint8Array | string
    >(promptAssetKey)
    if (!asset) {
      return null
    }
    if (typeof asset === 'string') {
      return asset
    }
    return Buffer.from(asset).toString('utf8')
  } catch {
    return null
  }
}

export const readPromptTemplate = async () => {
  if (runtimePromptOverride) {
    return runtimePromptOverride
  }
  try {
    return await readFile(promptFilePath, 'utf8')
  } catch {
    const asset = await readPromptFromAssets()
    if (asset) {
      return asset
    }
    throw new Error('prompt.md 读取失败')
  }
}

export const formatLevelText = (vocabularySize: number) => `词汇量约 ${vocabularySize} 个`

export const parsePromptLevel = (content: string): PromptLevel => {
  const match = content.match(levelLinePattern)
  const levelText = match?.[1]?.trim() ?? ''
  const vocabMatch = levelText.match(vocabNumberPattern)
  const vocabularySize = vocabMatch ? Number(vocabMatch[1]) : null
  return { levelText, vocabularySize: Number.isFinite(vocabularySize) ? vocabularySize : null }
}

export const applyPromptLevel = (content: string, vocabularySize: number) => {
  const levelText = formatLevelText(vocabularySize)
  if (!levelLinePattern.test(content) || !levelScopePattern.test(content)) {
    return content
  }
  let updated = content.replace(levelLinePattern, `我的英语水平大约是「${levelText}」`)
  updated = updated.replace(levelScopePattern, `对「${levelText}」来说**可能不熟`)
  return updated
}

export const updatePromptLevel = async (vocabularySize: number): Promise<PromptLevel> => {
  const content = await readPromptTemplate()
  const levelText = formatLevelText(vocabularySize)

  if (!levelLinePattern.test(content) || !levelScopePattern.test(content)) {
    throw new Error('prompt.md 中缺少英语水平描述段落')
  }

  let updated = content.replace(levelLinePattern, `我的英语水平大约是「${levelText}」`)
  updated = updated.replace(levelScopePattern, `对「${levelText}」来说**可能不熟`)

  try {
    await writeFile(promptFilePath, updated, 'utf8')
  } catch (error) {
    runtimePromptOverride = updated
    if (!shouldIgnoreWriteError()) {
      throw error
    }
  }
  return { levelText, vocabularySize }
}
