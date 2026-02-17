<template>
  <div class="official-page">
     
    <main class="content">
      <section class="hero reveal">
        <h1>看吧阅读器</h1>
        <p class="hero-desc">
          按你的词汇量自动筛出生词，生成贴合语境的释义，不靠刻意背单词，通过多看自然提升英语。
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
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'
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
  color: #111827;
  background:
    radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 34%),
    linear-gradient(180deg, #f5f5f7 0%, #f3f4f6 52%, #eef0f3 100%);
  font-family: 'Manrope', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}

.official-page {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 44px 20px 56px;
}

.content {
  width: min(960px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.hero,
.demo-card {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 24px 54px rgba(15, 23, 42, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
}

.hero {
  padding: clamp(28px, 4vw, 54px);
}

h1 {
  margin: 0;
  font-size: clamp(42px, 7.2vw, 72px);
  line-height: 1.01;
  letter-spacing: -0.045em;
  color: #0f172a;
  font-weight: 800;
}

.hero-desc {
  margin: 16px 0 0;
  max-width: 720px;
  font-size: 16px;
  line-height: 1.8;
  color: rgba(30, 41, 59, 0.76);
}

.hero-actions {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn {
  text-decoration: none;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 14px;
  min-width: 86px;
  text-align: center;
  border: 1px solid transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-primary {
  color: #f8fafc;
  background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.26);
}

.btn-ghost {
  color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.hero-metrics {
  list-style: none;
  margin: 26px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.hero-metrics li {
  border-radius: 18px;
  padding: 16px 15px;
  background: linear-gradient(170deg, rgba(255, 255, 255, 0.95), rgba(246, 248, 251, 0.92));
  border: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hero-metrics li:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.1);
}

.hero-metrics strong {
  font-size: 16px;
  line-height: 1.35;
  color: #0f172a;
}

.hero-metrics span {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(15, 23, 42, 0.7);
}

.demo-card {
  padding: 20px;
}

.demo-card__title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #111827;
}

.demo-card__image {
  display: block;
  width: 100%;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: #e6e6ea;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
}

.reveal {
  opacity: 0;
  transform: translateY(12px);
  animation: rise-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.hero.reveal {
  animation-delay: 0.06s;
}

@keyframes rise-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 680px) {
  .official-page {
    padding: 18px 12px 34px;
  }

  .hero {
    border-radius: 22px;
    padding: 22px 18px;
  }

  .hero-desc {
    font-size: 15px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .hero.reveal {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .btn,
  .hero-metrics li {
    transition: none;
  }
}
</style>
