<template>
  <div class="home-page">
    <label class="search-bar" aria-label="搜索书籍">
      <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
      <input v-model="searchQuery" type="search" placeholder="Search" />
    </label>

    <div class="grid">
      <div v-for="book in filteredBooks" :key="book.file" class="card" role="button" @click="goRead(book)">
        <div class="cover">
          <img v-if="book.cover" :src="book.cover" :alt="book.title" loading="lazy" />
          <div v-else class="cover-placeholder" aria-hidden="true">{{ book.title }}</div>
        </div>
        <p class="title line-clamp-2">{{ book.title }}</p>
      </div>
    </div>

    <nav class="tab-bar" aria-label="底部导航">
      <button class="tab tab--active" type="button" aria-label="首页">
        <i class="fa-solid fa-house tab-icon" aria-hidden="true"></i>
      </button>
      <button class="tab add-btn" type="button" aria-label="添加">
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '#imports'

const imgRightSide =
  "https://www.figma.com/api/mcp/asset/c06005b8-a781-41f5-aab5-5c7c1590b92f";
const imgTime =
  "https://www.figma.com/api/mcp/asset/74f541a2-42b8-4a06-82da-9f562ec5b317";

type BookItem = {
  file: string
  title: string
  cover: string | null
}

const router = useRouter()
const searchQuery = ref('')
const coverStates = ref<Record<string, string | null>>({})
const loadingCovers = new Set<string>()

const rawBooks = [
  { file: 'book/Normal People (Sally Rooney) (Z-Library).epub' },
  { file: 'book/The happiness hypothesis putting ancient wisdom and -- Jonathan Haidt -- ( WeLib.org ).epub' },
  { file: 'book/oz.epub' },
  { file: 'book/rose.epub' }
]

const books = computed<BookItem[]>(() =>
  rawBooks.map((book) => {
    const name = book.file.split('/').pop() || book.file
    const title = name.replace(/\.epub$/i, '').trim()
    return {
      file: book.file,
      title,
      cover: coverStates.value[book.file] ?? null
    }
  })
)

const filteredBooks = computed(() => {
  const list = books.value
  if (!searchQuery.value.trim()) {
    return list
  }
  const query = searchQuery.value.toLowerCase()
  return list.filter(book => book.title.toLowerCase().includes(query))
})

const goRead = (book: BookItem) => {
  router.push({ path: '/reader', query: { book: book.file } })
}

const fetchCover = async (file: string) => {
  const { default: ePub } = await import('epubjs')
  const book = ePub(encodeURI(file))
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

onMounted(async () => {
  await Promise.all(
    rawBooks.map(async (book) => {
      if (loadingCovers.has(book.file)) return
      loadingCovers.add(book.file)
      coverStates.value[book.file] = await fetchCover(book.file)
    })
  )
})

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

.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 157 / 206;
  border-radius: 8px;
  overflow: hidden;
  background: #f2efe9;
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
