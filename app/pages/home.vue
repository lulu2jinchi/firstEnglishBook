<template>
  <div class="home-page">
    <div class="toolbar">
      <label class="search-bar" aria-label="搜索书籍">
        <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
        <input v-model="searchQuery" type="search" placeholder="Search" />
      </label>
      <button class="edit-toggle" type="button" @click="handleEditToggle">
        {{ editMode ? '完成' : '编辑' }}
      </button>
    </div>

    <div v-if="editMode" class="edit-panel">
      <p class="edit-count">已选 {{ selectedCount }} 本</p>
      <div class="edit-actions">
        <button class="edit-action-btn" type="button" @click="toggleSelectAll">
          {{ isAllSelected ? '取消全选' : '全选' }}
        </button>
        <button
          class="edit-action-btn edit-action-btn--danger"
          type="button"
          :disabled="selectedCount === 0"
          @click="removeSelectedBooks"
        >
          移出书架
        </button>
      </div>
    </div>

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      accept=".epub,application/epub+zip"
      @change="handleUpload"
    />

    <div class="grid">
      <div
        v-for="book in filteredBooks"
        :key="book.file"
        class="card"
        :class="{
          'card--uploading': book.isUploading,
          'card--editing': editMode && !book.isUploading,
          'card--selected': editMode && isBookSelected(book)
        }"
        :role="book.isUploading ? 'presentation' : editMode ? 'checkbox' : 'button'"
        :aria-checked="book.isUploading || !editMode ? undefined : String(isBookSelected(book))"
        :aria-disabled="book.isUploading ? 'true' : 'false'"
        :tabindex="book.isUploading ? -1 : 0"
        @pointerdown="handleBookPointerDown(book, $event)"
        @pointermove="handleBookPointerMove($event)"
        @pointerup="clearBookLongPress"
        @pointerleave="clearBookLongPress"
        @pointercancel="clearBookLongPress"
        @click="handleBookClick(book)"
      >
        <div class="cover">
          <div
            v-if="editMode && !book.isUploading"
            class="selection-badge"
            :class="{ 'selection-badge--active': isBookSelected(book) }"
            aria-hidden="true"
          >
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </div>
          <div v-if="book.isUploading" class="cover-upload" aria-hidden="true">
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
            <span>上传中</span>
          </div>
          <img v-else-if="book.cover" :src="book.cover" :alt="book.title" loading="lazy" />
          <div v-else class="cover-placeholder" aria-hidden="true">{{ book.title }}</div>
        </div>
        <p class="title line-clamp-2">{{ book.title }}</p>
        <p v-if="book.isUploading" class="upload-percent">{{ uploadLabel }}</p>
      </div>
    </div>

    <BottomTabBar active="home" @home="goHome" @add="triggerUpload" @user="goUser" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '#imports'
import Dexie, { type Table } from 'dexie'
import BottomTabBar from '~/components/BottomTabBar.vue'

type RawBook = {
  file: string
  source: 'base' | 'upload'
  title?: string
  id?: number
}

type BookItem = {
  file: string
  source: 'base' | 'upload'
  title: string
  cover: string | null
  isUploading?: boolean
  id?: number
}

type UploadRecord = {
  id?: number
  title: string
  blob: Blob
  createdAt: number
}

class UploadBookDB extends Dexie {
  uploads!: Table<UploadRecord, number>

  constructor() {
    super('home-uploaded-books')
    this.version(1).stores({
      uploads: '++id, createdAt'
    })
    this.uploads = this.table('uploads')
  }
}

let uploadBookDb: UploadBookDB | null = null

const ensureUploadBookDb = () => {
  if (uploadBookDb) return uploadBookDb
  if (typeof window === 'undefined') return null
  uploadBookDb = new UploadBookDB()
  return uploadBookDb
}

const router = useRouter()
const searchQuery = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const coverStates = ref<Record<string, string | null>>({})
const loadingCovers = new Set<string>()
const hiddenBaseBookStorageKey = 'first-english-book-hidden-base-books'
const hiddenBaseBooks = ref<Set<string>>(new Set())
const editMode = ref(false)
const selectedBookKeys = ref<Set<string>>(new Set())
const suppressClickBookKey = ref<string | null>(null)

const longPressDelayMs = 450
const longPressMoveTolerance = 12
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressStartX = 0
let longPressStartY = 0

const baseBooks: RawBook[] = [
  { source: 'base', file: 'book/Hold Me Tight Seven Conversations For A Lifetime Of Love (Dr. Sue Johnson) (Z-Library).epub' },
  { source: 'base', file: 'book/Normal People (Sally Rooney) (Z-Library).epub' },
  { source: 'base', file: 'book/The happiness hypothesis putting ancient wisdom and -- Jonathan Haidt -- ( WeLib.org ).epub' },
  { source: 'base', file: 'book/oz.epub' },
  { source: 'base', file: 'book/rose.epub' }
]

const uploadedBooks = ref<RawBook[]>([])
const activeBookUrls = new Set<string>()

const visibleBaseBooks = computed<RawBook[]>(() =>
  baseBooks.filter((book) => !hiddenBaseBooks.value.has(book.file))
)

const rawBooks = computed<RawBook[]>(() => [...uploadedBooks.value, ...visibleBaseBooks.value])

const books = computed<BookItem[]>(() =>
  rawBooks.value.map((book) => {
    const name = book.file.split('/').pop() || book.file
    const derivedTitle = name.replace(/\.epub$/i, '').trim()
    const title = book.title?.trim() || derivedTitle || '未命名书籍'
    return {
      file: book.file,
      source: book.source,
      title,
      cover: coverStates.value[book.file] ?? null,
      id: book.id
    }
  })
)

const getBookSelectionKey = (book: Pick<BookItem, 'source' | 'file' | 'id'>) => {
  if (book.source === 'upload' && typeof book.id === 'number') {
    return `upload:${book.id}`
  }
  return `${book.source}:${book.file}`
}

const selectableBooks = computed(() => books.value.filter((book) => !book.isUploading))
const selectedCount = computed(() => selectedBookKeys.value.size)
const isAllSelected = computed(
  () => selectableBooks.value.length > 0 && selectedCount.value === selectableBooks.value.length
)

const filteredBooks = computed(() => {
  const list = books.value
  if (!searchQuery.value.trim()) {
    return uploadCard.value ? [uploadCard.value, ...list] : list
  }
  const query = searchQuery.value.toLowerCase()
  const filtered = list.filter(book => book.title.toLowerCase().includes(query))
  return uploadCard.value ? [uploadCard.value, ...filtered] : filtered
})

const goRead = (book: BookItem) => {
  if (book.source === 'upload' && typeof book.id === 'number') {
    router.push({ path: '/reader', query: { uploadId: String(book.id) } })
    return
  }
  router.push({ path: '/reader', query: { book: book.file } })
}

const isBookSelected = (book: BookItem) => {
  const key = getBookSelectionKey(book)
  return selectedBookKeys.value.has(key)
}

const toggleBookSelection = (book: BookItem) => {
  if (book.isUploading) return
  const key = getBookSelectionKey(book)
  const next = new Set(selectedBookKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  selectedBookKeys.value = next
}

const enterEditModeWithBook = (book?: BookItem) => {
  editMode.value = true
  if (!book || book.isUploading) return
  const next = new Set(selectedBookKeys.value)
  next.add(getBookSelectionKey(book))
  selectedBookKeys.value = next
}

const exitEditMode = () => {
  editMode.value = false
  selectedBookKeys.value = new Set()
}

const handleEditToggle = () => {
  if (editMode.value) {
    exitEditMode()
    return
  }
  editMode.value = true
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedBookKeys.value = new Set()
    return
  }
  selectedBookKeys.value = new Set(
    selectableBooks.value.map((book) => getBookSelectionKey(book))
  )
}

const clearBookLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const handleBookPointerDown = (book: BookItem, event: PointerEvent) => {
  if (editMode.value || book.isUploading) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  clearBookLongPress()
  longPressStartX = event.clientX
  longPressStartY = event.clientY
  const selectionKey = getBookSelectionKey(book)
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    suppressClickBookKey.value = selectionKey
    enterEditModeWithBook(book)
  }, longPressDelayMs)
}

const handleBookPointerMove = (event: PointerEvent) => {
  if (!longPressTimer) return
  const movedX = Math.abs(event.clientX - longPressStartX)
  const movedY = Math.abs(event.clientY - longPressStartY)
  if (movedX > longPressMoveTolerance || movedY > longPressMoveTolerance) {
    clearBookLongPress()
  }
}

const handleBookClick = (book: BookItem) => {
  if (book.isUploading) return
  const key = getBookSelectionKey(book)
  if (suppressClickBookKey.value === key) {
    suppressClickBookKey.value = null
    return
  }
  if (editMode.value) {
    toggleBookSelection(book)
    return
  }
  goRead(book)
}

const goUser = () => {
  router.push('/user')
}

const goHome = () => {
  router.push('/home')
}

const readHiddenBaseBooks = () => {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const raw = window.localStorage.getItem(hiddenBaseBookStorageKey)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()
    const files = parsed.filter((item): item is string => typeof item === 'string')
    return new Set(files)
  } catch {
    return new Set<string>()
  }
}

const persistHiddenBaseBooks = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      hiddenBaseBookStorageKey,
      JSON.stringify(Array.from(hiddenBaseBooks.value))
    )
  } catch {
    // ignore storage error
  }
}

const removeCoverState = (file: string) => {
  if (!(file in coverStates.value)) return
  const next = { ...coverStates.value }
  delete next[file]
  coverStates.value = next
}

const removeSelectedBooks = async () => {
  if (selectedCount.value === 0) return
  const selectedKeys = new Set(selectedBookKeys.value)
  const selectedBooks = books.value.filter((book) => selectedKeys.has(getBookSelectionKey(book)))
  if (selectedBooks.length === 0) return

  const shouldRemove = window.confirm(`确认将选中的 ${selectedBooks.length} 本书移出书架吗？`)
  if (!shouldRemove) return

  const uploadedSelection = selectedBooks.filter((book) => book.source === 'upload')
  const baseSelection = selectedBooks.filter((book) => book.source === 'base')

  const uploadIds = uploadedSelection
    .map((book) => book.id)
    .filter((id): id is number => typeof id === 'number')
  if (uploadIds.length > 0) {
    const db = ensureUploadBookDb()
    if (db) {
      try {
        await db.uploads.bulkDelete(uploadIds)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('批量删除上传书籍失败', error)
      }
    }
  }

  if (uploadedSelection.length > 0) {
    const filesToRemove = new Set(uploadedSelection.map((book) => book.file))
    uploadedBooks.value = uploadedBooks.value.filter((book) => !filesToRemove.has(book.file))
    filesToRemove.forEach((file) => {
      if (activeBookUrls.has(file)) {
        URL.revokeObjectURL(file)
        activeBookUrls.delete(file)
      }
      loadingCovers.delete(file)
      removeCoverState(file)
    })
  }

  if (baseSelection.length > 0) {
    const nextHidden = new Set(hiddenBaseBooks.value)
    baseSelection.forEach((book) => {
      nextHidden.add(book.file)
      loadingCovers.delete(book.file)
      removeCoverState(book.file)
    })
    hiddenBaseBooks.value = nextHidden
    persistHiddenBaseBooks()
  }

  exitEditMode()
}

const isEpubBlobUrl = (path: string) => /^blob:/i.test(path)

const fetchCover = async (file: string) => {
  const { default: ePub } = await import('epubjs')
  const options = isEpubBlobUrl(file) ? { openAs: 'epub' } : undefined
  const book = ePub(encodeURI(file), options)
  try {
    await book.ready
    const coverUrl = await book.coverUrl()
    return coverUrl || null
  } catch {
    return null
  } finally {
    book.destroy?.()
  }
}

const loadCoverForBook = async (file: string) => {
  if (loadingCovers.has(file) || coverStates.value[file] !== undefined) return
  loadingCovers.add(file)
  try {
    coverStates.value[file] = await fetchCover(file)
  } finally {
    loadingCovers.delete(file)
  }
}

watch(
  rawBooks,
  (list) => {
    list.forEach((book) => {
      void loadCoverForBook(book.file)
    })
  },
  { deep: true, immediate: true }
)

const revokeActiveBookUrls = () => {
  activeBookUrls.forEach((url) => {
    URL.revokeObjectURL(url)
  })
  activeBookUrls.clear()
}

const loadUploadedBooks = async () => {
  const db = ensureUploadBookDb()
  if (!db) return
  try {
    const records = await db.uploads.orderBy('createdAt').reverse().toArray()
    revokeActiveBookUrls()
    uploadedBooks.value = records.map((record) => {
      const url = URL.createObjectURL(record.blob)
      activeBookUrls.add(url)
      return {
        source: 'upload',
        id: record.id,
        file: url,
        title: record.title
      }
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('读取上传书籍失败', error)
  }
}

onMounted(() => {
  hiddenBaseBooks.value = readHiddenBaseBooks()
  void loadUploadedBooks()
})

onBeforeUnmount(() => {
  clearBookLongPress()
  revokeActiveBookUrls()
})

type UploadStatus = 'idle' | 'reading' | 'success' | 'error'

const uploadStatus = ref<UploadStatus>('idle')
const uploadProgress = ref(0)
const uploadingBookId = ref<string | null>(null)
const uploadingBookTitle = ref('')

const isUploading = computed(() => uploadStatus.value === 'reading')
const showUploadCard = computed(() => uploadStatus.value === 'reading' || uploadStatus.value === 'error')
const uploadLabel = computed(() => {
  if (uploadStatus.value === 'error') return '读取失败'
  return `${uploadProgress.value}%`
})
const uploadCard = computed<BookItem | null>(() => {
  if (!showUploadCard.value) return null
  return {
    source: 'upload',
    file: uploadingBookId.value || 'uploading',
    title: uploadingBookTitle.value || '上传中',
    cover: null,
    isUploading: true
  }
})

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const isEpub =
    file.name.toLowerCase().endsWith('.epub') || file.type === 'application/epub+zip'
  if (!isEpub) {
    uploadStatus.value = 'error'
    uploadProgress.value = 0
    uploadingBookId.value = `uploading-${Date.now()}`
    uploadingBookTitle.value = file.name.replace(/\.epub$/i, '').trim() || '未命名书籍'
    return
  }

  const fileName = file.name
  uploadingBookId.value = `uploading-${Date.now()}`
  uploadingBookTitle.value = fileName.replace(/\.epub$/i, '').trim() || '未命名书籍'
  uploadStatus.value = 'reading'
  uploadProgress.value = 0

  const reader = new FileReader()

  reader.onprogress = (progressEvent) => {
    if (!progressEvent.lengthComputable) return
    const percent = Math.min(
      100,
      Math.max(0, Math.round((progressEvent.loaded / progressEvent.total) * 100))
    )
    uploadProgress.value = percent
  }

  reader.onerror = () => {
    uploadStatus.value = 'error'
    uploadProgress.value = 0
  }

  reader.onload = async () => {
    const objectUrl = URL.createObjectURL(file)
    const title = fileName.replace(/\.epub$/i, '').trim() || '未命名书籍'
    activeBookUrls.add(objectUrl)

    const db = ensureUploadBookDb()
    let recordId: number | null = null
    if (db) {
      try {
        recordId = await db.uploads.add({
          title,
          blob: file,
          createdAt: Date.now()
        })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('保存上传书籍失败', error)
      }
    }

    uploadedBooks.value = [
      { source: 'upload', id: recordId ?? undefined, file: objectUrl, title },
      ...uploadedBooks.value
    ]
    uploadProgress.value = 100
    uploadStatus.value = 'success'
    uploadingBookId.value = null
    uploadingBookTitle.value = ''
  }

  reader.readAsArrayBuffer(file)
}

useHead({
  title: 'Home · First English Book',
  bodyAttrs: {
    class: 'body--home'
  }
})
</script>

<style scoped>
:global(body.body--home) {
  margin: 0;
  background: #ffffff;
  color: #1d1b20;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

.home-page {
  min-height: 100dvh;
  box-sizing: border-box;
  background: #ffffff;
  padding: 12px 16px calc(120px + env(safe-area-inset-bottom, 0px));
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.status-time {
  height: 21px;
  width: 54px;
  object-fit: contain;
}

.status-icons {
  width: 67px;
  height: 12px;
  object-fit: contain;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 8px 12px;
  box-sizing: border-box;
}

.search-icon {
  font-size: 20px;
  color: #6f6f6f;
}

.search-bar input {
  border: none;
  background: transparent;
  outline: none;
  width: 100%;
  height: 100%;
  font-size: 16px;
  line-height: 24px;
  color: #1d1b20;
}

.search-bar input::placeholder {
  color: #828282;
}

.edit-toggle {
  height: 44px;
  border: none;
  border-radius: 8px;
  padding: 0 14px;
  background: #1d1b20;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.edit-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.edit-count {
  margin: 0;
  font-size: 13px;
  color: #4c4c4c;
}

.edit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-action-btn {
  border: 1px solid #d8d8d8;
  background: #ffffff;
  color: #222222;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.edit-action-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.edit-action-btn--danger {
  border-color: #ffbeb8;
  background: #fff0ee;
  color: #c23d2f;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}

.card--uploading {
  cursor: default;
}

.card--editing .cover {
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
}

.card--selected .cover {
  box-shadow: inset 0 0 0 2px #2f8bff;
}

.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 157 / 206;
  border-radius: 8px;
  overflow: hidden;
  background: #f2efe9;
}

.selection-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  width: 26px;
  height: 26px;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  pointer-events: none;
}

.selection-badge i {
  font-size: 12px;
  opacity: 0;
}

.selection-badge--active {
  border-color: #2f8bff;
  background: #2f8bff;
}

.selection-badge--active i {
  opacity: 1;
}

.cover-upload {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #a56a25;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(145deg, #f2efe9, #e7e1d6);
}

.cover-upload i {
  font-size: 28px;
}

.cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  color: #4b463c;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  background: linear-gradient(145deg, #f2efe9, #e7e1d6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  color: #000000;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upload-percent {
  margin: 0;
  font-size: 12px;
  color: #a56a25;
  font-weight: 600;
}


@media (min-width: 768px) {
  .home-page {
    max-width: 520px;
  }
}
</style>
