<template>
  <div class="reader-shell">
    <header class="reader-header">
      <div class="title-block"></div>
      <div class="header-actions">
        <button class="mode-toggle" :disabled="isLoading" @click="toggleMode">
          {{ modeButtonText }}
        </button>
      </div>
    </header>

    <section class="status-bar">
      <span v-if="isLoading">正在加载电子书…</span>
      <template v-else>
        <span>位置：{{ currentLocation }}</span>
        <span>进度：{{ progressText }}</span>
      </template>
    </section>

    <main class="reader-body">
      <button
        v-if="isPaginated"
        class="page-button prev"
        :disabled="isLoading"
        aria-label="上一页"
        @click="goPrev"
      >
        ‹
      </button>
      <div ref="viewerEl" class="viewer" aria-label="EPUB 内容区域" />
      <button
        v-if="isPaginated"
        class="page-button next"
        :disabled="isLoading"
        aria-label="下一页"
        @click="goNext"
      >
        ›
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useReader } from "~/composables/useReader";

const viewerEl = ref<HTMLDivElement | null>(null);

const route = useRoute();

const bookPath = computed(() => {
  const queryPath = route.query.book;
  const raw =
    typeof queryPath === "string" && queryPath.trim()
      ? queryPath
      : "book/Normal People (Sally Rooney) (Z-Library).epub";
  return raw.startsWith("/") ? raw : `/${raw}`;
});

const {
  isLoading,
  currentLocation,
  progressText,
  isPaginated,
  modeButtonText,
  toggleMode,
  goPrev,
  goNext,
} = useReader(viewerEl, bookPath);
</script>

<style scoped>
:global(body.body--reader) {
  margin: 0;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

.reader-shell {
  min-height: 100dvh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 28px;
  gap: 12px;
}

.reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-actions {
  margin-left: auto;
}

.mode-toggle {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(148, 163, 184, 0.16);
  color: #e2e8f0;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.2s ease,
    border-color 0.2s ease;
}

.mode-toggle:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
  background: rgba(148, 163, 184, 0.24);
  border-color: rgba(148, 163, 184, 0.6);
}

.mode-toggle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.title-block h1 {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 700;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: #94a3b8;
}

.controls {
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.2s ease,
    border-color 0.2s ease;
  color: #0f172a;
}

.controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.controls .primary {
  background: linear-gradient(135deg, #22d3ee, #6366f1);
  color: #0b1224;
  box-shadow: 0 10px 30px rgba(99, 102, 241, 0.35);
}

.controls .ghost {
  background: rgba(148, 163, 184, 0.15);
  border-color: rgba(148, 163, 184, 0.5);
  color: #e2e8f0;
}

.controls button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 12px;
  font-size: 14px;
  color: #cbd5e1;
}

.reader-body {
  flex: 1;
  min-height: 70vh;
  display: flex;
  position: relative;
  background: radial-gradient(
      circle at 20% 20%,
      rgba(255, 244, 189, 0.7),
      transparent 38%
    ),
    radial-gradient(
      circle at 80% 0%,
      rgba(255, 235, 148, 0.75),
      transparent 34%
    ),
    #fff8dc;
  border-radius: 16px;
  border: 1px solid rgba(203, 167, 71, 0.4);
  overflow: hidden;
}

.page-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(203, 167, 71, 0.4);
  background: rgba(255, 248, 220, 0.85);
  color: #a66a09;
  font-size: 32px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  z-index: 2; /* 确保翻页按钮层级高于阅读区域 */
}

.page-button:hover:not(:disabled) {
  transform: translateY(-50%) scale(1.03);
  box-shadow: 0 10px 30px rgba(166, 106, 9, 0.25);
  background: rgba(255, 248, 220, 0.95);
}

.page-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.page-button.prev {
  left: 12px;
}

.page-button.next {
  right: 12px;
}

.viewer {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.viewer :deep(iframe) {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: #fff8dc;
}

@media (max-width: 720px) {
  .reader-shell {
    padding: 16px;
  }

  .reader-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .controls {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
