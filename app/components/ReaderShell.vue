<template>
  <div class="reader-shell" :style="themeVars">
    <div v-if="apiErrorVisible" class="api-error-toast" role="status" aria-live="polite">
      {{ apiErrorMessage }}
    </div>

    <header class="reader-topbar" aria-label="阅读器工具栏">
      <div class="topbar-actions">
        <button class="topbar-button" type="button" aria-label="目录" @click="togglePanel('outline')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="3" height="3" rx="1" />
            <rect x="4" y="10.5" width="3" height="3" rx="1" />
            <rect x="4" y="16" width="3" height="3" rx="1" />
            <rect x="9.5" y="5.5" width="10.5" height="2" rx="1" />
            <rect x="9.5" y="11" width="10.5" height="2" rx="1" />
            <rect x="9.5" y="16.5" width="10.5" height="2" rx="1" />
          </svg>
        </button>
        <button class="topbar-button" type="button" aria-label="配色" @click="togglePanel('theme')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3a9 9 0 1 0 9 9h-9V3z"
              fill="currentColor"
            />
            <path
              d="M12 3v9h9"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </button>
        <button class="topbar-button" type="button" aria-label="排版" @click="togglePanel('type')">
          <span class="topbar-text">Aa</span>
        </button>
      </div>
    </header>

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

    <div v-if="activePanel" class="panel-overlay" role="presentation" @click="closePanel">
      <section
        ref="panelSheetEl"
        class="panel-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="panelLabel"
        @click.stop
        @touchstart="handlePanelTouchStart"
        @touchmove="handlePanelTouchMove"
        @touchend="handlePanelTouchEnd"
        @touchcancel="handlePanelTouchEnd"
      >
        <div class="panel-handle" />
        <div v-if="activePanel === 'outline'" ref="panelContentEl" class="panel-content">
          <h3>目录</h3>
          <div v-if="flatToc.length === 0" class="panel-empty">暂无目录</div>
          <button
            v-for="item in flatToc"
            :key="item.key"
            type="button"
            class="toc-item"
            :style="{ paddingLeft: `${12 + item.depth * 14}px` }"
            @click="handleTocSelect(item)"
          >
            <span class="toc-title">{{ item.label }}</span>
          </button>
        </div>

        <div v-else-if="activePanel === 'theme'" ref="panelContentEl" class="panel-content">
          <h3>阅读配色</h3>
          <div class="theme-grid">
            <button
              v-for="theme in themeOptions"
              :key="theme.id"
              type="button"
              class="theme-card"
              :class="{ active: theme.id === activeThemeId }"
              :style="{
                '--theme-bg': theme.background,
                '--theme-text': theme.text
              }"
              @click="selectTheme(theme.id)"
            >
              <span class="theme-title">Aa</span>
              <span class="theme-label">{{ theme.label }}</span>
            </button>
          </div>
        </div>

        <div v-else ref="panelContentEl" class="panel-content">
          <h3>字体与排版</h3>
          <div
            class="type-preview"
            :style="{
              fontFamily: activeFont.family,
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}`,
              color: activeTheme.text,
              background: activeTheme.panel
            }"
          >
            The quick brown fox jumps over the lazy dog. Reading should be a pleasure.
          </div>

          <div class="type-section">
            <div class="type-label">字体</div>
            <div class="font-list">
              <button
                v-for="font in fontOptions"
                :key="font.id"
                type="button"
                class="font-option"
                :class="{ active: font.id === activeFontId }"
                :style="{ fontFamily: font.family }"
                @click="selectFont(font.id)"
              >
                <span>{{ font.label }}</span>
                <span class="font-sample">Aa</span>
              </button>
            </div>
          </div>

          <div class="type-section">
            <div class="type-label">字号</div>
            <div class="stepper">
              <button type="button" @click="bumpFontSize(-1)">A-</button>
              <span class="stepper-value">{{ fontSize }}px</span>
              <button type="button" @click="bumpFontSize(1)">A+</button>
            </div>
          </div>

          <div class="type-section">
            <div class="type-label">行高</div>
            <div class="stepper">
              <button type="button" @click="bumpLineHeight(-0.1)">-</button>
              <span class="stepper-value">{{ lineHeight.toFixed(1) }}x</span>
              <button type="button" @click="bumpLineHeight(0.1)">+</button>
            </div>
          </div>

          <div class="type-section">
            <div class="type-label">滚动引擎</div>
            <div class="mode-chip-group">
              <button
                type="button"
                class="mode-chip"
                :class="{ active: !experimentalContinuousEffective }"
                @click="setExperimentalContinuousScroll(false)"
              >
                稳定模式
              </button>
              <button
                type="button"
                class="mode-chip"
                :class="{ active: experimentalContinuousEffective }"
                :disabled="!continuousModeSupported"
                @click="setExperimentalContinuousScroll(true)"
              >
                实验性连续滚动
              </button>
            </div>
            <div v-if="!continuousModeSupported" class="mode-hint">
              当前设备为触屏模式，已强制使用稳定模式以避免跨章节跳变。
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useHead } from "#imports";
import { useRoute } from "vue-router";
import Dexie, { type Table } from "dexie";
import { useReader } from "~/composables/useReader";
import {
  DEFAULT_READER_FONT_SIZE,
  DEFAULT_READER_LINE_HEIGHT,
  MAX_READER_FONT_SIZE,
  MAX_READER_LINE_HEIGHT,
  MIN_READER_FONT_SIZE,
  MIN_READER_LINE_HEIGHT,
} from "~/constants/readerPreferences";

const viewerEl = ref<HTMLDivElement | null>(null);

const route = useRoute();

type UploadRecord = {
  id?: number;
  title: string;
  blob: Blob;
  createdAt: number;
};

class UploadBookDB extends Dexie {
  uploads!: Table<UploadRecord, number>;

  constructor() {
    super("home-uploaded-books");
    this.version(1).stores({
      uploads: "++id, createdAt",
    });
    this.uploads = this.table("uploads");
  }
}

let uploadBookDb: UploadBookDB | null = null;

const ensureUploadBookDb = () => {
  if (uploadBookDb) return uploadBookDb;
  if (typeof window === "undefined") return null;
  uploadBookDb = new UploadBookDB();
  return uploadBookDb;
};

const objectUrl = ref<string | null>(null);
const bookPath = ref<string | null>(null);

const clearObjectUrl = () => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
};

const resolveBookPath = async () => {
  const uploadId = route.query.uploadId;
  const bookQuery = route.query.book;

  if (typeof uploadId === "string" && uploadId.trim()) {
    clearObjectUrl();
    const db = ensureUploadBookDb();
    if (db) {
      const id = Number(uploadId);
      if (!Number.isNaN(id)) {
        try {
          const record = await db.uploads.get(id);
          if (record?.blob) {
            objectUrl.value = URL.createObjectURL(record.blob);
            bookPath.value = objectUrl.value;
            return;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("读取上传书籍失败", error);
        }
      }
    }
    bookPath.value = null;
    return;
  }

  const raw =
    typeof bookQuery === "string" && bookQuery.trim()
      ? bookQuery
      : "book/Normal People (Sally Rooney) (Z-Library).epub";
  if (/^(blob:|data:|https?:|file:)/i.test(raw)) {
    bookPath.value = raw;
    return;
  }
  bookPath.value = raw.startsWith("/") ? raw : `/${raw}`;
};

const parseExperimentalContinuousQuery = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return null;
};

const experimentalContinuousScroll = ref(
  parseExperimentalContinuousQuery(route.query.experimentalContinuous) ?? true
);

const syncExperimentalContinuousFromRoute = () => {
  const fromQuery = parseExperimentalContinuousQuery(route.query.experimentalContinuous);
  if (fromQuery === null) return;
  experimentalContinuousScroll.value = fromQuery;
};

const setExperimentalContinuousScroll = (enabled: boolean) => {
  experimentalContinuousScroll.value = enabled;
};

watch(
  () => route.query,
  () => {
    void resolveBookPath();
    syncExperimentalContinuousFromRoute();
  },
  { deep: true, immediate: true }
);

onBeforeUnmount(() => {
  clearObjectUrl();
});

const {
  isLoading,
  currentLocation,
  progressText,
  apiErrorMessage,
  apiErrorVisible,
  isPaginated,
  modeButtonText,
  tocItems,
  setReaderTheme,
  setReaderFontFamily,
  setReaderFontSize,
  setReaderLineHeight,
  toggleMode,
  goPrev,
  goNext,
  goToHref,
  continuousModeSupported,
} = useReader(viewerEl, computed(() => bookPath.value), {
  useExperimentalContinuousScroll: computed(() => experimentalContinuousScroll.value),
});

const experimentalContinuousEffective = computed(
  () => experimentalContinuousScroll.value && continuousModeSupported.value
);

type TocItem = {
  label?: string;
  href?: string;
  subitems?: TocItem[];
};

type FlatTocItem = {
  key: string;
  label: string;
  href?: string;
  depth: number;
};

type ReaderTheme = {
  id: string;
  label: string;
  background: string;
  text: string;
  panel: string;
  border: string;
  muted: string;
};

type ReaderFont = {
  id: string;
  label: string;
  family: string;
};

const themeOptions: ReaderTheme[] = [
  {
    id: "original",
    label: "Original",
    background: "#fff8dc",
    text: "#1f2937",
    panel: "#ffffff",
    border: "#e4d3a4",
    muted: "#a8742f",
  },
  {
    id: "paper",
    label: "Paper",
    background: "#f6f2e8",
    text: "#1f2937",
    panel: "#ffffff",
    border: "#e6dcc5",
    muted: "#8c7a5b",
  },
  {
    id: "focus",
    label: "Focus",
    background: "#fbf5e9",
    text: "#27272a",
    panel: "#ffffff",
    border: "#eadfc9",
    muted: "#a08f7a",
  },
  {
    id: "calm",
    label: "Calm",
    background: "#f1e6d2",
    text: "#3a2f21",
    panel: "#ffffff",
    border: "#dbc7a9",
    muted: "#9b7d52",
  },
  {
    id: "sepia",
    label: "Sepia",
    background: "#f3e0c2",
    text: "#3f2d20",
    panel: "#ffffff",
    border: "#d9bea0",
    muted: "#a07245",
  },
  {
    id: "quiet",
    label: "Quiet",
    background: "#2b2b2b",
    text: "#f5f2e8",
    panel: "#3a3a3a",
    border: "#4b4b4b",
    muted: "#b9afa3",
  },
];

const fontOptions: ReaderFont[] = [
  {
    id: "classic",
    label: "Georgia",
    family: '"Georgia", "Times New Roman", serif',
  },
  {
    id: "book",
    label: "Palatino",
    family: '"Palatino Linotype", "Book Antiqua", "Palatino", serif',
  },
  {
    id: "modern",
    label: "Avenir",
    family: '"Avenir Next", "Helvetica Neue", Arial, sans-serif',
  },
];

const activePanel = ref<null | "outline" | "theme" | "type">(null);
const panelSheetEl = ref<HTMLElement | null>(null);
const panelContentEl = ref<HTMLElement | null>(null);
const isPanelDragging = ref(false);
const panelDragStartY = ref(0);
const panelDragOffset = ref(0);

const readerThemeStorageKey = "first-english-book-reader-theme";
const readerFontStorageKey = "first-english-book-reader-font";
const readerFontSizeStorageKey = "first-english-book-reader-font-size";
const readerLineHeightStorageKey = "first-english-book-reader-line-height";
const minFontSize = MIN_READER_FONT_SIZE;
const maxFontSize = MAX_READER_FONT_SIZE;
const minLineHeight = MIN_READER_LINE_HEIGHT;
const maxLineHeight = MAX_READER_LINE_HEIGHT;

const getStorageValue = (key: string) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
};

const setStorageValue = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

const clampNumber = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const parseStoredNumber = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getThemeById = (id: string) =>
  themeOptions.find((theme) => theme.id === id) || themeOptions[0];

const getFontById = (id: string) =>
  fontOptions.find((font) => font.id === id) || fontOptions[0];

const normalizeThemeId = (value: string | null) => {
  if (value && themeOptions.some((theme) => theme.id === value)) {
    return value;
  }
  return themeOptions[0].id;
};

const normalizeFontId = (value: string | null) => {
  if (value && fontOptions.some((font) => font.id === value)) {
    return value;
  }
  return fontOptions[0].id;
};

const activeThemeId = ref(normalizeThemeId(getStorageValue(readerThemeStorageKey)));
const activeFontId = ref(normalizeFontId(getStorageValue(readerFontStorageKey)));
const fontSize = ref(
  clampNumber(
    parseStoredNumber(getStorageValue(readerFontSizeStorageKey), DEFAULT_READER_FONT_SIZE),
    minFontSize,
    maxFontSize
  )
);
const lineHeight = ref(
  clampNumber(
    parseStoredNumber(getStorageValue(readerLineHeightStorageKey), DEFAULT_READER_LINE_HEIGHT),
    minLineHeight,
    maxLineHeight
  )
);

const activeTheme = computed(() => getThemeById(activeThemeId.value));
const activeFont = computed(() => getFontById(activeFontId.value));
const statusBarColor = computed(() => activeTheme.value.background);

const themeVars = computed(() => ({
  "--reader-bg": activeTheme.value.background,
  "--reader-text": activeTheme.value.text,
  "--reader-panel": activeTheme.value.panel,
  "--reader-border": activeTheme.value.border,
  "--reader-muted": activeTheme.value.muted,
}));

useHead(() => ({
  meta: [
    { name: "theme-color", content: statusBarColor.value },
    { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
  ],
}));

const panelLabel = computed(() => {
  if (activePanel.value === "outline") return "目录";
  if (activePanel.value === "theme") return "阅读配色";
  if (activePanel.value === "type") return "字体与排版";
  return "";
});

const togglePanel = (panel: "outline" | "theme" | "type") => {
  activePanel.value = activePanel.value === panel ? null : panel;
};

const closePanel = () => {
  activePanel.value = null;
  resetPanelTransform();
};

const selectTheme = (id: string, persist = true) => {
  const theme = getThemeById(id);
  activeThemeId.value = theme.id;
  setReaderTheme({ background: theme.background, text: theme.text });
  if (persist) {
    setStorageValue(readerThemeStorageKey, theme.id);
  }
};

const selectFont = (id: string, persist = true) => {
  const font = getFontById(id);
  activeFontId.value = font.id;
  setReaderFontFamily(font.family);
  if (persist) {
    setStorageValue(readerFontStorageKey, font.id);
  }
};

const applyFontSize = (value: number, persist = true) => {
  const next = clampNumber(value, minFontSize, maxFontSize);
  fontSize.value = next;
  setReaderFontSize(next);
  if (persist) {
    setStorageValue(readerFontSizeStorageKey, String(next));
  }
};

const applyLineHeight = (value: number, persist = true) => {
  const next = Number(clampNumber(value, minLineHeight, maxLineHeight).toFixed(1));
  lineHeight.value = next;
  setReaderLineHeight(next);
  if (persist) {
    setStorageValue(readerLineHeightStorageKey, String(next));
  }
};

const bumpFontSize = (delta: number) => {
  applyFontSize(fontSize.value + delta);
};

const bumpLineHeight = (delta: number) => {
  applyLineHeight(lineHeight.value + delta);
};

const flattenToc = (items: TocItem[], depth = 0, acc: FlatTocItem[] = []) => {
  items.forEach((item, index) => {
    const label = (item.label || "").trim() || "未命名章节";
    acc.push({
      key: `${item.href || label}-${depth}-${index}`,
      label,
      href: item.href,
      depth,
    });
    if (item.subitems && item.subitems.length > 0) {
      flattenToc(item.subitems, depth + 1, acc);
    }
  });
  return acc;
};

const flatToc = computed(() => flattenToc(tocItems.value || []));

const handleTocSelect = (item: FlatTocItem) => {
  if (item.href) {
    void goToHref(item.href);
  }
  closePanel();
};

const resetPanelTransform = () => {
  if (!panelSheetEl.value) return;
  panelSheetEl.value.style.transition = "";
  panelSheetEl.value.style.transform = "";
};

const handlePanelTouchStart = (event: TouchEvent) => {
  if (!panelSheetEl.value || event.touches.length !== 1) return;
  const target = event.target as HTMLElement | null;
  const startedOnHandle = Boolean(target?.closest(".panel-handle"));
  const scrollTop = panelContentEl.value?.scrollTop ?? 0;
  if (!startedOnHandle && scrollTop > 0) return;
  isPanelDragging.value = true;
  panelDragStartY.value = event.touches[0].clientY;
  panelDragOffset.value = 0;
  panelSheetEl.value.style.transition = "none";
};

const handlePanelTouchMove = (event: TouchEvent) => {
  if (!isPanelDragging.value || !panelSheetEl.value || event.touches.length !== 1) return;
  const currentY = event.touches[0].clientY;
  const delta = Math.max(0, currentY - panelDragStartY.value);
  if (delta <= 0) return;
  panelDragOffset.value = delta;
  panelSheetEl.value.style.transform = `translateY(${delta}px)`;
  event.preventDefault();
};

const handlePanelTouchEnd = () => {
  if (!isPanelDragging.value || !panelSheetEl.value) return;
  const shouldClose = panelDragOffset.value > 120;
  panelSheetEl.value.style.transition = "transform 0.18s ease";
  if (shouldClose) {
    panelSheetEl.value.style.transform = "translateY(100%)";
    window.setTimeout(() => {
      activePanel.value = null;
      resetPanelTransform();
    }, 180);
  } else {
    panelSheetEl.value.style.transform = "translateY(0)";
  }
  isPanelDragging.value = false;
  panelDragOffset.value = 0;
};

watch(
  () => activePanel.value,
  (value) => {
    if (!value) return;
    void nextTick(() => {
      resetPanelTransform();
    });
  }
);

selectTheme(activeThemeId.value, false);
selectFont(activeFontId.value, false);
applyFontSize(fontSize.value, false);
applyLineHeight(lineHeight.value, false);
</script>

<style scoped>
:global(body.body--reader) {
  margin: 0;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  overscroll-behavior: none;
}

.reader-shell {
  min-height: 100dvh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--reader-bg, #fff8dc);
  color: var(--reader-text, #1f2937);
}

.api-error-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  max-width: min(90vw, 520px);
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.92);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
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
  background: var(--reader-bg, #fff8dc);
  border: 1px solid var(--reader-border, rgba(203, 167, 71, 0.4));
  overflow: hidden;
}

.page-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid var(--reader-border, rgba(203, 167, 71, 0.4));
  background: var(--reader-panel, rgba(255, 248, 220, 0.85));
  background: color-mix(in srgb, var(--reader-panel, #ffffff) 88%, transparent);
  color: var(--reader-text, #a66a09);
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
  box-shadow: 0 10px 30px rgba(166, 106, 9, 0.2);
  background: var(--reader-panel, rgba(255, 248, 220, 0.95));
  background: color-mix(in srgb, var(--reader-panel, #ffffff) 96%, transparent);
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
  background: var(--reader-bg, #fff8dc);
}

.reader-topbar {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  right: 16px;
  left: 16px;
  display: flex;
  justify-content: flex-end;
  z-index: 6;
  pointer-events: none;
}

.topbar-actions {
  display: flex;
  gap: 6px;
  pointer-events: auto;
  padding: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--reader-panel, #ffffff) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--reader-border, #e5e7eb) 70%, transparent);
  backdrop-filter: blur(10px) saturate(140%);
}

.topbar-button {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--reader-text, #1f2937);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease,
    transform 0.12s ease;
}

.topbar-button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.topbar-button:hover {
  background: color-mix(in srgb, var(--reader-bg, #fff8dc) 60%, transparent);
  border-color: color-mix(in srgb, var(--reader-border, #e5e7eb) 70%, transparent);
}

.topbar-text {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
}

.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(4px);
  z-index: 7;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overscroll-behavior: contain;
}

.panel-sheet {
  width: min(560px, 100%);
  max-height: min(86dvh, 86vh);
  background: var(--reader-panel, #ffffff);
  color: var(--reader-text, #1f2937);
  border-radius: 22px 22px 0 0;
  padding: 10px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -12px 30px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  overscroll-behavior: contain;
}

.panel-handle {
  width: 42px;
  height: 5px;
  border-radius: 999px;
  background: var(--reader-muted, #b7791f);
  background: color-mix(in srgb, var(--reader-muted, #b7791f) 60%, transparent);
  margin: 6px auto 12px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(min(86dvh, 86vh) - 40px);
  overflow: auto;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

@media (min-width: 960px) {
  .panel-overlay {
    justify-content: flex-end;
    align-items: stretch;
    background: rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(2px);
  }

  .panel-sheet {
    width: min(360px, 38vw);
    max-height: 100dvh;
    height: 100%;
    border-radius: 18px 0 0 18px;
    padding: 18px 20px 20px;
    box-shadow: -10px 0 30px rgba(15, 23, 42, 0.18);
  }

  .panel-content {
    max-height: calc(100dvh - 48px);
    padding-bottom: 8px;
  }

  .panel-handle {
    display: none;
  }
}

.panel-content h3 {
  margin: 0;
  font-size: 16px;
}

.panel-empty {
  padding: 18px;
  border-radius: 12px;
  border: 1px dashed var(--reader-border, #e5e7eb);
  color: var(--reader-muted, #6b7280);
  text-align: center;
}

.toc-item {
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  color: inherit;
  cursor: pointer;
  transition: background 0.12s ease;
}

.toc-item:hover {
  background: rgba(0, 0, 0, 0.06);
  background: color-mix(in srgb, var(--reader-bg, #fff8dc) 65%, transparent);
}

.toc-title {
  display: block;
  font-size: 14px;
  line-height: 1.4;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.theme-card {
  border: 1px solid var(--reader-border, #e5e7eb);
  border-radius: 14px;
  padding: 14px;
  background: var(--theme-bg);
  color: var(--theme-text);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.theme-card.active {
  outline:1px solid var(--reader-text, #1f2937);
  outline-offset: -1px;
}

.theme-title {
  font-size: 18px;
  font-weight: 700;
}

.theme-label {
  font-size: 13px;
  opacity: 0.8;
}

.type-preview {
  border-radius: 18px;
  padding: 20px;
  border: 1px solid var(--reader-border, #e5e7eb);
  color: inherit;
}

.type-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.type-label {
  font-size: 13px;
  color: var(--reader-muted, #6b7280);
}

.font-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.font-option {
  border: 1px solid var(--reader-border, #e5e7eb);
  border-radius: 12px;
  padding: 12px 14px;
  background: transparent;
  color: inherit;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.font-option.active {
  background: rgba(0, 0, 0, 0.06);
  background: color-mix(in srgb, var(--reader-bg, #fff8dc) 80%, transparent);
  border-color: var(--reader-text, #1f2937);
}

.font-sample {
  font-size: 16px;
  font-weight: 600;
}

.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--reader-border, #e5e7eb);
  border-radius: 14px;
  padding: 10px 12px;
}

.stepper button {
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 15px;
  color: inherit;
  cursor: pointer;
}

.stepper-value {
  font-weight: 600;
  font-size: 14px;
}

.mode-chip-group {
  display: flex;
  gap: 8px;
}

.mode-chip {
  border: 1px solid var(--reader-border, #e5e7eb);
  border-radius: 999px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--reader-bg, #fff8dc) 82%, transparent);
  color: var(--reader-text, #1f2937);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.mode-chip.active {
  background: color-mix(in srgb, var(--reader-muted, #a8742f) 22%, #ffffff);
  border-color: var(--reader-muted, #a8742f);
  font-weight: 600;
}

.mode-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mode-hint {
  font-size: 12px;
  color: var(--reader-muted, #6b7280);
}

@media (max-width: 720px) {
  .reader-shell {
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
