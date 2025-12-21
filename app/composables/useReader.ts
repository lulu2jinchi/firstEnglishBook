import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import Dexie, { type Table } from 'dexie'

type ReadingMode = 'paginated' | 'scrolled-continuous'

type SentenceDefinitionResponse = {
  sentence?: string
  meaning?: Record<string, string>
}

type DefinitionRecord = {
  key: string
  bookKey: string
  paragraphId: string
  sentence: string
  meaning: Record<string, string>
  updatedAt: number
}

class ReaderDefinitionDB extends Dexie {
  definitions!: Table<DefinitionRecord, string>

  constructor() {
    super('reader-definition-cache')
    this.version(1).stores({
      definitions: 'key, bookKey, paragraphId, updatedAt'
    })
    this.definitions = this.table('definitions')
  }
}

let readerDefinitionDb: ReaderDefinitionDB | null = null

const ensureReaderDefinitionDb = () => {
  if (readerDefinitionDb) return readerDefinitionDb
  if (typeof window === 'undefined') return null
  readerDefinitionDb = new ReaderDefinitionDB()
  return readerDefinitionDb
}

const buildBookKey = (path: string) => {
  const fileName = path.split('/').pop() || 'book'
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const words = baseName.match(/[a-z0-9]+/gi) || []
  const initials = words.map((word) => word[0]).join('').slice(0, 8).toLowerCase()
  return initials || 'book'
}

export function useReader(viewerEl: Ref<HTMLElement | null>, bookPath: ComputedRef<string>) {
  const isLoading = ref(true)
  const currentLocation = ref('—')
  const progressText = ref('0%')
  const readingMode = ref<ReadingMode>('paginated')
  const isPaginated = computed(() => readingMode.value === 'paginated')
  const modeButtonText = computed(() => (isPaginated.value ? '切换为上下滚动' : '切换为左右翻页'))
  const locationsReady = ref(false)
  const encodedBookPath = computed(() => encodeURI(bookPath.value))
  const bookKey = computed(() => buildBookKey(bookPath.value))

  let book: any
  let rendition: any
  let ePubLib: any

  // 缓存父页面消息监听器，便于卸载时移除
  let visibleMessageHandler: ((event: MessageEvent) => void) | null = null
  const paragraphDefinitionStatus = new Set<string>()
  const paragraphDocumentMap = new Map<string, Document>()
  let documentParagraphIds = new WeakMap<Document, Set<string>>()
  let tooltipEl: HTMLDivElement | null = null
  let tooltipCleanup: (() => void) | null = null

  async function ensureLib() {
    if (ePubLib) return ePubLib
    const { default: ePub } = await import('epubjs')
    ePubLib = ePub
    return ePubLib
  }

  onMounted(async () => {
    await openBook()
  })

  onBeforeUnmount(() => {
    if (visibleMessageHandler) {
      window.removeEventListener('message', visibleMessageHandler)
    }
    rendition?.destroy?.()
    book?.destroy?.()
  })

  watch(encodedBookPath, async () => {
    isLoading.value = true
    await openBook()
    isLoading.value = false
  })

  async function openBook() {
    const ePub = await ensureLib()
    rendition?.destroy?.()
    book?.destroy?.()
    paragraphDefinitionStatus.clear()
    paragraphDocumentMap.clear()
    documentParagraphIds = new WeakMap<Document, Set<string>>()

    book = ePub(encodedBookPath.value)
    await book.ready
    await buildRendition(readingMode.value)
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

  function updateProgress(location: any) {
    const startCfi = location?.start?.cfi ?? rendition?.currentLocation()?.start?.cfi
    if (!startCfi || !book?.locations) {
      currentLocation.value = '—'
      progressText.value = '0%'
      return
    }

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
    await rendition.display(startCfi || undefined)
  }

  function applyTheme() {
    // 设置阅读背景为浅黄色，提升纸质阅读感。
    rendition.themes.default({
      html: { background: '#fff8dc' },
      body: { background: '#fff8dc', color: '#1f2937' }
    })
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

      const visibleMap = new Map<HTMLElement, { id: string; text: string; element: HTMLElement; visibleRatio: number }>()
      let lastPayloadKey = ''

      const scrollContainer: HTMLElement | null = win.frameElement?.closest('.epub-container') || null

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

      // 初始发送一次，确保父页面拿到首屏段落
      handleScrollOrResize()

      // 清理逻辑避免内存泄漏
      contents?.on?.('destroy', () => {
        win.removeEventListener('resize', handleScrollOrResize)
        scrollContainer?.removeEventListener('scroll', handleScrollOrResize)
        scrollContainer?.removeEventListener('resize', handleScrollOrResize as any)
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
        if (win.getVisibleParagraphs) delete win.getVisibleParagraphs
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

  const ensureTooltipElement = () => {
    const topWindow = getTopWindow()
    if (!topWindow) return null
    const topDoc = topWindow.document
    ensureTooltipStyles(topDoc)
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
    const response = await fetch('/api/querySentenceDefination', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`)
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
      const resp = await fetchParagraphDefinition(paragraphText)
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
    for (const paragraph of paragraphs.slice(0, 1)) {
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
    isPaginated,
    modeButtonText,
    toggleMode,
    goPrev,
    goNext
  }
}
