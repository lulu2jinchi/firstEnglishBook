import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'

type ReadingMode = 'paginated' | 'scrolled-continuous'

export function useReader(viewerEl: Ref<HTMLElement | null>, bookPath: ComputedRef<string>) {
  const isLoading = ref(true)
  const currentLocation = ref('—')
  const progressText = ref('0%')
  const readingMode = ref<ReadingMode>('paginated')
  const isPaginated = computed(() => readingMode.value === 'paginated')
  const modeButtonText = computed(() => (isPaginated.value ? '切换为上下滚动' : '切换为左右翻页'))
  const locationsReady = ref(false)
  const encodedBookPath = computed(() => encodeURI(bookPath.value))

  let book: any
  let rendition: any
  let ePubLib: any

  // 缓存父页面消息监听器，便于卸载时移除
  let visibleMessageHandler: ((event: MessageEvent) => void) | null = null

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
      flow: mode
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

  /**
   * 父页面监听来自 iframe 的可见段落消息，并打印/拼接文本。
   */
  function setupParentMessageHandler() {
    if (visibleMessageHandler) return

    visibleMessageHandler = (event: MessageEvent) => {
      const data = event?.data || {}
      if (data.type !== 'epub-visible-paragraphs') return
      // 打印可见段落与拼接文本，方便后续传递给 AI
      // eslint-disable-next-line no-console
      console.log('可见段落列表', data.paragraphs)
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
