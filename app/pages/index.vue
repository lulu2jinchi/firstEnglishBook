<template>
  <div class="official-page">
    <header class="topbar">
      <p class="brand">看吧阅读器</p>
      <NuxtLink class="topbar-link" to="/home">进入书架</NuxtLink>
    </header>

    <main class="content">
      <section class="hero reveal">
        <p class="hero-badge">English Reading Companion</p>
        <h1>看吧阅读器</h1>
        <p class="slogan">一看一个不吱声</p>
        <p class="hero-desc">
          让英语原著阅读不再卡顿。上传 EPUB，自动筛出生词，按你的词汇量生成贴合语境的释义，阅读和学习在同一页面一次完成。
        </p>
        <div class="hero-actions">
          <NuxtLink class="btn btn-primary" to="/home">开始阅读</NuxtLink>
          <NuxtLink class="btn btn-ghost" to="/reader">快速体验</NuxtLink>
        </div>
        <ul class="hero-metrics" aria-label="产品能力概览">
          <li>
            <strong>EPUB</strong>
            <span>内置书 + 本地上传</span>
          </li>
          <li>
            <strong>AI</strong>
            <span>段落按词汇量释义</span>
          </li>
          <li>
            <strong>同步</strong>
            <span>阅读进度可恢复</span>
          </li>
        </ul>
      </section>

      <section class="feature-grid">
        <article v-for="feature in features" :key="feature.title" class="feature-card reveal">
          <p class="feature-tag">{{ feature.tag }}</p>
          <h2>{{ feature.title }}</h2>
          <p>{{ feature.desc }}</p>
        </article>
      </section>

      <section class="flow reveal">
        <h2>阅读流程</h2>
        <div class="flow-list">
          <article v-for="step in steps" :key="step.index" class="flow-step">
            <p class="index">0{{ step.index }}</p>
            <h3>{{ step.title }}</h3>
            <p>{{ step.desc }}</p>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '#imports'

const features = [
  {
    tag: '书架',
    title: '一本接一本，无缝进入阅读',
    desc: '内置书籍可即开即读，上传 EPUB 后自动入库，不需要额外格式转换。'
  },
  {
    tag: '释义',
    title: '只解释你可能不会的词',
    desc: '结合词频和词汇量阈值过滤，再按段落语境输出释义，减少无效信息干扰。'
  },
  {
    tag: '连续滚动',
    title: '跨章节连续读，不轻易跳回开头',
    desc: '针对滚动边界、恢复锚点和快速退出场景做了稳定性处理，阅读更连贯。'
  }
]

const steps = [
  {
    index: 1,
    title: '挑一本书',
    desc: '从书架选内置书，或上传你自己的 EPUB。'
  },
  {
    index: 2,
    title: '按词汇量学习',
    desc: '系统只高亮需要关注的词，并提供贴合上下文的解释。'
  },
  {
    index: 3,
    title: '继续上次进度',
    desc: '离开后再回来，优先恢复到你刚读到的位置。'
  }
]

useHead({
  title: '看吧阅读器｜一看一个不吱声',
  meta: [
    {
      name: 'description',
      content: '看吧阅读器：支持 EPUB 阅读、词汇量分级释义与阅读进度恢复的英语阅读产品。'
    }
  ],
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=ZCOOL+QingKe+HuangYou&display=swap'
    }
  ],
  bodyAttrs: {
    class: 'body--official'
  }
})
</script>

<style scoped>
:global(body.body--official) {
  margin: 0;
  color: #17212f;
  background:
    radial-gradient(circle at 8% 10%, #fdd6a4 0, rgba(253, 214, 164, 0) 35%),
    radial-gradient(circle at 92% 0%, #ffefcf 0, rgba(255, 239, 207, 0) 34%),
    linear-gradient(180deg, #fff8eb 0%, #f7f3ea 52%, #edf1ec 100%);
  font-family: 'Manrope', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}

.official-page {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 24px 16px 36px;
}

.topbar {
  width: min(1080px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  margin: 0;
  font-family: 'ZCOOL QingKe HuangYou', 'Hiragino Sans GB', cursive;
  font-size: clamp(26px, 3.4vw, 40px);
  letter-spacing: 1px;
  color: #19232e;
}

.topbar-link {
  text-decoration: none;
  color: #1c2d3b;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid rgba(28, 45, 59, 0.24);
  border-radius: 999px;
  padding: 8px 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.topbar-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(28, 45, 59, 0.14);
}

.content {
  width: min(1080px, 100%);
  margin: 18px auto 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero,
.feature-card,
.flow {
  border: 1px solid rgba(23, 33, 47, 0.14);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
}

.hero {
  padding: clamp(22px, 4vw, 42px);
}

.hero-badge {
  display: inline-flex;
  margin: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(18, 118, 125, 0.12);
  color: #0f5962;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 14px 0 0;
  font-size: clamp(44px, 9vw, 72px);
  line-height: 1.04;
  letter-spacing: -0.03em;
  color: #17212f;
}

.slogan {
  margin: 10px 0 0;
  font-size: clamp(20px, 3vw, 30px);
  font-weight: 800;
  color: #1f6a61;
}

.hero-desc {
  margin: 16px 0 0;
  max-width: 680px;
  font-size: 15px;
  line-height: 1.72;
  color: rgba(23, 33, 47, 0.88);
}

.hero-actions {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn {
  text-decoration: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-primary {
  color: #fffdf8;
  background: linear-gradient(120deg, #1f7059, #3f8a6b);
  box-shadow: 0 14px 24px rgba(37, 103, 77, 0.25);
}

.btn-ghost {
  color: #15212f;
  border: 1px solid rgba(21, 33, 47, 0.2);
  background: rgba(255, 255, 255, 0.65);
}

.hero-metrics {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.hero-metrics li {
  border-radius: 14px;
  padding: 14px 12px;
  background: rgba(245, 247, 243, 0.9);
  border: 1px solid rgba(23, 33, 47, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero-metrics strong {
  font-size: 16px;
}

.hero-metrics span {
  font-size: 12px;
  color: rgba(23, 33, 47, 0.76);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.feature-card {
  padding: 22px 18px;
}

.feature-tag {
  margin: 0;
  color: #0e5f70;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.feature-card h2 {
  margin: 10px 0 0;
  font-size: 20px;
  line-height: 1.3;
}

.feature-card p {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(23, 33, 47, 0.8);
}

.flow {
  padding: 24px 20px;
}

.flow h2 {
  margin: 0;
  font-size: clamp(24px, 4vw, 34px);
}

.flow-list {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.flow-step {
  border-radius: 14px;
  padding: 16px 14px;
  background: rgba(239, 245, 241, 0.9);
  border: 1px solid rgba(23, 33, 47, 0.08);
}

.flow-step .index {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #1a675e;
}

.flow-step h3 {
  margin: 10px 0 0;
  font-size: 18px;
}

.flow-step p {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(23, 33, 47, 0.82);
}

.reveal {
  opacity: 0;
  transform: translateY(18px);
  animation: rise-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.hero.reveal {
  animation-delay: 0.06s;
}

.feature-card.reveal:nth-child(1) {
  animation-delay: 0.14s;
}

.feature-card.reveal:nth-child(2) {
  animation-delay: 0.22s;
}

.feature-card.reveal:nth-child(3) {
  animation-delay: 0.3s;
}

.flow.reveal {
  animation-delay: 0.36s;
}

@keyframes rise-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }

  .flow-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .official-page {
    padding: 16px 14px 28px;
  }

  .hero {
    border-radius: 20px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .hero.reveal,
  .feature-card.reveal:nth-child(1),
  .feature-card.reveal:nth-child(2),
  .feature-card.reveal:nth-child(3),
  .flow.reveal {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .btn,
  .topbar-link {
    transition: none;
  }
}
</style>
