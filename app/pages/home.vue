<template>
  <div class="home-page">
    <label class="search-bar" aria-label="搜索书籍">
      <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
      <input v-model="searchQuery" type="search" placeholder="Search" />
    </label>

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
        :class="{ 'card--uploading': book.isUploading }"
        :role="book.isUploading ? 'presentation' : 'button'"
        :aria-disabled="book.isUploading ? 'true' : 'false'"
        :tabindex="book.isUploading ? -1 : 0"
        @click="handleBookClick(book)"
      >
        <div class="cover">
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

    <nav class="tab-bar" aria-label="底部导航">
      <button class="tab tab--active" type="button" aria-label="首页">
        <i class="fa-solid fa-house tab-icon" aria-hidden="true"></i>
      </button>
      <button class="tab add-btn" type="button" aria-label="添加" :disabled="isUploading" @click="triggerUpload">
        <i class="fa-solid fa-plus tab-icon" aria-hidden="true"></i>
      </button>
      <button class="tab" type="button" aria-label="个人中心">
        <i class="fa-regular fa-user tab-icon" aria-hidden="true"></i>
      </button>
      <div class="home-indicator" aria-hidden="true" />
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '#imports'
import Dexie, { type Table } from 'dexie'

const imgRightSide =
  "https://www.figma.com/api/mcp/asset/c06005b8-a781-41f5-aab5-5c7c1590b92f";
const imgTime =
  "https://www.figma.com/api/mcp/asset/74f541a2-42b8-4a06-82da-9f562ec5b317";

type RawBook = {
  file: string
  title?: string
  id?: number
}

type BookItem = {
  file: string
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

const baseBooks: RawBook[] = [
  { file: 'book/Normal People (Sally Rooney) (Z-Library).epub' },
  { file: 'book/The happiness hypothesis putting ancient wisdom and -- Jonathan Haidt -- ( WeLib.org ).epub' },
  { file: 'book/oz.epub' },
  { file: 'book/rose.epub' }
]

const uploadedBooks = ref<RawBook[]>([])
const activeBookUrls = new Set<string>()

const rawBooks = computed<RawBook[]>(() => [...uploadedBooks.value, ...baseBooks])

const books = computed<BookItem[]>(() =>
  rawBooks.value.map((book) => {
    const name = book.file.split('/').pop() || book.file
    const derivedTitle = name.replace(/\.epub$/i, '').trim()
    const title = book.title?.trim() || derivedTitle || '未命名书籍'
    return {
      file: book.file,
      title,
      cover: coverStates.value[book.file] ?? null,
      id: book.id
    }
  })
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
  if (typeof book.id === 'number') {
    router.push({ path: '/reader', query: { uploadId: String(book.id) } })
    return
  }
  router.push({ path: '/reader', query: { book: book.file } })
}

const handleBookClick = (book: BookItem) => {
  if (book.isUploading) return
  goRead(book)
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
  void loadUploadedBooks()
})

onBeforeUnmount(() => {
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
      { id: recordId ?? undefined, file: objectUrl, title },
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

.search-bar {
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

.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 157 / 206;
  border-radius: 8px;
  overflow: hidden;
  background: #f2efe9;
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

.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 78px;
  padding: 10px 24px calc(16px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 -0.5px 0 rgba(0, 0, 0, 0.1);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: start;
  justify-items: center;
  box-sizing: border-box;
  z-index: 10;
}

.tab {
  border: none;
  background: transparent;
  padding: 12px 20px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tab-icon {
  font-size: 22px;
  color: #1d1b20;
}

.tab--active {
  color: #1d1b20;
}

.add-btn {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  margin-top: -10px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.add-btn .tab-icon {
  font-size: 26px;
}

.home-indicator {
  position: absolute;
  bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: 134px;
  height: 5px;
  background: #000000;
  border-radius: 100px;
}

@media (min-width: 768px) {
  .home-page {
    max-width: 520px;
  }
}
</style>
