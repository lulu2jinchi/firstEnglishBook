import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import Dexie, { type Table } from 'dexie'

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

type ModelConfig = {
  baseUrl: string
  apiKey: string
  model: string
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
const modelConfigStorageKey = 'first-english-book-model-config'
const vocabularyStorageKey = 'first-english-book-vocabulary-size'
const minVocabularySize = 1000
const maxVocabularySize = 20000

const ensureReaderDefinitionDb = () => {
  if (readerDefinitionDb) return readerDefinitionDb
  if (typeof window === 'undefined') return null
  readerDefinitionDb = new ReaderDefinitionDB()
  return readerDefinitionDb
}

const readModelConfigFromStorage = (): ModelConfig | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(modelConfigStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ModelConfig>
    const baseUrl = parsed.baseUrl?.trim() || ''
    const apiKey = parsed.apiKey?.trim() || ''
    const model = parsed.model?.trim() || ''
    if (!baseUrl || !apiKey || !model) return null
    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model
    }
  } catch {
    return null
  }
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
  let documentParagraphIds = new WeakMap<Document, Set<string>>()
  const tooltipDismissHandlers = new WeakMap<Document, (event: MouseEvent) => void>()
  let tooltipEl: HTMLDivElement | null = null
  let tooltipCleanup: (() => void) | null = null
  let tooltipPageLeaveHandler: (() => void) | null = null
  let tooltipVisibilityHandler: (() => void) | null = null
  let tooltipTopScrollHandler: (() => void) | null = null
  const definitionQueue: Array<() => Promise<void>> = []
  const requestIntervalMs = 2000
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
  const readerFontSize = ref(20)
  const readerLineHeight = ref(1.6)

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
      return reason ? `接口鉴权失败：${reason}` : '接口鉴权失败，请检查模型配置'
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
    const overrideCss = [
      `body, body * { font-family: ${fontFamily} !important; }`,
      `body, body * { font-size: ${fontSize} !important; }`,
      `body, body * { line-height: ${lineHeight} !important; }`
    ].join('\n')
    rendition.themes.registerCss('reader-overrides', overrideCss)
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

      const sectionHref: string = contents?.section?.href || 'chapter'
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
          el.dataset.paraId = buildParagraphId(sectionHref, index + 1)
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
        void handleParagraphDefinition(payload, doc)
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
          chapterHref: sectionHref,
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

  const buildSentenceHtml = (sentence: string) => {
    return sentence.replace(/<(\d+)>([\s\S]*?)<\/\1>/g, (_match, id, content) => {
      return `<span data-meaning-id="${id}">${content}</span>`
    })
  }

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
      const clickedMeaning = target?.closest?.('span[data-meaning-id]')
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
    console.log('selectorId', paragraphId)
    console.log('doc: ', doc)
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

    attachTooltipDismissHandler(doc)
    paragraphEl.innerHTML = buildSentenceHtml(resp.sentence)
    paragraphEl.dataset.annotated = 'true'

    const meaningMap = resp.meaning
    const spans = Array.from(paragraphEl.querySelectorAll<HTMLSpanElement>('span[data-meaning-id]'))
    // eslint-disable-next-line no-console
    console.log('应用段落标注完成', { paragraphId, spanCount: spans.length })
    spans.forEach((span) => {
      const meaningId = span.dataset.meaningId || ''
      span.style.textDecoration = 'underline'
      span.style.cursor = 'pointer'
      span.addEventListener('click', () => {
        const meaning = meaningMap[meaningId]
        // eslint-disable-next-line no-console
        console.log(meaning)
        if (meaning) {
          void showTooltipForSpan(span, doc, meaning)
        } else {
          hideTooltip()
        }
      })
    })

    return true
  }

  const fetchParagraphDefinition = async (text: string) => {
    const modelConfig = readModelConfigFromStorage()
    const vocabularySize = readVocabularySizeFromStorage()
    const payload = {
      text,
      ...(modelConfig || {}),
      ...(vocabularySize ? { vocabularySize } : {})
    }
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

  const handleParagraphDefinition = async (paragraph: any, sourceDoc: Document) => {
    const paragraphId = paragraph?.id
    const paragraphText = paragraph?.text
    if (!paragraphId || !paragraphText) return

    const db = ensureReaderDefinitionDb()
    const currentBookKey = bookKey.value
    const cacheKey = `${currentBookKey}:${paragraphId}`
    if (db) {
      try {
        const cached = await db.definitions.get(cacheKey)
        if (cached?.sentence && cached?.meaning) {
          applyDefinitionToParagraph(sourceDoc, paragraphId, cached)
          return
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('读取 Dexie 缓存失败', error)
      }
    }

    if (paragraphDefinitionStatus.has(paragraphId)) return
    paragraphDefinitionStatus.add(paragraphId)

    try {
      await enqueueDefinitionTask(async () => {
        try {
          const resp = await fetchParagraphDefinition(paragraphText)
          resetBackoff()
          clearApiError()
          if (!resp?.sentence || !resp?.meaning) {
            return
          }
          if (db) {
            try {
              await db.definitions.put({
                key: cacheKey,
                bookKey: currentBookKey,
                paragraphId,
                sentence: resp.sentence,
                meaning: resp.meaning,
                updatedAt: Date.now()
              })
            } catch (error) {
              // eslint-disable-next-line no-console
              console.warn('写入 Dexie 缓存失败', error)
            }
          }
          applyDefinitionToParagraph(sourceDoc, paragraphId, resp)
        } catch (error) {
          const status = (error as Error & { status?: number }).status
          const body = (error as Error & { body?: string }).body
          if (isRateLimitError(status, body)) {
            bumpBackoff(body || String(error))
          }
          throw error
        }
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      const status = (error as Error & { status?: number }).status
      const body = (error as Error & { body?: string }).body
      showApiError(buildApiErrorMessage(status, body))
      // eslint-disable-next-line no-console
      console.warn('段落释义请求失败', error)
    } finally {
      paragraphDefinitionStatus.delete(paragraphId)
    }
  }

  const trackParagraphDocument = (paragraphId: string, doc: Document) => {
    paragraphDocumentMap.set(paragraphId, doc)
    let docParagraphs = documentParagraphIds.get(doc)
    if (!docParagraphs) {
      docParagraphs = new Set<string>()
      documentParagraphIds.set(doc, docParagraphs)
    }
    docParagraphs.add(paragraphId)
  }

  const removeDocumentParagraphs = (doc: Document) => {
    const docParagraphs = documentParagraphIds.get(doc)
    if (!docParagraphs) return
    docParagraphs.forEach((paragraphId) => paragraphDocumentMap.delete(paragraphId))
    documentParagraphIds.delete(doc)
  }

  const handleVisibleParagraphs = async (paragraphs: any[], fallbackDoc?: Document | null) => {
    if (!Array.isArray(paragraphs)) return
    for (const paragraph of paragraphs) {
      const paragraphId = paragraph?.id
      const targetDoc = paragraphId ? paragraphDocumentMap.get(paragraphId) || fallbackDoc : fallbackDoc
      if (!targetDoc) {
        // eslint-disable-next-line no-console
        console.warn('未找到段落对应的 iframe 文档', { paragraphId })
        continue
      }
      await handleParagraphDefinition(paragraph, targetDoc)
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
