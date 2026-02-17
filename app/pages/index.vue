<template>
  <div class="official-page">
     
    <main class="content">
      <section class="hero reveal">
        <h1>看吧阅读器</h1>
        <p class="hero-desc">
          让英语原著阅读不再卡顿。上传 EPUB，按你的词汇量自动筛出生词，生成贴合语境的释义，不靠刻意背单词，通过多看自然提升英语。
        </p>
        <div class="hero-actions">
          <NuxtLink class="btn btn-primary" to="/home">开始阅读</NuxtLink>
          <NuxtLink class="btn btn-ghost" to="/reader">快速体验</NuxtLink>
        </div>
        <ul class="hero-metrics" aria-label="产品能力概览">
          <li>
            <strong>个性化难词预判</strong>
            <span>按用户词汇量提前筛出可能不会的词，不做全量翻译。</span>
          </li>
          <li>
            <strong>语境释义而非词典直译</strong>
            <span>给出句中含义，帮助真正看懂上下文。</span>
          </li>
          <li>
            <strong>无痛习得路径</strong>
            <span>通过持续阅读中的语境暴露自然提升英语。</span>
          </li>
        </ul>
      </section>

      <section class="demo-card reveal" aria-label="阅读器示意图">
        <p class="demo-card__title">阅读器释义示意图</p>
        <img
          class="demo-card__image"
          src="/landing/example.png"
          alt="英文阅读段落中，词语高亮并弹出中文释义的界面示意图"
          loading="lazy"
        />
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '#imports'

const features = [
  {
    tag: '亮点 01',
    title: '个性化难词预判',
    desc: '按用户词汇量提前筛出“可能不会”的词，不是全量翻译。'
  },
  {
    tag: '亮点 02',
    title: '语境释义而非词典直译',
    desc: '给的是“这个句子里”的意思，帮助真正看懂上下文。'
  },
  {
    tag: '亮点 03',
    title: '无痛习得路径',
    desc: '不靠刻意背单词，通过持续阅读中的高频语境暴露自然提升英语。'
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
.demo-card {
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

.demo-card {
  padding: 16px;
}

.demo-card__title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: #0f2338;
}

.demo-card__image {
  display: block;
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(23, 33, 47, 0.12);
  background: #e6e6ea;
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
  .feature-card.reveal:nth-child(3) {
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
