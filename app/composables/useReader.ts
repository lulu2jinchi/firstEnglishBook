import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import Dexie, { type Table } from 'dexie'
import lemmatizer from 'wink-lemmatizer'
import {
  DEFAULT_READER_FONT_SIZE,
  DEFAULT_READER_LINE_HEIGHT
} from '~/constants/readerPreferences'

type ReadingMode = 'paginated' | 'scrolled-continuous'

type ReaderThemeConfig = {
  background: string
  text: string
}

type TocItem = {
  label?: string
  href?: string
  subitems?: TocItem[]
}

type SentenceDefinitionResponse = {
  sentence?: string
  meaning?: Record<string, string>
}

type ProperNounFilterMode = 'person_only' | 'all_proper_nouns'

type TokenInfo = {
  raw: string
  normalized: string
  start: number
  end: number
  isSentenceStart: boolean
  isTitleCase: boolean
  prevChar: string
  nextChar: string
}

type NameDetectionStats = Map<
  string,
  {
    titleCaseCount: number
    lowercaseCount: number
    nonSentenceStartTitleCaseCount: number
  }
>

type PreprocessedParagraph = {
  annotatedText: string
  targetWords: string[]
  threshold: number
}

type DefinitionCandidate = {
  paragraphId: string
  paragraphText: string
  sourceDoc: Document
  cacheKey: string
  bookKey: string
  preprocessed: PreprocessedParagraph
}

type DefinitionBatchResult = {
  candidate: DefinitionCandidate
  response: SentenceDefinitionResponse
}

type SentenceMarker = {
  rawWord: string
  meaningKey: string
}

type DefinitionRecord = {
  key: string
  bookKey: string
  paragraphId: string
  sentence: string
  meaning: Record<string, string>
  updatedAt: number
}

type LocationRecord = {
  bookKey: string
  cfi: string
  updatedAt: number
}

class ReaderDefinitionDB extends Dexie {
  definitions!: Table<DefinitionRecord, string>
  locations!: Table<LocationRecord, string>

  constructor() {
    super('reader-definition-cache')
    this.version(1).stores({
      definitions: 'key, bookKey, paragraphId, updatedAt'
    })
    this.version(2).stores({
      definitions: 'key, bookKey, paragraphId, updatedAt',
      locations: 'bookKey, updatedAt'
    })
    this.definitions = this.table('definitions')
    this.locations = this.table('locations')
  }
}

let readerDefinitionDb: ReaderDefinitionDB | null = null

const isEpubBlobUrl = (path: string) => /^blob:/i.test(path)
const vocabularyStorageKey = 'first-english-book-vocabulary-size'
const minVocabularySize = 1000
const maxVocabularySize = 20000
const fallbackVocabularySize = 6000
const properNounFilterMode: ProperNounFilterMode = 'person_only'
const nonNameWhitelist = new Set<string>([
  'i',
  'he',
  'she',
  'we',
  'you',
  'they',
  'it',
  'the',
  'a',
  'an',
  'this',
  'that',
  'these',
  'those',
  'and',
  'but',
  'or',
  'if',
  'when',
  'while',
  'do',
  'does',
  'did',
  'what',
  'where',
  'why',
  'how',
  'to',
  'in',
  'on',
  'at',
  'for',
  'from',
  'of',
  'with',
  'without',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'can',
  'could',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'not',
  'no',
  'yes',
  'oh',
  'ah',
  'english'
])
let cocaRankMapPromise: Promise<Map<string, number>> | null = null

const ensureReaderDefinitionDb = () => {
  if (readerDefinitionDb) return readerDefinitionDb
  if (typeof window === 'undefined') return null
  readerDefinitionDb = new ReaderDefinitionDB()
  return readerDefinitionDb
}

const readVocabularySizeFromStorage = (): number | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(vocabularyStorageKey)
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    const rounded = Math.round(parsed)
    if (rounded < minVocabularySize || rounded > maxVocabularySize) return null
    return rounded
  } catch {
    return null
  }
}

const normalizeWordKey = (word: string) =>
  word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[^a-z'-]+|[^a-z'-]+$/g, '')

const isContractionToken = (token: string) => /[A-Za-z][’'][A-Za-z]/.test(token)
const isAbbreviationSegment = (text: string, start: number, end: number, token: string) => {
  if (!/^[A-Za-z]+$/.test(token)) return false
  if (token.length !== 1) return false
  const prev = start > 0 ? text[start - 1] || '' : ''
  const next = end < text.length ? text[end] || '' : ''
  return prev === '.' || next === '.'
}
const isTitleCaseToken = (token: string) => {
  const normalized = token.replace(/’/g, "'")
  const parts = normalized.split("'")
  if (parts.length === 0) return false
  return parts.every((part, index) =>
    index === 0 ? /^[A-Z][a-z]+$/.test(part) : /^[A-Z]?[a-z]+$/.test(part)
  )
}

const isSentenceStartAt = (text: string, start: number) => {
  let cursor = start - 1
  while (cursor >= 0 && /[\s"'“”‘’([{]/.test(text[cursor] || '')) {
    cursor -= 1
  }
  if (cursor < 0) return true
  return /[.!?]/.test(text[cursor] || '')
}

const collectTokenInfos = (text: string) => {
  const tokenInfos: TokenInfo[] = []
  const tokenInfoByStart = new Map<number, TokenInfo>()
  const stats: NameDetectionStats = new Map()
  const regex = /[A-Za-z]+(?:[’'][A-Za-z]+)*/g
  let matched = regex.exec(text)

  while (matched) {
    const raw = matched[0]
    const start = matched.index
    const end = start + raw.length
    const normalized = normalizeWordKey(raw)
    if (!normalized) {
      matched = regex.exec(text)
      continue
    }

    const tokenInfo: TokenInfo = {
      raw,
      normalized,
      start,
      end,
      isSentenceStart: isSentenceStartAt(text, start),
      isTitleCase: isTitleCaseToken(raw),
      prevChar: start > 0 ? text[start - 1] || '' : '',
      nextChar: end < text.length ? text[end] || '' : ''
    }
    tokenInfos.push(tokenInfo)
    tokenInfoByStart.set(start, tokenInfo)

    let stat = stats.get(normalized)
    if (!stat) {
      stat = {
        titleCaseCount: 0,
        lowercaseCount: 0,
        nonSentenceStartTitleCaseCount: 0
      }
      stats.set(normalized, stat)
    }
    if (tokenInfo.isTitleCase) {
      stat.titleCaseCount += 1
      if (!tokenInfo.isSentenceStart) {
        stat.nonSentenceStartTitleCaseCount += 1
      }
    } else {
      stat.lowercaseCount += 1
    }

    matched = regex.exec(text)
  }

  return {
    tokenInfos,
    tokenInfoByStart,
    stats
  }
}

const isLikelyProperNounToken = (
  tokenInfo: TokenInfo,
  stats: NameDetectionStats,
  rank: number | null
) => {
  if (!tokenInfo.isTitleCase) return false
  if (nonNameWhitelist.has(tokenInfo.normalized)) return false

  const stat = stats.get(tokenInfo.normalized)
  const titleCaseCount = stat?.titleCaseCount || 0
  const lowercaseCount = stat?.lowercaseCount || 0
  const nonSentenceStartTitleCaseCount = stat?.nonSentenceStartTitleCaseCount || 0
  const hasStrongNameSignal = nonSentenceStartTitleCaseCount > 0 || titleCaseCount > 1
  const aggressiveUnknownTitle =
    lowercaseCount === 0 &&
    rank === null &&
    tokenInfo.normalized.length >= 3

  if (properNounFilterMode === 'all_proper_nouns') {
    return hasStrongNameSignal || aggressiveUnknownTitle || lowercaseCount === 0
  }

  return hasStrongNameSignal || aggressiveUnknownTitle
}

const normalizeVocabularyThreshold = (value: number | null) => {
  if (!Number.isFinite(value)) return fallbackVocabularySize
  const rounded = Math.round(Number(value))
  return Math.max(minVocabularySize, Math.min(maxVocabularySize, rounded))
}

const buildDefinitionConfigSignature = (threshold: number) =>
  `vocabulary-${threshold}:properNoun-${properNounFilterMode}`

const toSafeSegment = (value: string, fallback: string) => {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (safe || fallback).slice(0, 80)
}

const resolveSectionIdentity = (contents: any, doc: Document) => {
  const section = contents?.section || {}
  const numericIndex =
    Number.isFinite(Number(section?.index)) ? `spine-${Number(section.index)}` : ''
  const firstIdElement = doc.body?.querySelector<HTMLElement>('[id]')
  const firstId = firstIdElement?.id || ''

  const candidates = [
    section?.href,
    section?.canonical,
    section?.url,
    section?.idref,
    section?.id,
    numericIndex,
    firstId
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (!trimmed) continue
    return toSafeSegment(trimmed, 'chapter')
  }

  return 'chapter'
}

const loadCocaRankMap = async () => {
  if (!cocaRankMapPromise) {
    cocaRankMapPromise = fetch('/coca-20000.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`读取 COCA 词频失败: ${response.status}`)
        }
        return (await response.json()) as Record<string, number>
      })
      .then((parsed) => {
        const map = new Map<string, number>()
        for (const [word, rank] of Object.entries(parsed)) {
          const normalized = normalizeWordKey(word)
          if (!normalized || !Number.isFinite(rank)) continue
          map.set(normalized, Number(rank))
        }
        return map
      })
  }
  return cocaRankMapPromise
}

const getLemmaCandidates = (word: string) => {
  const forms: string[] = []
  const push = (value?: string | null) => {
    const normalized = normalizeWordKey(value || '')
    if (!normalized || forms.includes(normalized)) return
    forms.push(normalized)
  }

  const normalizedWord = normalizeWordKey(word)
  push(word)
  push(word.replace(/'/g, ''))
  push(word.replace(/-/g, ''))
  if (normalizedWord === 'an') {
    push('a')
  }

  try {
    push(lemmatizer.noun(word))
    push(lemmatizer.verb(word))
    push(lemmatizer.adjective(word))
  } catch {
    // ignore lemmatizer fallback
  }

  return forms
}

const lookupCocaRank = (word: string, rankMap: Map<string, number>) => {
  let minRank: number | null = null
  for (const form of getLemmaCandidates(word)) {
    const rank = rankMap.get(form)
    if (typeof rank !== 'number') continue
    minRank = minRank === null ? rank : Math.min(minRank, rank)
  }
  return minRank
}

const preprocessParagraphForDefinition = async (
  text: string,
  vocabularySize: number | null
): Promise<PreprocessedParagraph> => {
  const threshold = normalizeVocabularyThreshold(vocabularySize)
  const rankMap = await loadCocaRankMap()
  const markedWords = new Set<string>()
  const targetWords: string[] = []
  const { tokenInfoByStart, stats } = collectTokenInfos(text)

  const annotatedText = text.replace(/[A-Za-z]+(?:[’'][A-Za-z]+)*/g, (token, offset) => {
    const tokenStart = Number(offset)
    const tokenEnd = tokenStart + token.length
    if (isAbbreviationSegment(text, tokenStart, tokenEnd, token)) return token
    if (isContractionToken(token)) return token
    const tokenInfo = tokenInfoByStart.get(offset)
    if (!tokenInfo) return token
    const normalizedWord = normalizeWordKey(token)
    if (!normalizedWord) return token
    const rank = lookupCocaRank(normalizedWord, rankMap)
    if (isLikelyProperNounToken(tokenInfo, stats, rank)) {
      return token
    }
    const shouldTranslate = rank === null || rank > threshold
    if (!shouldTranslate || markedWords.has(normalizedWord)) {
      return token
    }
    markedWords.add(normalizedWord)
    targetWords.push(normalizedWord)
    return `[${token}]`
  })

  return {
    annotatedText,
    targetWords,
    threshold
  }
}

const buildBookKey = (path: string) => {
  const fileName = path.split('/').pop() || 'book'
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const words = baseName.match(/[a-z0-9]+/gi) || []
  const initials = words.map((word) => word[0]).join('').slice(0, 8).toLowerCase()
  return initials || 'book'
}

const loadSavedLocation = async (bookKey: string) => {
  const db = ensureReaderDefinitionDb()
  if (!db) return null
  try {
    const record = await db.locations.get(bookKey)
    return record?.cfi || null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('读取阅读位置失败', error)
    return null
  }
}

const saveReaderLocation = async (bookKey: string, cfi?: string | null) => {
  if (!cfi) return
  const db = ensureReaderDefinitionDb()
  if (!db) return
  try {
    await db.locations.put({
      bookKey,
      cfi,
      updatedAt: Date.now()
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('保存阅读位置失败', error)
  }
}

export function useReader(
  viewerEl: Ref<HTMLElement | null>,
  bookPath: ComputedRef<string | null>
) {
  const isLoading = ref(true)
  const currentLocation = ref('—')
  const progressText = ref('0%')
  const readingMode = ref<ReadingMode>('scrolled-continuous')
  const isPaginated = computed(() => readingMode.value === 'paginated')
  const modeButtonText = computed(() => (isPaginated.value ? '切换为上下滚动' : '切换为左右翻页'))
  const locationsReady = ref(false)
  const encodedBookPath = computed(() => (bookPath.value ? encodeURI(bookPath.value) : ''))
  const bookKey = computed(() => buildBookKey(bookPath.value || 'book'))

  let book: any
  let rendition: any
  let ePubLib: any

  // 缓存父页面消息监听器，便于卸载时移除
  let visibleMessageHandler: ((event: MessageEvent) => void) | null = null
  const paragraphDefinitionStatus = new Set<string>()
  const paragraphDocumentMap = new Map<string, Document>()
  const pendingDefinitionMap = new Map<string, SentenceDefinitionResponse>()
  let documentParagraphIds = new WeakMap<Document, Set<string>>()
  const tooltipDismissHandlers = new WeakMap<Document, (event: MouseEvent) => void>()
  let tooltipEl: HTMLDivElement | null = null
  let tooltipCleanup: (() => void) | null = null
  let tooltipPageLeaveHandler: (() => void) | null = null
  let tooltipVisibilityHandler: (() => void) | null = null
  let tooltipTopScrollHandler: (() => void) | null = null
  const definitionQueue: Array<() => Promise<void>> = []
  const shortParagraphMaxChars = 120
  const shortBatchMaxItems = 3
  const batchRetryMaxAttempts = 3
  const requestIntervalMs = 1000
  const batchParagraphSeparator = '\n\n<<<__PARA_SPLIT__>>>\n\n'
  const maxBackoffMs = 120000
  let queueRunning = false
  let nextAllowedAt = 0
  let backoffMs = 0
  const apiErrorMessage = ref('')
  const apiErrorVisible = ref(false)
  let apiErrorTimer: ReturnType<typeof setTimeout> | null = null
  const tocItems = ref<TocItem[]>([])
  const readerTheme = ref<ReaderThemeConfig>({
    background: '#fff8dc',
    text: '#1f2937'
  })
  const readerFontFamily = ref('"Georgia", "Times New Roman", serif')
  const readerFontSize = ref(DEFAULT_READER_FONT_SIZE)
  const readerLineHeight = ref(DEFAULT_READER_LINE_HEIGHT)

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const isRateLimitError = (status?: number, body?: string) => {
    if (status === 429) return true
    if (!body) return false
    const text = body.toLowerCase()
    return (
      text.includes('rpm limit exceeded') ||
      text.includes('rate limit') ||
      text.includes('too many requests') ||
      text.includes('identity verification')
    )
  }

  const bumpBackoff = (reason?: string) => {
    const next = backoffMs ? Math.min(backoffMs * 2, maxBackoffMs) : 15000
    backoffMs = next
    nextAllowedAt = Math.max(nextAllowedAt, Date.now() + backoffMs)
    // eslint-disable-next-line no-console
    console.warn('触发限速，暂停请求', { backoffMs, reason })
  }

  const resetBackoff = () => {
    backoffMs = 0
  }

  const clearApiError = () => {
    apiErrorVisible.value = false
    if (apiErrorTimer && typeof window !== 'undefined') {
      window.clearTimeout(apiErrorTimer)
    }
    apiErrorTimer = null
  }

  const showApiError = (message: string) => {
    apiErrorMessage.value = message
    apiErrorVisible.value = true
    if (apiErrorTimer && typeof window !== 'undefined') {
      window.clearTimeout(apiErrorTimer)
      apiErrorTimer = null
    }
    if (typeof window !== 'undefined') {
      apiErrorTimer = window.setTimeout(() => {
        apiErrorVisible.value = false
      }, 5000)
    }
  }

  const extractApiErrorReason = (body?: string) => {
    if (!body) return ''
    const trimmed = body.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<')) return ''
    try {
      const parsed = JSON.parse(trimmed) as
        | {
            statusMessage?: string
            message?: string
            error?: string
            detail?: string
            reason?: string
          }
        | string
      if (typeof parsed === 'string') return parsed
      if (parsed && typeof parsed === 'object') {
        return (
          parsed.statusMessage ||
          parsed.message ||
          parsed.error ||
          parsed.detail ||
          parsed.reason ||
          ''
        )
      }
      return ''
    } catch {
      return trimmed
    }
  }

  const sanitizeReason = (reason: string) => {
    const cleaned = reason.replace(/\s+/g, ' ').trim()
    if (!cleaned) return ''
    return cleaned.slice(0, 200)
  }

  const buildApiErrorMessage = (status?: number, body?: string) => {
    const reason = sanitizeReason(extractApiErrorReason(body))
    if (isRateLimitError(status, body)) {
      const remainingMs = Math.max(0, nextAllowedAt - Date.now())
      const seconds = Math.ceil(remainingMs / 1000)
      const base =
        seconds > 0 ? `接口请求过于频繁，已暂停 ${seconds} 秒` : '接口请求过于频繁，请稍后再试'
      return reason ? `${base}：${reason}` : base
    }
    if (status === 401 || status === 403) {
      return reason ? `接口鉴权失败：${reason}` : '接口鉴权失败，请联系管理员检查服务端模型配置'
    }
    if (status === 400) {
      return reason ? `接口参数错误：${reason}` : '接口参数错误，请检查当前配置'
    }
    if (reason) {
      return `接口请求失败：${reason}`
    }
    if (typeof status === 'number') {
      if (status >= 500) {
        return '接口服务异常，请稍后重试'
      }
      return `接口请求失败（${status}），请稍后重试`
    }
    return '接口连接失败，请检查网络或服务地址'
  }

  const runDefinitionQueue = async () => {
    if (queueRunning) return
    queueRunning = true
    while (definitionQueue.length > 0) {
      const job = definitionQueue.shift()
      if (!job) continue
      const waitMs = Math.max(0, nextAllowedAt - Date.now())
      if (waitMs > 0) {
        await sleep(waitMs)
      }
      const startedAt = Date.now()
      try {
        await job()
      } finally {
        nextAllowedAt = Math.max(nextAllowedAt, startedAt + requestIntervalMs)
      }
    }
    queueRunning = false
  }

  const enqueueDefinitionTask = (task: () => Promise<void>) =>
    new Promise<void>((resolve, reject) => {
      definitionQueue.push(async () => {
        try {
          await task()
          resolve()
        } catch (error) {
          reject(error)
        }
      })
      void runDefinitionQueue()
    })

  async function ensureLib() {
    if (ePubLib) return ePubLib
    const { default: ePub } = await import('epubjs')
    ePubLib = ePub
    return ePubLib
  }

  onMounted(async () => {
    attachTooltipPageLeaveHandlers()
    if (!encodedBookPath.value) {
      isLoading.value = false
      return
    }
    await openBook()
  })

  onBeforeUnmount(() => {
    if (visibleMessageHandler) {
      window.removeEventListener('message', visibleMessageHandler)
    }
    clearApiError()
    removeTooltipPageLeaveHandlers()
    hideTooltip()
    const topDoc = getTopWindow()?.document
    if (topDoc) {
      removeTooltipDismissHandler(topDoc)
    }
    rendition?.destroy?.()
    book?.destroy?.()
  })

  watch(encodedBookPath, async (nextPath) => {
    if (!nextPath) {
      isLoading.value = false
      return
    }
    isLoading.value = true
    await openBook()
    isLoading.value = false
  })

  async function openBook() {
    if (!encodedBookPath.value) {
      isLoading.value = false
      return
    }
    const ePub = await ensureLib()
    rendition?.destroy?.()
    book?.destroy?.()
    paragraphDefinitionStatus.clear()
    paragraphDocumentMap.clear()
    pendingDefinitionMap.clear()
    documentParagraphIds = new WeakMap<Document, Set<string>>()

    const openOptions =
      bookPath.value && isEpubBlobUrl(bookPath.value) ? { openAs: 'epub' } : undefined
    book = ePub(encodedBookPath.value, openOptions)
    await book.ready
    tocItems.value = []
    try {
      const navigation = await book.loaded.navigation
      tocItems.value = navigation?.toc || []
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('读取目录失败', error)
      tocItems.value = []
    }
    const savedCfi = await loadSavedLocation(bookKey.value)
    await buildRendition(readingMode.value, savedCfi)
    await book.locations.generate(1600)
    locationsReady.value = true

    updateProgress(rendition.currentLocation())
    isLoading.value = false
  }

  const toggleMode = async () => {
    if (!rendition) return
    const currentCfi = rendition.currentLocation()?.start?.cfi
    readingMode.value = isPaginated.value ? 'scrolled-continuous' : 'paginated'
    isLoading.value = true
    await buildRendition(readingMode.value, currentCfi)
    if (locationsReady.value) {
      updateProgress(rendition.currentLocation())
    }
    isLoading.value = false
  }

  const goPrev = () => {
    rendition?.prev()
  }

  const goNext = () => {
    rendition?.next()
  }

  const goToHref = async (href: string) => {
    if (!rendition || !href) return
    try {
      await rendition.display(href)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('跳转目录失败', error)
    }
  }

  function updateProgress(location: any) {
    const startCfi = location?.start?.cfi ?? rendition?.currentLocation()?.start?.cfi
    if (!startCfi || !book?.locations) {
      currentLocation.value = '—'
      progressText.value = '0%'
      return
    }
    console.log('当前阅读位置 CFI:', startCfi);
    void saveReaderLocation(bookKey.value, startCfi)

    const percent = book.locations.percentageFromCfi(startCfi) || 0
    const locationIndex = book.locations.locationFromCfi(startCfi)
    currentLocation.value = `第 ${locationIndex} / ${book.locations.total} 位置`
    progressText.value = `${Math.round(percent * 100)}%`
  }

  async function buildRendition(mode: ReadingMode, startCfi?: string | null) {
    rendition?.off?.('relocated', updateProgress)
    rendition?.destroy?.()

    const renderOptions: Record<string, any> = {
      width: '100%',
      height: '100%',
      flow: mode,
      allowScriptedContent: true
    }

    if (mode === 'paginated') {
      renderOptions.spread = 'none'
    } else {
      renderOptions.manager = 'continuous'
    }

    rendition = book.renderTo(viewerEl.value!, renderOptions)

    applyTheme()
    attachContentHooks()
    setupParentMessageHandler()
    rendition.on('relocated', updateProgress)
    if (startCfi) {
      try {
        console.log('尝试恢复到保存的阅读位置 CFI:', startCfi);
        await rendition.display(startCfi)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('恢复阅读位置失败，使用默认位置', error)
        await rendition.display()
      }
    } else {
      await rendition.display()
    }
  }

  function applyTheme() {
    if (!rendition) return
    const theme = readerTheme.value
    const fontFamily = readerFontFamily.value
    const fontSize = `${readerFontSize.value}px`
    const lineHeight = `${readerLineHeight.value}`
    rendition.themes.default({
      html: { background: theme.background, color: theme.text },
      body: {
        background: theme.background,
        color: theme.text,
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': lineHeight
      }
    })
    rendition.themes.register('reader-overrides', {
      body: {
        'font-family': `${fontFamily} !important`,
        'font-size': `${fontSize} !important`,
        'line-height': `${lineHeight} !important`
      },
      'body *': {
        'font-family': `${fontFamily} !important`,
        'font-size': `${fontSize} !important`,
        'line-height': `${lineHeight} !important`
      }
    })
    rendition.themes.select('reader-overrides')
  }

  const setReaderTheme = (theme: ReaderThemeConfig) => {
    readerTheme.value = theme
    applyTheme()
  }

  const setReaderFontFamily = (fontFamily: string) => {
    readerFontFamily.value = fontFamily
    applyTheme()
  }

  const setReaderFontSize = (fontSize: number) => {
    readerFontSize.value = fontSize
    applyTheme()
  }

  const setReaderLineHeight = (lineHeight: number) => {
    readerLineHeight.value = lineHeight
    applyTheme()
  }

  /**
   * 为每个章节内容文档打标段落，并在 iframe 内部追踪可见段落。
   * 通过 postMessage 将可见段落同步给父页面。
   */
  function attachContentHooks() {
    if (!rendition?.hooks?.content) return

    rendition.hooks.content.register((contents: any) => {
      const doc: Document | null = contents?.document || null
      const win: any = contents?.window
      if (!doc || !win) return

      const sectionIdentity = resolveSectionIdentity(contents, doc)
      const candidates = Array.from(doc.querySelectorAll('p, div')) as HTMLElement[]

      const blockTags = new Set([
        'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CANVAS', 'DIV', 'DL', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
        'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'NOSCRIPT', 'OL',
        'P', 'PRE', 'SECTION', 'TABLE', 'UL'
      ])

      const hasBlockChild = (el: HTMLElement) => {
        return Array.from(el.children).some((child) => blockTags.has(child.tagName))
      }

      const normalizeText = (text: string) => text.replace(/\u00a0/g, ' ').trim()

      const filteredParas = candidates.filter((el) => {
        // 只保留 <p>，或不含块级子元素且有文本的 <div>
        if (el.tagName === 'DIV' && hasBlockChild(el)) return false
        const text = normalizeText(el.textContent || '')
        if (!text) return false
        return true
      })

      filteredParas.forEach((el, index) => {
        el.classList.add('epub-paragraph')
        if (!el.dataset.paraId) {
          el.dataset.paraId = buildParagraphId(sectionIdentity, index + 1)
        }
        if (el.dataset.paraId) {
          trackParagraphDocument(el.dataset.paraId, doc)
        }
        el.dataset.paraIndex = String(index)
      })

      const getParagraphPayload = (paragraphEl: HTMLElement) => {
        const paragraphId = paragraphEl.dataset.paraId
        if (!paragraphId) return null
        const text = normalizeText(paragraphEl.innerText || paragraphEl.textContent || '')
        if (!text) return null
        return { id: paragraphId, text }
      }

      const handleDblClick = (event: MouseEvent) => {
        const target = event.target as Element | null
        if (!target) return
        const paragraphEl = target.closest<HTMLElement>('[data-para-id]')
        if (!paragraphEl) return
        const payload = getParagraphPayload(paragraphEl)
        if (!payload) return
        void handleVisibleParagraphs([payload], doc)
      }

      doc.addEventListener('dblclick', handleDblClick)

      const visibleMap = new Map<HTMLElement, { id: string; text: string; element: HTMLElement; visibleRatio: number }>()
      let lastPayloadKey = ''

      const scrollContainer: HTMLElement | null = win.frameElement?.closest('.epub-container') || null
      const wheelFallbackCooldownMs = 450
      let lastWheelFallbackAt = 0

      const handleWheelFallback = (event: WheelEvent) => {
        if (readingMode.value !== 'scrolled-continuous') return
        if (!scrollContainer) return
        if (scrollContainer.scrollHeight > scrollContainer.clientHeight + 1) return
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
        const now = Date.now()
        if (now - lastWheelFallbackAt < wheelFallbackCooldownMs) return
        lastWheelFallbackAt = now
        event.preventDefault()
        if (event.deltaY > 0) {
          rendition?.next()
        } else if (event.deltaY < 0) {
          rendition?.prev()
        }
      }

      const getViewportData = () => {
        if (!scrollContainer) {
          return {
            viewportTop: 0,
            viewportBottom: win.innerHeight,
            precedingHeight: 0
          }
        }

        const views = Array.from(scrollContainer.querySelectorAll<HTMLElement>('.epub-view'))
        const frameEl = win.frameElement as HTMLElement | null
        const viewEl = frameEl?.closest('.epub-view') as HTMLElement | null
        const viewIndex = viewEl ? views.indexOf(viewEl) : -1
        const precedingHeight = viewIndex > 0 ? views.slice(0, viewIndex).reduce((sum, v) => sum + v.getBoundingClientRect().height, 0) : 0

        return {
          viewportTop: scrollContainer.scrollTop,
          viewportBottom: scrollContainer.scrollTop + scrollContainer.clientHeight,
          precedingHeight
        }
      }

      const getVisibleParagraphs = () => {
        const { viewportTop, viewportBottom, precedingHeight } = getViewportData()
        return filteredParas
          .map((el) => {
            const rect = el.getBoundingClientRect()
            const globalTop = precedingHeight + rect.top
            const globalBottom = precedingHeight + rect.bottom
            const intersects = globalBottom >= viewportTop && globalTop <= viewportBottom
            if (!intersects) return null
            const visibleHeight = Math.min(globalBottom, viewportBottom) - Math.max(globalTop, viewportTop)
            const ratio = rect.height > 0 ? Math.max(0, Math.min(1, visibleHeight / rect.height)) : 0
            return {
              id: el.dataset.paraId || '',
              text: (el.innerText || '').trim(),
              element: el,
              visibleRatio: ratio
            }
          })
          .filter(Boolean) as Array<{ id: string; text: string; element: HTMLElement; visibleRatio: number }>
      }

      const postVisibleParagraphs = () => {
        const visibleParas = Array.from(visibleMap.values()).sort((a, b) => {
          return Number(a.element.dataset.paraIndex || 0) - Number(b.element.dataset.paraIndex || 0)
        })

        const payload = {
          type: 'epub-visible-paragraphs',
          chapterHref: sectionIdentity,
          paragraphs: visibleParas.map((item) => ({
            id: item.id,
            text: item.text,
            visibleRatio: Number(item.visibleRatio.toFixed(2))
          }))
        }

        const key = payload.paragraphs.map((p) => p.id).join('|')
        if (key === lastPayloadKey) return
        lastPayloadKey = key

        if (win.parent) {
          console.log('Posting visible paragraphs from iframe:', payload)
          win.parent.postMessage(payload, '*')
        }
      }

      // 暴露给 iframe 内的调试入口（使用父窗口视口计算可见性）
      win.getVisibleParagraphs = () => getVisibleParagraphs()

      let debounceTimer: ReturnType<typeof setTimeout> | null = null

      const runScrollOrResize = () => {
        hideTooltip()
        visibleMap.clear()
        getVisibleParagraphs().forEach((item) => visibleMap.set(item.element, item))
        postVisibleParagraphs()
      }

      const handleScrollOrResize = () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        debounceTimer = setTimeout(runScrollOrResize, 1000)
      }

      // 内外层滚动/resize 都要监听，外层负责实际滚动可见区域
      win.addEventListener('resize', handleScrollOrResize)
      scrollContainer?.addEventListener('scroll', handleScrollOrResize, { passive: true })
      // 视口尺寸变化同样影响可见性
      scrollContainer?.addEventListener('resize', handleScrollOrResize as any)
      doc.addEventListener('wheel', handleWheelFallback, { passive: false })

      // 初始发送一次，确保父页面拿到首屏段落
      handleScrollOrResize()

      // 清理逻辑避免内存泄漏
      contents?.on?.('destroy', () => {
        win.removeEventListener('resize', handleScrollOrResize)
        scrollContainer?.removeEventListener('scroll', handleScrollOrResize)
        scrollContainer?.removeEventListener('resize', handleScrollOrResize as any)
        doc.removeEventListener('dblclick', handleDblClick)
        doc.removeEventListener('wheel', handleWheelFallback)
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
        if (win.getVisibleParagraphs) delete win.getVisibleParagraphs
        removeTooltipDismissHandler(doc)
        removeDocumentParagraphs(doc)
        visibleMap.clear()
      })
    })
  }

  function buildParagraphId(sectionHref: string, index: number) {
    const safeSection = sectionHref
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return `para-${safeSection || 'chapter'}-${index}`
  }

  const escapeSelectorValue = (value: string) => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value)
    }
    return value.replace(/["\\]/g, '\\$&')
  }

  const parseAnnotatedSentence = (sentence: string) => {
    const markers: SentenceMarker[] = []
    const bracketWordPattern = /\[([A-Za-z]+(?:[’'][A-Za-z]+)*)\]/g
    let matched = bracketWordPattern.exec(sentence)

    while (matched) {
      const rawWord = matched[1] || ''
      const meaningKey = normalizeWordKey(rawWord)
      if (meaningKey) {
        markers.push({
          rawWord,
          meaningKey
        })
      }

      matched = bracketWordPattern.exec(sentence)
    }

    return { markers }
  }

  const applySentenceMarkersToParagraph = (paragraphEl: HTMLElement, sentence: string) => {
    const { markers } = parseAnnotatedSentence(sentence)
    if (markers.length === 0) {
      return {
        success: true,
        spanCount: 0
      }
    }

    const isWordChar = (char: string) => /[A-Za-z’']/.test(char)
    const normalizeApostrophe = (value: string) => value.replace(/’/g, "'")
    const isWordMatchAt = (text: string, start: number, rawWord: string) => {
      const target = normalizeApostrophe(rawWord).toLowerCase()
      const segment = normalizeApostrophe(text.slice(start, start + rawWord.length)).toLowerCase()
      if (segment !== target) return false
      const prev = start > 0 ? text[start - 1] || '' : ''
      const next = start + rawWord.length < text.length ? text[start + rawWord.length] || '' : ''
      return !isWordChar(prev) && !isWordChar(next)
    }
    const findWordMatchStart = (text: string, rawWord: string, fromIndex: number) => {
      const maxStart = text.length - rawWord.length
      for (let i = Math.max(0, fromIndex); i <= maxStart; i += 1) {
        if (isWordMatchAt(text, i, rawWord)) return i
      }
      return -1
    }
    const wrapMatchInTextNode = (textNode: Text, start: number, rawWord: string, meaningKey: string) => {
      const value = textNode.nodeValue || ''
      const matchText = value.slice(start, start + rawWord.length)
      if (!matchText) return null
      const before = value.slice(0, start)
      const after = value.slice(start + rawWord.length)
      const parent = textNode.parentNode
      if (!parent) return null
      const doc = textNode.ownerDocument
      const span = doc.createElement('span')
      span.dataset.meaningKey = meaningKey
      span.dataset.rawWord = rawWord
      span.textContent = matchText

      if (before) {
        parent.insertBefore(doc.createTextNode(before), textNode)
      }
      parent.insertBefore(span, textNode)
      let afterNode: Text | null = null
      if (after) {
        afterNode = doc.createTextNode(after)
        parent.insertBefore(afterNode, textNode)
      }
      parent.removeChild(textNode)
      return { span, afterNode }
    }
    const textNodes: Text[] = []
    const walker = paragraphEl.ownerDocument.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT)
    let currentNode = walker.nextNode()
    while (currentNode) {
      const textNode = currentNode as Text
      if (textNode.nodeValue) {
        textNodes.push(textNode)
      }
      currentNode = walker.nextNode()
    }

    let markerIndex = 0
    const insertedSpans: HTMLSpanElement[] = []

    for (const initialNode of textNodes) {
      let nodeCursor: Text | null = initialNode
      while (nodeCursor && markerIndex < markers.length) {
        const marker = markers[markerIndex]
        const value = nodeCursor.nodeValue || ''
        if (!value || marker.rawWord.length === 0) break

        const matchStart = findWordMatchStart(value, marker.rawWord, 0)
        if (matchStart === -1) break

        const wrapped = wrapMatchInTextNode(nodeCursor, matchStart, marker.rawWord, marker.meaningKey)
        if (!wrapped) {
          break
        }
        insertedSpans.push(wrapped.span)
        markerIndex += 1
        nodeCursor = wrapped.afterNode
      }
      if (markerIndex >= markers.length) break
    }

    if (markerIndex !== markers.length) {
      for (let i = insertedSpans.length - 1; i >= 0; i -= 1) {
        const span = insertedSpans[i]
        const parent = span.parentNode
        if (!parent) continue
        const textNode = span.ownerDocument.createTextNode(span.textContent || '')
        parent.replaceChild(textNode, span)
        parent.normalize()
      }
      return {
        success: false,
        spanCount: 0
      }
    }

    return {
      success: true,
      spanCount: insertedSpans.length
    }
  }

  const normalizeMeaningMap = (meaning: Record<string, string>) => {
    const normalized: Record<string, string> = {}
    for (const [rawKey, rawMeaning] of Object.entries(meaning)) {
      if (typeof rawMeaning !== 'string') continue
      const key = normalizeWordKey(rawKey)
      if (!key) continue
      normalized[key] = rawMeaning
    }
    return normalized
  }

  const isLegacyTaggedSentence = (sentence: string) => /<(\d+)>[\s\S]*?<\/\1>/.test(sentence)

  const getTopWindow = () => {
    if (typeof window === 'undefined') return null
    return window.top || window
  }

  const ensureTooltipStyles = (doc: Document) => {
    const styleId = 'reader-meaning-tooltip-styles'
    if (doc.getElementById(styleId)) return
    const styleEl = doc.createElement('style')
    styleEl.id = styleId
    styleEl.textContent = [
      '.reader-meaning-tooltip {',
      '  position: fixed;',
      '  z-index: 9999;',
      '  max-width: 280px;',
      '  padding: 8px 10px;',
      '  background: rgba(17, 24, 39, 0.95);',
      '  color: #f8fafc;',
      '  font-size: 13px;',
      '  line-height: 1.4;',
      '  border-radius: 8px;',
      '  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);',
      '  pointer-events: none;',
      '  opacity: 0;',
      '  transition: opacity 0.12s ease;',
      '}',
      '.reader-meaning-tooltip[data-show="true"] {',
      '  opacity: 1;',
      '}'
    ].join('\n')
    doc.head.appendChild(styleEl)
  }

  const attachTooltipDismissHandler = (doc: Document) => {
    if (tooltipDismissHandlers.has(doc)) return
    const handler = (event: MouseEvent) => {
      const target = event.target as Element | null
      const clickedMeaning = target?.closest?.('span[data-meaning-key]')
      if (!clickedMeaning) {
        hideTooltip()
      }
    }
    doc.addEventListener('click', handler)
    tooltipDismissHandlers.set(doc, handler)
  }

  const removeTooltipDismissHandler = (doc: Document) => {
    const handler = tooltipDismissHandlers.get(doc)
    if (!handler) return
    doc.removeEventListener('click', handler)
    tooltipDismissHandlers.delete(doc)
  }

  const ensureTooltipElement = () => {
    const topWindow = getTopWindow()
    if (!topWindow) return null
    const topDoc = topWindow.document
    ensureTooltipStyles(topDoc)
    attachTooltipDismissHandler(topDoc)
    if (!tooltipEl || tooltipEl.ownerDocument !== topDoc) {
      tooltipEl = topDoc.createElement('div')
      tooltipEl.className = 'reader-meaning-tooltip'
      tooltipEl.setAttribute('role', 'tooltip')
      tooltipEl.dataset.show = 'false'
      topDoc.body.appendChild(tooltipEl)
    }
    return tooltipEl
  }

  const getTooltipBoundary = () => {
    const topWindow = getTopWindow()
    const topDoc = topWindow?.document || null
    return topDoc?.querySelector<HTMLElement>('.reader-body') || null
  }

  const hideTooltip = () => {
    if (!tooltipEl) return
    tooltipEl.dataset.show = 'false'
    tooltipEl.textContent = ''
    if (tooltipCleanup) {
      tooltipCleanup()
      tooltipCleanup = null
    }
  }

  const attachTooltipPageLeaveHandlers = () => {
    if (tooltipPageLeaveHandler || typeof window === 'undefined') return
    tooltipPageLeaveHandler = () => hideTooltip()
    tooltipVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        hideTooltip()
      }
    }
    window.addEventListener('pagehide', tooltipPageLeaveHandler)
    window.addEventListener('beforeunload', tooltipPageLeaveHandler)
    document.addEventListener('visibilitychange', tooltipVisibilityHandler)

    const topWindow = getTopWindow()
    if (topWindow) {
      tooltipTopScrollHandler = () => hideTooltip()
      topWindow.addEventListener('scroll', tooltipTopScrollHandler, { passive: true, capture: true })
    }
  }

  const removeTooltipPageLeaveHandlers = () => {
    if (!tooltipPageLeaveHandler || typeof window === 'undefined') return
    window.removeEventListener('pagehide', tooltipPageLeaveHandler)
    window.removeEventListener('beforeunload', tooltipPageLeaveHandler)
    tooltipPageLeaveHandler = null
    if (tooltipVisibilityHandler) {
      document.removeEventListener('visibilitychange', tooltipVisibilityHandler)
      tooltipVisibilityHandler = null
    }
    const topWindow = getTopWindow()
    if (topWindow && tooltipTopScrollHandler) {
      topWindow.removeEventListener('scroll', tooltipTopScrollHandler, true)
      tooltipTopScrollHandler = null
    }
  }

  const buildVirtualReference = (span: HTMLElement, doc: Document) => {
    return {
      getBoundingClientRect: () => {
        const spanRect = span.getBoundingClientRect()
        const frameEl = doc.defaultView?.frameElement as HTMLElement | null
        const frameRect = frameEl?.getBoundingClientRect()
        const offsetLeft = frameRect ? frameRect.left : 0
        const offsetTop = frameRect ? frameRect.top : 0
        const left = spanRect.left + offsetLeft
        const top = spanRect.top + offsetTop
        const width = spanRect.width
        const height = spanRect.height
        return {
          x: left,
          y: top,
          left,
          top,
          right: left + width,
          bottom: top + height,
          width,
          height,
          toJSON: () => ({})
        } as DOMRect
      },
      getClientRects: () => [] as DOMRectList
    }
  }

  const showTooltipForSpan = async (span: HTMLElement, doc: Document, meaning: string) => {
    const tooltip = ensureTooltipElement()
    if (!tooltip) return
    tooltip.textContent = meaning
    tooltip.dataset.show = 'true'

    const boundary = getTooltipBoundary()
    const virtualReference = buildVirtualReference(span, doc)
    const updatePosition = async () => {
      const middleware = [
        offset(8),
        flip(boundary ? { boundary, padding: 8 } : undefined),
        shift(boundary ? { boundary, padding: 8 } : { padding: 8 }),
        ...(boundary
          ? [
              size({
                boundary,
                padding: 8,
                apply({ availableWidth, availableHeight, elements }) {
                  elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`
                  elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`
                }
              })
            ]
          : [])
      ]
      const { x, y } = await computePosition(virtualReference, tooltip, {
        placement: 'top',
        strategy: 'fixed',
        middleware
      })
      tooltip.style.left = `${Math.round(x)}px`
      tooltip.style.top = `${Math.round(y)}px`
    }

    if (tooltipCleanup) {
      tooltipCleanup()
      tooltipCleanup = null
    }
    await updatePosition()
    tooltipCleanup = autoUpdate(virtualReference, tooltip, updatePosition)
  }

  const applyDefinitionToParagraph = (doc: Document, paragraphId: string, resp: SentenceDefinitionResponse) => {
    if (!resp.sentence || !resp.meaning) {
      // eslint-disable-next-line no-console
      console.warn('段落释义缺少 sentence 或 meaning', { paragraphId, resp })
      return false
    }
    const selectorId = escapeSelectorValue(paragraphId)
    const paragraphEl = doc.querySelector<HTMLElement>(`[data-para-id="${selectorId}"]`)
    if (!paragraphEl) {
      // eslint-disable-next-line no-console
      console.warn('未找到段落元素', { paragraphId })
      return false
    }
    if (paragraphEl.dataset.annotated === 'true') {
      // eslint-disable-next-line no-console
      console.log('段落已标注，跳过', { paragraphId })
      return true
    }

    const meaningMap = normalizeMeaningMap(resp.meaning)
    attachTooltipDismissHandler(doc)
    const markerResult = applySentenceMarkersToParagraph(paragraphEl, resp.sentence)
    if (!markerResult.success) {
      // eslint-disable-next-line no-console
      console.warn('段落文本与 sentence 不匹配，跳过标注', { paragraphId })
      return false
    }

    paragraphEl.dataset.annotated = 'true'
    const spans = Array.from(paragraphEl.querySelectorAll<HTMLSpanElement>('span[data-meaning-key]'))
    spans.forEach((span) => {
      const meaningKey = normalizeWordKey(span.dataset.meaningKey || '')
      span.style.textDecoration = 'underline'
      span.style.cursor = 'pointer'
      span.addEventListener('click', () => {
        const meaning = meaningMap[meaningKey]
        if (meaning) {
          void showTooltipForSpan(span, doc, meaning)
        } else {
          hideTooltip()
        }
      })
    })

    return true
  }

  const getCandidateDocsForParagraph = (paragraphId: string, fallbackDoc?: Document | null) => {
    const docs: Document[] = []
    const mappedDoc = paragraphDocumentMap.get(paragraphId)
    if (mappedDoc) {
      docs.push(mappedDoc)
    }
    if (fallbackDoc && !docs.includes(fallbackDoc)) {
      docs.push(fallbackDoc)
    }
    return docs
  }

  const applyDefinitionToBestDoc = (
    paragraphId: string,
    resp: SentenceDefinitionResponse,
    fallbackDoc?: Document | null
  ) => {
    const docs = getCandidateDocsForParagraph(paragraphId, fallbackDoc)
    for (const doc of docs) {
      if (applyDefinitionToParagraph(doc, paragraphId, resp)) {
        pendingDefinitionMap.delete(paragraphId)
        return true
      }
    }
    pendingDefinitionMap.set(paragraphId, resp)
    return false
  }

  const requestSentenceDefinition = async (payload: {
    text: string
    annotatedText: string
    targetWords: string[]
    vocabularySize: number
  }) => {
    const response = await fetch('/api/querySentenceDefination', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let bodyText = ''
      try {
        bodyText = await response.text()
      } catch {
        bodyText = ''
      }
      const error = new Error(`API 请求失败: ${response.status}`)
      ;(error as Error & { status?: number }).status = response.status
      ;(error as Error & { body?: string }).body = bodyText
      throw error
    }

    return (await response.json()) as SentenceDefinitionResponse
  }

  const writeDefinitionCache = async (
    db: ReaderDefinitionDB | null,
    candidate: DefinitionCandidate,
    response: SentenceDefinitionResponse
  ) => {
    if (!db || !response.sentence || !response.meaning) return
    try {
      await db.definitions.put({
        key: candidate.cacheKey,
        bookKey: candidate.bookKey,
        paragraphId: candidate.paragraphId,
        sentence: response.sentence,
        meaning: response.meaning,
        updatedAt: Date.now()
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('写入 Dexie 缓存失败', error)
    }
  }

  const buildDefinitionBatches = (candidates: DefinitionCandidate[]) => {
    const batches: DefinitionCandidate[][] = []
    let shortBuffer: DefinitionCandidate[] = []

    const flushShortBuffer = () => {
      if (shortBuffer.length === 0) return
      batches.push(shortBuffer)
      shortBuffer = []
    }

    for (const candidate of candidates) {
      if (candidate.paragraphText.length <= shortParagraphMaxChars) {
        shortBuffer.push(candidate)
        if (shortBuffer.length >= shortBatchMaxItems) {
          flushShortBuffer()
        }
        continue
      }
      flushShortBuffer()
      batches.push([candidate])
    }

    flushShortBuffer()
    return batches
  }

  const fetchBatchDefinitions = async (batch: DefinitionCandidate[]) => {
    const mergedTargetWords: string[] = []
    const seenWords = new Set<string>()

    for (const candidate of batch) {
      for (const word of candidate.preprocessed.targetWords) {
        if (seenWords.has(word)) continue
        seenWords.add(word)
        mergedTargetWords.push(word)
      }
    }

    const payload = {
      text: batch.map((candidate) => candidate.paragraphText).join(batchParagraphSeparator),
      annotatedText: batch.map((candidate) => candidate.preprocessed.annotatedText).join(batchParagraphSeparator),
      targetWords: mergedTargetWords,
      vocabularySize: batch[0]?.preprocessed.threshold ?? fallbackVocabularySize
    }

    const batchResponse = await requestSentenceDefinition(payload)
    const normalizedMeaning = normalizeMeaningMap(batchResponse.meaning || {})
    const results: DefinitionBatchResult[] = []

    for (const candidate of batch) {
      const meaning: Record<string, string> = {}
      for (const word of candidate.preprocessed.targetWords) {
        const value = normalizedMeaning[word]
        if (!value) {
          throw new Error(`批量结果缺少单词释义: ${word}`)
        }
        meaning[word] = value
      }
      results.push({
        candidate,
        response: {
          sentence: candidate.preprocessed.annotatedText,
          meaning
        }
      })
    }

    return results
  }

  const processDefinitionBatch = async (batch: DefinitionCandidate[], db: ReaderDefinitionDB | null) => {
    let attempt = 0

    while (attempt < batchRetryMaxAttempts) {
      attempt += 1
      try {
        const results = await fetchBatchDefinitions(batch)
        for (const result of results) {
          await writeDefinitionCache(db, result.candidate, result.response)
          applyDefinitionToBestDoc(result.candidate.paragraphId, result.response, result.candidate.sourceDoc)
        }
        resetBackoff()
        clearApiError()
        return
      } catch (error) {
        const status = (error as Error & { status?: number }).status
        const body = (error as Error & { body?: string }).body
        if (isRateLimitError(status, body)) {
          bumpBackoff(body || String(error))
        }
        if (attempt >= batchRetryMaxAttempts) {
          throw error
        }
      }
    }
  }

  const prepareDefinitionCandidates = async (
    paragraphs: any[],
    fallbackDoc: Document | null | undefined,
    db: ReaderDefinitionDB | null
  ) => {
    const candidates: DefinitionCandidate[] = []
    const seenParagraphIds = new Set<string>()
    const currentBookKey = bookKey.value
    const thresholdForCache = normalizeVocabularyThreshold(readVocabularySizeFromStorage())
    const definitionConfigSignature = buildDefinitionConfigSignature(thresholdForCache)

    for (const paragraph of paragraphs) {
      const paragraphId = paragraph?.id
      const paragraphText = typeof paragraph?.text === 'string' ? paragraph.text.trim() : ''
      if (!paragraphId || !paragraphText) continue
      if (seenParagraphIds.has(paragraphId)) continue
      seenParagraphIds.add(paragraphId)
      if (paragraphDefinitionStatus.has(paragraphId)) continue

      const targetDoc = paragraphDocumentMap.get(paragraphId) || fallbackDoc
      if (!targetDoc) {
        // eslint-disable-next-line no-console
        console.warn('未找到段落对应的 iframe 文档', { paragraphId })
        continue
      }

      const cacheKey = `${currentBookKey}:${paragraphId}:${definitionConfigSignature}`
      if (db) {
        try {
          const cached = await db.definitions.get(cacheKey)
          if (cached?.sentence && cached?.meaning) {
            if (isLegacyTaggedSentence(cached.sentence)) {
              await db.definitions.delete(cacheKey)
            } else {
              applyDefinitionToBestDoc(paragraphId, cached, targetDoc)
              continue
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('读取 Dexie 缓存失败', error)
        }
      }

      const preprocessed = await preprocessParagraphForDefinition(paragraphText, thresholdForCache)
      if (preprocessed.targetWords.length === 0) {
        const response = {
          sentence: paragraphText,
          meaning: {}
        } satisfies SentenceDefinitionResponse
        const noWordCandidate: DefinitionCandidate = {
          paragraphId,
          paragraphText,
          sourceDoc: targetDoc,
          cacheKey,
          bookKey: currentBookKey,
          preprocessed
        }
        await writeDefinitionCache(db, noWordCandidate, response)
        applyDefinitionToBestDoc(paragraphId, response, targetDoc)
        continue
      }

      candidates.push({
        paragraphId,
        paragraphText,
        sourceDoc: targetDoc,
        cacheKey,
        bookKey: currentBookKey,
        preprocessed
      })
    }

    return candidates
  }

  const trackParagraphDocument = (paragraphId: string, doc: Document) => {
    paragraphDocumentMap.set(paragraphId, doc)
    let docParagraphs = documentParagraphIds.get(doc)
    if (!docParagraphs) {
      docParagraphs = new Set<string>()
      documentParagraphIds.set(doc, docParagraphs)
    }
    docParagraphs.add(paragraphId)

    const pendingDefinition = pendingDefinitionMap.get(paragraphId)
    if (pendingDefinition && applyDefinitionToParagraph(doc, paragraphId, pendingDefinition)) {
      pendingDefinitionMap.delete(paragraphId)
    }
  }

  const removeDocumentParagraphs = (doc: Document) => {
    const docParagraphs = documentParagraphIds.get(doc)
    if (!docParagraphs) return
    docParagraphs.forEach((paragraphId) => paragraphDocumentMap.delete(paragraphId))
    documentParagraphIds.delete(doc)
  }

  const handleVisibleParagraphs = async (paragraphs: any[], fallbackDoc?: Document | null) => {
    if (!Array.isArray(paragraphs)) return
    const db = ensureReaderDefinitionDb()
    const candidates = await prepareDefinitionCandidates(paragraphs, fallbackDoc, db)
    if (candidates.length === 0) return

    const batches = buildDefinitionBatches(candidates)
    for (const batch of batches) {
      const paragraphIds = batch.map((candidate) => candidate.paragraphId)
      paragraphIds.forEach((paragraphId) => paragraphDefinitionStatus.add(paragraphId))

      try {
        await enqueueDefinitionTask(async () => {
          await processDefinitionBatch(batch, db)
        })
      } catch (error) {
        const status = (error as Error & { status?: number }).status
        const body = (error as Error & { body?: string }).body
        showApiError(buildApiErrorMessage(status, body))
        // eslint-disable-next-line no-console
        console.warn('段落释义请求失败', error)
      } finally {
        paragraphIds.forEach((paragraphId) => paragraphDefinitionStatus.delete(paragraphId))
      }
    }
  }

  /**
   * 父页面监听来自 iframe 的可见段落消息，并打印/拼接文本。
   */
  function setupParentMessageHandler() {
    if (visibleMessageHandler) return

    visibleMessageHandler = (event: MessageEvent) => {
      const data = event?.data || {}
      if (data.type !== 'epub-visible-paragraphs') return
      const sourceWindow = event.source as Window | null
      const sourceDoc = sourceWindow?.document || null
      // 打印可见段落与拼接文本，方便后续传递给 AI
      // eslint-disable-next-line no-console
      console.log('可见段落列表', data.paragraphs)
      void handleVisibleParagraphs(data.paragraphs || [], sourceDoc)
      const combinedText = (data.paragraphs || [])
        .map((item: any) => item?.text || '')
        .filter((text: string) => text.trim())
        .join('\n---\n')
      if (combinedText) {
        // eslint-disable-next-line no-console
        console.log('用于发送给 AI 的拼接文本：', combinedText)
      }
    }

    window.addEventListener('message', visibleMessageHandler)
  }

  return {
    isLoading,
    currentLocation,
    progressText,
    apiErrorMessage,
    apiErrorVisible,
    isPaginated,
    modeButtonText,
    tocItems,
    setReaderTheme,
    setReaderFontFamily,
    setReaderFontSize,
    setReaderLineHeight,
    readerFontFamily,
    readerFontSize,
    readerLineHeight,
    toggleMode,
    goPrev,
    goNext,
    goToHref
  }
}
