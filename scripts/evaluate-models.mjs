import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import lemmatizer from 'wink-lemmatizer'

const INPUT_PATH = 'chooseAPI.md'
const COCA_PATH = 'public/coca-20000.json'
const OUTPUT_JSON_PATH = 'model_eval_results.json'
const OUTPUT_XLSX_PATH = 'model_eval_results.xlsx'
const ENDPOINT = process.env.MODEL_EVAL_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions'
const VOCAB_THRESHOLD = 6000
const MODEL_TIMEOUT_MS = 120000

const SAMPLE_TEXT = `She turns and walks down the hall. He follows her, closing the door behind him. Down a few steps in the kitchen, his mother Lorraine is peeling off a pair of rubber gloves. Marianne hops onto the countertop and picks up an open jar of chocolate spread, in which she has left a teaspoon.

Marianne was telling me you got your mock results today, Lorraine says.

We got English back, he says. They come back separately. Do you want to head on?

Lorraine folds the rubber gloves up neatly and replaces them below the sink. Then she starts unclipping her hair. To Connell this seems like something she could accomplish in the car.

And I hear you did very well, she says.

He was top of the class, says Marianne.

Right, Connell says. Marianne did pretty good too. Can we go?

Lorraine pauses in the untying of her apron.

I didn’t realise we were in a rush, she says.

He puts his hands in his pockets and suppresses an irritable sigh, but suppresses it with an audible intake of breath, so that it still sounds like a sigh.

I just have to pop up and take a load out of the dryer, says Lorraine. And then we’ll be off. Okay?

He says nothing, merely hanging his head while Lorraine leaves the room.

Do you want some of this? Marianne says.

She’s holding out the jar of chocolate spread. He presses his hands down slightly further into his pockets, as if trying to store his entire body in his pockets all at once.`

const STRICT_JSON_SYSTEM_PROMPT =
  '你是严格的 JSON 生成器。只输出一个合法 JSON 对象，不要输出任何额外文字、解释或代码块。'

const MODEL_ALLOWLIST = [
  'Qwen/Qwen3-30B-A3B-Instruct-2507',
  'Qwen/Qwen3-30B-A3B',
  'Qwen/Qwen3-32B',
  'Qwen/Qwen3-14B',
  'Qwen/Qwen3-8B',
  'Qwen/Qwen2.5-72B-Instruct',
  'Qwen/Qwen2.5-32B-Instruct',
  'Qwen/Qwen2.5-14B-Instruct',
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen3-Coder-30B-A3B-Instruct',
  'deepseek-ai/DeepSeek-V3.2',
  'deepseek-ai/DeepSeek-V3.1-Terminus',
  'deepseek-ai/DeepSeek-V3',
  'deepseek-ai/DeepSeek-V2.5',
  'deepseek-ai/DeepSeek-R1',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
  'moonshotai/Kimi-K2-Instruct-0905',
  'moonshotai/Kimi-Dev-72B',
  'zai-org/GLM-4.6',
  'zai-org/GLM-4.5',
  'zai-org/GLM-4.5-Air',
  'THUDM/GLM-4-32B-0414',
  'THUDM/GLM-4-9B-0414',
  'THUDM/glm-4-9b-chat',
  'THUDM/GLM-Z1-32B-0414',
  'THUDM/GLM-Z1-9B-0414',
  'THUDM/GLM-Z1-Rumination-32B-0414',
  'ByteDance-Seed/Seed-OSS-36B-Instruct',
  'tencent/Hunyuan-A13B-Instruct',
  'internlm/internlm2_5-7b-chat'
]

const normalizeWord = (word) =>
  word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[^a-z'-]+|[^a-z'-]+$/g, '')

const extractApiKey = (text) => {
  const matched = text.match(/\bsk-[A-Za-z0-9]+\b/)
  return matched ? matched[0] : ''
}

const extractModels = (text) => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.filter((line) => !line.startsWith('#') && line.includes('/'))
}

const parseJsonSafely = (raw) => {
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const parseJsonContent = (raw) => {
  const direct = parseJsonSafely(raw)
  if (direct) return direct

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const parsed = parseJsonSafely(fenced[1].trim())
    if (parsed) return parsed
  }

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return parseJsonSafely(raw.slice(firstBrace, lastBrace + 1))
  }
  return null
}

const uniquePreserveOrder = (arr) => {
  const seen = new Set()
  const out = []
  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item)
      out.push(item)
    }
  }
  return out
}

const candidateLemmas = (word) => {
  const normalized = normalizeWord(word)
  if (!normalized) return []
  return uniquePreserveOrder([
    lemmatizer.verb(normalized),
    lemmatizer.noun(normalized),
    lemmatizer.adjective(normalized),
    normalized
  ])
    .map((v) => normalizeWord(String(v || '')))
    .filter(Boolean)
}

const resolveLemmaAndRank = (word, rankMap) => {
  const candidates = candidateLemmas(word)
  if (candidates.length === 0) {
    return { lemma: '', rank: null }
  }
  for (const lemma of candidates) {
    if (rankMap.has(lemma)) {
      return { lemma, rank: rankMap.get(lemma) }
    }
  }
  return { lemma: candidates[0], rank: null }
}

const preprocessForReaderFlow = (text, rankMap, threshold) => {
  const seenLemma = new Set()
  const targetWords = []
  const tokenMeta = {}

  const annotatedText = text.replace(/[A-Za-z]+(?:[’'][A-Za-z]+)*/g, (token) => {
    const { lemma, rank } = resolveLemmaAndRank(token, rankMap)
    if (!lemma) return token

    if (!(lemma in tokenMeta)) {
      tokenMeta[lemma] = { rank, firstToken: token }
    }

    if (seenLemma.has(lemma)) {
      return token
    }

    seenLemma.add(lemma)
    const shouldAnnotate = rank === null || rank > threshold
    if (!shouldAnnotate) {
      return token
    }

    targetWords.push(lemma)
    return `[${token}]`
  })

  return {
    annotatedText,
    targetWords,
    tokenMeta
  }
}

const buildPrompt = ({ annotatedText, targetWords, threshold }) => `你要模拟阅读器翻译流程，严格按下面输入输出。

输入：
1) annotatedText（已经由本地预处理完成，禁止改动任何字符）：
${annotatedText}

2) targetWords（只能翻译这些词，全部是小写词元）：
${JSON.stringify(targetWords)}

规则（必须全部满足）：
1. 你只能翻译 targetWords 里的词，不能新增、删除、替换任何标注词。
2. 返回 JSON 的 sentence 必须与 annotatedText 逐字符完全一致（包括空格、标点、中括号）。
3. meaning 必须是对象，键集合必须与 targetWords 完全一致，且键保持小写。
4. 每个 meaning 的值都用自然中文，结合当前句子语境解释。
5. 不要输出 JSON 之外的任何内容。
6. 参考词频规则：rank <= ${threshold} 不翻译；rank > ${threshold} 或未收录才翻译（这里 targetWords 已经按该规则筛好）。

输出格式（严格）：
{
  "sentence": "必须与 annotatedText 完全一致",
  "meaning": {
    "word1": "中文释义",
    "word2": "中文释义"
  }
}`

const getSetDiff = (left, right) => left.filter((item) => !right.includes(item))

const qualityScoreForMeaning = (meaning, targetWords) => {
  if (targetWords.length === 0) {
    return { score: 10, reasons: [] }
  }

  let chineseCount = 0
  let lengthOkCount = 0
  const values = []
  const reasons = []

  for (const key of targetWords) {
    const value = String(meaning[key] ?? '').trim()
    values.push(value)
    if (/[\u4e00-\u9fff]/.test(value)) chineseCount += 1
    if (value.length >= 4 && value.length <= 80) lengthOkCount += 1
  }

  const uniqueRatio = new Set(values).size / targetWords.length
  const chineseRatio = chineseCount / targetWords.length
  const lenRatio = lengthOkCount / targetWords.length

  if (chineseRatio < 1) reasons.push('部分释义缺少中文')
  if (lenRatio < 1) reasons.push('部分释义长度异常')
  if (uniqueRatio < 0.7) reasons.push('释义重复度较高')

  let score = Math.round(chineseRatio * 5 + lenRatio * 3 + Math.min(1, uniqueRatio) * 2)
  score = Math.max(0, Math.min(10, score))
  return { score, reasons }
}

const estimateQualityScore = (rawOutput, parsed, context) => {
  const reasons = []
  let score = 0
  let parseStatus = 'OK'

  if (!rawOutput?.trim()) {
    return { score: 0, reasons: ['模型无输出'], parseStatus: 'EMPTY' }
  }
  score += 5

  if (!parsed) {
    return { score, reasons: ['非合法 JSON'], parseStatus: 'PARSE_FAIL' }
  }
  score += 20

  const sentence = parsed.sentence
  const meaning = parsed.meaning
  const { annotatedText, targetWords } = context

  if (typeof sentence === 'string') {
    score += 5
  } else {
    reasons.push('缺少 sentence 字段')
    parseStatus = 'RULE_FAIL'
  }

  if (meaning && typeof meaning === 'object' && !Array.isArray(meaning)) {
    score += 5
  } else {
    reasons.push('缺少 meaning 对象')
    parseStatus = 'RULE_FAIL'
  }

  if (typeof sentence === 'string') {
    if (sentence === annotatedText) {
      score += 25
    } else {
      reasons.push('sentence 与 annotatedText 不一致')
      parseStatus = 'RULE_FAIL'
    }
  }

  if (meaning && typeof meaning === 'object' && !Array.isArray(meaning)) {
    const keys = Object.keys(meaning)
    const lowerCaseOk = keys.every((k) => k === k.toLowerCase())
    if (lowerCaseOk) {
      score += 5
    } else {
      reasons.push('meaning 存在非小写键')
      parseStatus = 'RULE_FAIL'
    }

    const missing = getSetDiff(targetWords, keys)
    const extra = getSetDiff(keys, targetWords)
    if (missing.length === 0 && extra.length === 0) {
      score += 25
    } else {
      if (missing.length) reasons.push(`meaning 缺少键: ${missing.slice(0, 6).join(',')}`)
      if (extra.length) reasons.push(`meaning 多余键: ${extra.slice(0, 6).join(',')}`)
      parseStatus = 'RULE_FAIL'
    }

    const meaningQuality = qualityScoreForMeaning(meaning, targetWords)
    score += meaningQuality.score
    reasons.push(...meaningQuality.reasons)
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, parseStatus }
}

const sanitizeCell = (value) => {
  const str = String(value ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const colToName = (index) => {
  let n = index + 1
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

const buildSheetXml = (headers, rows) => {
  const allRows = [headers, ...rows]
  const rowXml = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          const ref = `${colToName(colIndex)}${rowIndex + 1}`
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${sanitizeCell(cell)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`
}

const makeCrcTable = () => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
}

const CRC_TABLE = makeCrcTable()

const crc32 = (buffer) => {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const uint16le = (n) => {
  const buf = Buffer.alloc(2)
  buf.writeUInt16LE(n, 0)
  return buf
}

const uint32le = (n) => {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(n >>> 0, 0)
  return buf
}

const buildStoredZip = (entries) => {
  const files = entries.map((entry) => ({
    name: entry.name,
    data: Buffer.from(entry.data, 'utf8')
  }))

  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8')
    const crc = crc32(file.data)
    const size = file.data.length

    const localHeader = Buffer.concat([
      uint32le(0x04034b50),
      uint16le(20),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint32le(crc),
      uint32le(size),
      uint32le(size),
      uint16le(nameBuf.length),
      uint16le(0),
      nameBuf
    ])
    localParts.push(localHeader, file.data)

    const centralHeader = Buffer.concat([
      uint32le(0x02014b50),
      uint16le(20),
      uint16le(20),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint32le(crc),
      uint32le(size),
      uint32le(size),
      uint16le(nameBuf.length),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint32le(0),
      uint32le(offset),
      nameBuf
    ])
    centralParts.push(centralHeader)
    offset += localHeader.length + size
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endOfCentralDirectory = Buffer.concat([
    uint32le(0x06054b50),
    uint16le(0),
    uint16le(0),
    uint16le(files.length),
    uint16le(files.length),
    uint32le(centralDirectory.length),
    uint32le(offset),
    uint16le(0)
  ])

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory])
}

const createXlsx = (rows) => {
  const headers = ['模型名称', '速度（秒）', '效果评分', '模型输出结果', '解析状态', '评分说明']
  const sheetXml = buildSheetXml(headers, rows)

  const entries = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="ModelEval" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: sheetXml
    }
  ]

  return buildStoredZip(entries)
}

const run = async () => {
  const inputText = readFileSync(INPUT_PATH, 'utf8')
  const apiKey = extractApiKey(inputText)
  if (!apiKey) {
    throw new Error('chooseAPI.md 中未找到 API Key')
  }

  const availableModels = extractModels(inputText)
  const selected = MODEL_ALLOWLIST.filter((name) => availableModels.includes(name))
  if (selected.length === 0) {
    throw new Error('当前 allowlist 未命中 chooseAPI.md 中的模型')
  }

  const cocaData = JSON.parse(readFileSync(COCA_PATH, 'utf8'))
  const rankMap = new Map()
  for (const [word, rank] of Object.entries(cocaData)) {
    const normalized = normalizeWord(word)
    if (!normalized) continue
    const numericRank = Number(rank)
    if (!Number.isFinite(numericRank)) continue
    rankMap.set(normalized, numericRank)
  }

  const preprocess = preprocessForReaderFlow(SAMPLE_TEXT, rankMap, VOCAB_THRESHOLD)
  const prompt = buildPrompt({
    annotatedText: preprocess.annotatedText,
    targetWords: preprocess.targetWords,
    threshold: VOCAB_THRESHOLD
  })

  const results = []

  for (const model of selected) {
    const payload = {
      model,
      messages: [
        { role: 'system', content: STRICT_JSON_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      stream: false,
      temperature: 0.2
    }

    const started = performance.now()
    let rawOutput = ''
    let parseStatus = 'OK'
    let score = 0
    let scoreReasons = ''

    try {
      console.log(`START ${model}`)
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 260)}`)
      }

      const json = await response.json()
      rawOutput = String(json?.choices?.[0]?.message?.content || '').trim()
      const parsed = parseJsonContent(rawOutput)
      const quality = estimateQualityScore(rawOutput, parsed, preprocess)
      score = quality.score
      parseStatus = quality.parseStatus
      scoreReasons = quality.reasons.join('; ')
    } catch (error) {
      rawOutput = String(error?.message || error)
      parseStatus = 'ERROR'
      score = 0
      scoreReasons = rawOutput.includes('aborted') || rawOutput.includes('timeout') ? '请求超时' : '请求失败'
    }

    const elapsed = ((performance.now() - started) / 1000).toFixed(2)

    results.push({
      model,
      speed: elapsed,
      score,
      output: rawOutput,
      status: parseStatus,
      reason: scoreReasons
    })

    console.log(`${model} -> ${elapsed}s, score=${score}, status=${parseStatus}`)
  }

  const sorted = [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return Number(a.speed) - Number(b.speed)
  })

  writeFileSync(
    OUTPUT_JSON_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        endpoint: ENDPOINT,
        threshold: VOCAB_THRESHOLD,
        selectedModels: selected,
        preprocessing: {
          annotatedText: preprocess.annotatedText,
          targetWords: preprocess.targetWords
        },
        results: sorted
      },
      null,
      2
    )
  )

  const rows = sorted.map((item) => [
    item.model,
    item.speed,
    String(item.score),
    item.output,
    item.status,
    item.reason
  ])
  writeFileSync(OUTPUT_XLSX_PATH, createXlsx(rows))

  console.log(`Wrote ${OUTPUT_JSON_PATH}`)
  console.log(`Wrote ${OUTPUT_XLSX_PATH}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
