import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const promptFilePath = resolve(process.cwd(), 'prompt.md')
const levelLinePattern = /我的英语水平大约是「([^」]+)」/
const levelScopePattern = /对「[^」]+」来说\*\*可能不熟/
const vocabNumberPattern = /(\d{2,6})/

export type PromptLevel = {
  levelText: string
  vocabularySize: number | null
}

export const readPromptTemplate = async () => readFile(promptFilePath, 'utf8')

export const formatLevelText = (vocabularySize: number) => `词汇量约 ${vocabularySize} 个`

export const parsePromptLevel = (content: string): PromptLevel => {
  const match = content.match(levelLinePattern)
  const levelText = match?.[1]?.trim() ?? ''
  const vocabMatch = levelText.match(vocabNumberPattern)
  const vocabularySize = vocabMatch ? Number(vocabMatch[1]) : null
  return { levelText, vocabularySize: Number.isFinite(vocabularySize) ? vocabularySize : null }
}

export const updatePromptLevel = async (vocabularySize: number): Promise<PromptLevel> => {
  const content = await readPromptTemplate()
  const levelText = formatLevelText(vocabularySize)

  if (!levelLinePattern.test(content) || !levelScopePattern.test(content)) {
    throw new Error('prompt.md 中缺少英语水平描述段落')
  }

  let updated = content.replace(levelLinePattern, `我的英语水平大约是「${levelText}」`)
  updated = updated.replace(levelScopePattern, `对「${levelText}」来说**可能不熟`)

  await writeFile(promptFilePath, updated, 'utf8')
  return { levelText, vocabularySize }
}
