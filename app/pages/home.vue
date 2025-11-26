<template>
  <div class="home-page">
    <label class="search-bar" aria-label="搜索书籍">
      <img class="search-icon" :src="imgSearch" alt="" />
      <input v-model="searchQuery" type="search" placeholder="Search" />
    </label>

    <div class="grid">
      <div v-for="book in filteredBooks" :key="book.title" class="card">
        <div class="cover">
          <img :src="book.cover" :alt="book.title" loading="lazy" />
        </div>
        <p class="title">{{ book.title }}</p>
      </div>
    </div>

    <nav class="tab-bar" aria-label="底部导航">
      <button class="tab tab--active" type="button" aria-label="首页">
        <img :src="imgIconTabHomeFill" alt="首页" />
      </button>
      <button class="tab add-btn" type="button" aria-label="添加">
        <img :src="imgIcon" alt="添加书籍" />
      </button>
      <button class="tab" type="button" aria-label="个人中心">
        <img :src="imgPerson" alt="个人中心" />
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useHead } from "#imports";

const imgImage =
  "https://www.figma.com/api/mcp/asset/610d2caf-7fb4-4ff2-bd83-cedaa2aa4780";
const imgImage1 =
  "https://www.figma.com/api/mcp/asset/f0393f3d-6cc1-467f-ac0a-205463ac5793";
const imgImage2 =
  "https://www.figma.com/api/mcp/asset/d7cd3153-dfe6-490d-b6ba-2580358bf645";
const imgImage3 =
  "https://www.figma.com/api/mcp/asset/43b7f465-3f56-42d5-bd83-a6d1d0afbc84";
const imgImage4 =
  "https://www.figma.com/api/mcp/asset/9b203a22-ab22-4bdb-94cd-d4544fc129ad";
const imgImage5 =
  "https://www.figma.com/api/mcp/asset/4cfe6862-edd7-4178-98bd-c168e69f157e";
const imgImage6 =
  "https://www.figma.com/api/mcp/asset/26ef5b15-6bae-47db-9f0d-1599ee94f3ef";
const imgIcon =
  "https://www.figma.com/api/mcp/asset/4afcf203-50c2-4b04-902e-b9f45e452fcc";
const imgPerson =
  "https://www.figma.com/api/mcp/asset/791220e3-a285-4d00-874b-48719186df68";
const imgSearch =
  "https://www.figma.com/api/mcp/asset/fd3a146b-3130-4cc7-8096-ce3564f6e306";
const imgIconTabHomeFill =
  "https://www.figma.com/api/mcp/asset/a9298d79-3cfb-4bfd-8701-53e43debda3d";
const imgRightSide =
  "https://www.figma.com/api/mcp/asset/c06005b8-a781-41f5-aab5-5c7c1590b92f";
const imgTime =
  "https://www.figma.com/api/mcp/asset/74f541a2-42b8-4a06-82da-9f562ec5b317";

const searchQuery = ref("");
const books = ref([
  { title: "Herbal Market", cover: imgImage },
  { title: "Green Stems", cover: imgImage2 },
  { title: "Radish Days", cover: imgImage3 },
  { title: "Leafy Garden", cover: imgImage4 },
  { title: "Rooted Notes", cover: imgImage5 },
  { title: "Fresh Bunch", cover: imgImage6 },
  { title: "Spring Basket", cover: imgImage1 },
  { title: "Kitchen Tales", cover: imgImage },
]);

const filteredBooks = computed(() => {
  if (!searchQuery.value.trim()) {
    return books.value;
  }
  const query = searchQuery.value.toLowerCase();
  return books.value.filter((book) => book.title.toLowerCase().includes(query));
});

useHead({
  title: "Home · First English Book",
  bodyAttrs: {
    class: "body--home",
  },
});
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
  min-height: 100vh;
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
  width: 24px;
  height: 24px;
  object-fit: contain;
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
}

.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 157 / 206;
  border-radius: 8px;
  overflow: hidden;
  background: #f7f7f7;
}

.cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.title {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  color: #000000;
}

.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 78px;
  padding: 10px 24px calc(0px + env(safe-area-inset-bottom, 0px));
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

.tab img {
  width: 24px;
  height: 24px;
  object-fit: contain;
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

.add-btn img {
  width: 28px;
  height: 28px;
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
