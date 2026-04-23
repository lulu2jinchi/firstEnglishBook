<template>
  <div class="official-page">
    <main class="content">
      <section class="hero reveal">
        <div class="hero-copy">
          <p class="hero-eyebrow">First English Book</p>
          <h1>看吧阅读器</h1>
          <p class="hero-desc">
            按你的词汇量自动筛出可能不会的词，给出贴合语境的释义，让你尽量不断流地把英文原著读下去。
          </p>
          <div class="hero-actions">
            <NuxtLink class="btn btn-primary" to="/home">开始阅读</NuxtLink>
            <NuxtLink class="btn btn-ghost" to="/reader">快速体验</NuxtLink>
          </div>
        </div>
        <div class="hero-media">
          <img
            class="hero-image"
            src="/landing/example.png"
            alt="看吧阅读器中，英文段落按词汇量高亮难词并显示语境释义"
            loading="eager"
          />
        </div>
      </section>

      <section class="feature-band reveal" aria-label="产品能力概览">
        <article class="feature-item">
          <strong>个性化难词预判</strong>
          <p>按用户词汇量提前筛出可能不会的词，不做全量翻译。</p>
        </article>
        <article class="feature-item">
          <strong>语境释义而非词典直译</strong>
          <p>给出句中含义，帮助你先看懂上下文，再逐步吸收表达。</p>
        </article>
        <article class="feature-item">
          <strong>持续阅读优先</strong>
          <p>支持进度恢复、本地导入与移动端阅读，尽量让你继续往下读。</p>
        </article>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '#imports'

const canonicalUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return new URL('/official', window.location.origin).href
})

const previewImageUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return new URL('/landing/example.png', window.location.origin).href
})

useHead(() => {
  const title = '看吧阅读器｜按词汇量辅助原著阅读'
  const description = '看吧阅读器：支持 EPUB 阅读、词汇量分级释义、进度恢复与本地导入的英语阅读产品。'
  const canonical = canonicalUrl.value
  const image = previewImageUrl.value

  return {
    title,
    meta: [
      { name: 'description', content: description },
      ...(canonical
        ? [
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: canonical },
            { property: 'og:image', content: image },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: description },
            { name: 'twitter:image', content: image }
          ]
        : [])
    ],
    link: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'
      },
      ...(canonical ? [{ rel: 'canonical', href: canonical }] : [])
    ],
    bodyAttrs: {
      class: 'body--official'
    }
  }
})
</script>

<style scoped>
:global(body.body--official) {
  margin: 0;
  color: #111827;
  background: #f3f4f6;
  font-family: 'Manrope', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}

.official-page {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 20px 16px 56px;
}

.content {
  width: min(1080px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 24px;
  align-items: end;
  min-height: calc(100dvh - 120px);
  padding: 20px 0 0;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 0 24px;
}

.hero-eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(42px, 8vw, 84px);
  line-height: 1;
  color: #0f172a;
  font-weight: 700;
}

.hero-desc {
  margin: 0;
  max-width: 640px;
  font-size: 17px;
  line-height: 1.8;
  color: #475569;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-media {
  align-self: stretch;
  display: flex;
  align-items: flex-end;
}

.hero-image {
  width: 100%;
  display: block;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12);
  background: #ffffff;
}

.btn {
  text-decoration: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  padding: 11px 16px;
  min-width: 96px;
  text-align: center;
  border: 1px solid transparent;
}

.btn-primary {
  color: #f8fafc;
  background: #111827;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.16);
}

.btn-ghost {
  color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255, 255, 255, 0.94);
}

.feature-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.feature-item {
  padding: 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

.feature-item strong {
  font-size: 16px;
  line-height: 1.35;
  color: #0f172a;
}

.feature-item p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #475569;
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
    padding: 12px 12px 34px;
  }

  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    gap: 18px;
  }

  .hero-desc {
    font-size: 15px;
  }

  .feature-band {
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
