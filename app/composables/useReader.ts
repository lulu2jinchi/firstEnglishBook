import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

type ReadingMode = 'paginated' | 'scrolled-continuous'

export function useReader(viewerEl: Ref<HTMLElement | null>) {
  const isLoading = ref(true)
  const currentLocation = ref('—')
  const progressText = ref('0%')
  const readingMode = ref<ReadingMode>('paginated')
  const isPaginated = computed(() => readingMode.value === 'paginated')
  const modeButtonText = computed(() => (isPaginated.value ? '切换为上下滚动' : '切换为左右翻页'))
  const locationsReady = ref(false)

  let book: any
  let rendition: any

  const bookPath = encodeURI('/Normal People (Sally Rooney) (Z-Library).epub')

  onMounted(async () => {
    const { default: ePub } = await import('epubjs')

    book = ePub(bookPath)
    await book.ready
    await buildRendition(readingMode.value)
    await book.locations.generate(1600)
    locationsReady.value = true

    updateProgress(rendition.currentLocation())
    isLoading.value = false
  })

  onBeforeUnmount(() => {
    rendition?.destroy?.()
    book?.destroy?.()
  })

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
