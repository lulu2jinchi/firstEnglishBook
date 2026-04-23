<template>
  <div class="reader-shell" :style="themeVars">
    <div v-if="apiErrorVisible" class="api-error-toast" role="status" aria-live="polite">
      {{ apiErrorMessage }}
    </div>

    <header class="reader-topbar" aria-label="阅读器工具栏">
      <div class="topbar-card">
        <div class="topbar-actions">
          <button
            class="topbar-button mode-button"
            type="button"
            :disabled="isLoading"
            :aria-label="modeButtonText"
            :title="modeButtonText"
            @click="toggleMode"
          >
            <svg v-if="isPaginated" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M8 5.5a1 1 0 0 1 1 1v8.88l2.3-2.29a1 1 0 1 1 1.4 1.42l-4 3.96a1 1 0 0 1-1.4 0l-4-3.96a1 1 0 1 1 1.4-1.42L7 15.38V6.5a1 1 0 0 1 1-1Z"
                fill="currentColor"
              />
              <path
                d="M16 18.5a1 1 0 0 1-1-1V8.62l-2.3 2.29a1 1 0 1 1-1.4-1.42l4-3.96a1 1 0 0 1 1.4 0l4 3.96a1 1 0 1 1-1.4 1.42L17 8.62v8.88a1 1 0 0 1-1 1Z"
                fill="currentColor"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5.5 8a1 1 0 0 1 1-1h8.88L13.1 4.7a1 1 0 1 1 1.42-1.4l3.96 4a1 1 0 0 1 0 1.4l-3.96 4a1 1 0 1 1-1.42-1.4L15.38 9H6.5a1 1 0 0 1-1-1Z"
                fill="currentColor"
              />
              <path
                d="M18.5 16a1 1 0 0 1-1 1H8.62l2.29 2.3a1 1 0 1 1-1.42 1.4l-3.96-4a1 1 0 0 1 0-1.4l3.96-4a1 1 0 1 1 1.42 1.4L8.62 15h8.88a1 1 0 0 1 1 1Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <div class="topbar-tools">
            <button
              class="topbar-button"
              :class="{ 'topbar-button--active': activePanel === 'outline' }"
              type="button"
              aria-label="目录"
              :aria-pressed="activePanel === 'outline'"
              @click="togglePanel('outline')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="3" height="3" rx="1" />
                <rect x="4" y="10.5" width="3" height="3" rx="1" />
                <rect x="4" y="16" width="3" height="3" rx="1" />
                <rect x="9.5" y="5.5" width="10.5" height="2" rx="1" />
                <rect x="9.5" y="11" width="10.5" height="2" rx="1" />
                <rect x="9.5" y="16.5" width="10.5" height="2" rx="1" />
              </svg>
            </button>
            <button
              class="topbar-button"
              :class="{ 'topbar-button--active': activePanel === 'theme' }"
              type="button"
              aria-label="配色"
              :aria-pressed="activePanel === 'theme'"
              @click="togglePanel('theme')"
            >
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
            <button
              class="topbar-button"
              :class="{ 'topbar-button--active': activePanel === 'type' }"
              type="button"
              aria-label="排版"
              :aria-pressed="activePanel === 'type'"
              @click="togglePanel('type')"
            >
              <span class="topbar-text">Aa</span>
            </button>
          </div>
        </div>
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
        tabindex="-1"
        :aria-labelledby="panelTitleId"
        @click.stop
        @touchstart="handlePanelTouchStart"
        @touchmove="handlePanelTouchMove"
        @touchend="handlePanelTouchEnd"
        @touchcancel="handlePanelTouchEnd"
      >
        <div class="panel-handle" />
        <div class="panel-header">
          <div>
            <h3 :id="panelTitleId">{{ panelLabel }}</h3>
          </div>
          <button class="panel-close" type="button" aria-label="关闭面板" @click="closePanel">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div v-if="activePanel === 'outline'" ref="panelContentEl" class="panel-content">
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
          <div class="theme-grid">
            <button
              v-for="theme in themeOptions"
              :key="theme.id"
              type="button"
              class="theme-card"
              :class="{ active: theme.id === activeThemeId }"
              :aria-pressed="theme.id === activeThemeId"
              :style="{
                '--theme-bg': theme.background,
                '--theme-text': theme.text
              }"
              @click="selectTheme(theme.id)"
            >
              <span class="theme-swatch" aria-hidden="true">
                <span class="theme-swatch__bg"></span>
                <span class="theme-swatch__text"></span>
              </span>
              <span class="theme-title">Aa</span>
              <span class="theme-label">{{ theme.label }}</span>
            </button>
          </div>
        </div>

        <div v-else ref="panelContentEl" class="panel-content">
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
            <div class="type-heading">
              <div class="type-label">字体</div>
            </div>
            <div class="font-list">
              <button
                v-for="font in fontOptions"
                :key="font.id"
                type="button"
                class="font-option"
                :class="{ active: font.id === activeFontId }"
                :aria-pressed="font.id === activeFontId"
                :style="{ fontFamily: font.family }"
                @click="selectFont(font.id)"
              >
                <span>{{ font.label }}</span>
                <span class="font-sample">Aa</span>
              </button>
            </div>
          </div>

          <div class="type-section">
            <div class="type-heading">
              <div class="type-label">字号</div>
            </div>
            <div class="stepper">
              <button type="button" aria-label="减小正文字号" @click="bumpFontSize(-1)">A-</button>
              <span class="stepper-value">{{ fontSize }}px</span>
              <button type="button" aria-label="增大正文字号" @click="bumpFontSize(1)">A+</button>
            </div>
          </div>

          <div class="type-section">
            <div class="type-heading">
              <div class="type-label">行高</div>
            </div>
            <div class="stepper">
              <button type="button" aria-label="减小行高" @click="bumpLineHeight(-0.1)">-</button>
              <span class="stepper-value">{{ lineHeight.toFixed(1) }}x</span>
              <button type="button" aria-label="增大行高" @click="bumpLineHeight(0.1)">+</button>
            </div>
          </div>

          <div class="type-section">
            <div class="type-heading">
              <div class="type-label">释义字号</div>
            </div>
            <div class="stepper">
              <button type="button" aria-label="减小释义字号" @click="bumpMeaningFontSize(-1)">A-</button>
              <span class="stepper-value">{{ meaningFontSize }}px</span>
              <button type="button" aria-label="增大释义字号" @click="bumpMeaningFontSize(1)">A+</button>
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
  DEFAULT_MEANING_FONT_SIZE,
  DEFAULT_READER_FONT_SIZE,
  DEFAULT_READER_LINE_HEIGHT,
  MAX_MEANING_FONT_SIZE,
  MAX_READER_FONT_SIZE,
  MAX_READER_LINE_HEIGHT,
  MIN_MEANING_FONT_SIZE,
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
const storageBookKey = ref<string | null>(null);

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
        storageBookKey.value = `upload:${id}`;
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
    storageBookKey.value = null;
    return;
  }

  const raw =
    typeof bookQuery === "string" && bookQuery.trim()
      ? bookQuery
      : "book/Normal People (Sally Rooney) (Z-Library).epub";
  storageBookKey.value = null;
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

const isIOSWeChatWebView = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isWeChat = /MicroMessenger/i.test(ua);
  const isIOSDevice =
    /iP(hone|od|ad)/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);

  return isWeChat && isIOSDevice;
};

const experimentalContinuousScroll = ref(
  parseExperimentalContinuousQuery(route.query.experimentalContinuous) ?? !isIOSWeChatWebView()
);

const syncExperimentalContinuousFromRoute = () => {
  const fromQuery = parseExperimentalContinuousQuery(route.query.experimentalContinuous);
  if (fromQuery === null) return;
  experimentalContinuousScroll.value = fromQuery;
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
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handlePanelEscape);
  }
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
  setMeaningFontSize,
  meaningFontSize: initialMeaningFontSize,
  toggleMode,
  goPrev,
  goNext,
  goToHref,
} = useReader(viewerEl, computed(() => bookPath.value), {
  useExperimentalContinuousScroll: computed(() => experimentalContinuousScroll.value),
  storageBookKey: computed(() => storageBookKey.value),
});

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
    id: "ash",
    label: "浅灰",
    background: "#f3f4f6",
    text: "#1f2937",
    panel: "#ffffff",
    border: "#d8dde3",
    muted: "#6b7280",
  },
  {
    id: "beige",
    label: "米色",
    background: "#efe9d8",
    text: "#3e3120",
    panel: "#f5efdf",
    border: "#e1d5bc",
    muted: "#8a7352",
  },
  {
    id: "mint",
    label: "浅绿",
    background: "#c9e7c9",
    text: "#1f3523",
    panel: "#d6edd5",
    border: "#add4ad",
    muted: "#487550",
  },
  {
    id: "night",
    label: "夜间",
    background: "#0b0d11",
    text: "#e8eef8",
    panel: "#151922",
    border: "#2a3242",
    muted: "#87b7ff",
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
const meaningFontSizeStorageKey = "first-english-book-meaning-font-size";
const readerPreferencesVersionStorageKey = "first-english-book-reader-preferences-version";
const readerPreferencesVersion = "2";
const legacyDefaultReaderFontSize = 16;
const legacyDefaultReaderLineHeight = 1.6;
const legacyDefaultMeaningFontSize = 14;
const minFontSize = MIN_READER_FONT_SIZE;
const maxFontSize = MAX_READER_FONT_SIZE;
const minLineHeight = MIN_READER_LINE_HEIGHT;
const maxLineHeight = MAX_READER_LINE_HEIGHT;
const minMeaningFontSize = MIN_MEANING_FONT_SIZE;
const maxMeaningFontSize = MAX_MEANING_FONT_SIZE;

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

const shouldUpgradeLegacyValue = (value: number, legacyDefault: number) => {
  return Number(Math.abs(value - legacyDefault).toFixed(4)) === 0;
};

const migrateLegacyReaderPreferences = () => {
  if (typeof window === "undefined") return;
  const currentVersion = getStorageValue(readerPreferencesVersionStorageKey);
  if (currentVersion === readerPreferencesVersion) return;

  const migrateNumberPreference = (
    key: string,
    legacyDefault: number,
    nextDefault: number,
    min: number,
    max: number
  ) => {
    const raw = getStorageValue(key);
    if (raw === null || raw.trim() === "") {
      setStorageValue(key, String(nextDefault));
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setStorageValue(key, String(nextDefault));
      return;
    }
    if (shouldUpgradeLegacyValue(parsed, legacyDefault)) {
      setStorageValue(key, String(nextDefault));
      return;
    }
    const clamped = clampNumber(parsed, min, max);
    if (clamped !== parsed) {
      setStorageValue(key, String(clamped));
    }
  };

  migrateNumberPreference(
    readerFontSizeStorageKey,
    legacyDefaultReaderFontSize,
    DEFAULT_READER_FONT_SIZE,
    minFontSize,
    maxFontSize
  );
  migrateNumberPreference(
    readerLineHeightStorageKey,
    legacyDefaultReaderLineHeight,
    DEFAULT_READER_LINE_HEIGHT,
    minLineHeight,
    maxLineHeight
  );
  migrateNumberPreference(
    meaningFontSizeStorageKey,
    legacyDefaultMeaningFontSize,
    DEFAULT_MEANING_FONT_SIZE,
    minMeaningFontSize,
    maxMeaningFontSize
  );
  setStorageValue(readerPreferencesVersionStorageKey, readerPreferencesVersion);
};

migrateLegacyReaderPreferences();

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
const meaningFontSize = ref(
  clampNumber(
    parseStoredNumber(
      getStorageValue(meaningFontSizeStorageKey),
      initialMeaningFontSize.value || DEFAULT_MEANING_FONT_SIZE
    ),
    minMeaningFontSize,
    maxMeaningFontSize
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
const panelTitleId = computed(() => `reader-panel-title-${activePanel.value || "none"}`);

const togglePanel = (panel: "outline" | "theme" | "type") => {
  activePanel.value = activePanel.value === panel ? null : panel;
};

const closePanel = () => {
  activePanel.value = null;
  resetPanelTransform();
};
const handlePanelEscape = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    closePanel();
  }
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

const applyMeaningFontSize = (value: number, persist = true) => {
  const next = clampNumber(value, minMeaningFontSize, maxMeaningFontSize);
  meaningFontSize.value = next;
  setMeaningFontSize(next);
  if (persist) {
    setStorageValue(meaningFontSizeStorageKey, String(next));
  }
};

const bumpMeaningFontSize = (delta: number) => {
  applyMeaningFontSize(meaningFontSize.value + delta);
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
    if (typeof window !== "undefined") {
      if (value) {
        window.addEventListener("keydown", handlePanelEscape);
      } else {
        window.removeEventListener("keydown", handlePanelEscape);
      }
    }
    if (!value) return;
    void nextTick(() => {
      resetPanelTransform();
      panelSheetEl.value?.focus();
    });
  }
);

selectTheme(activeThemeId.value, false);
selectFont(activeFontId.value, false);
applyFontSize(fontSize.value, false);
applyLineHeight(lineHeight.value, false);
applyMeaningFontSize(meaningFontSize.value, false);
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
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  max-width: min(90vw, 520px);
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.92);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
}

.reader-body {
  flex: 1;
  min-height: 0;
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
  z-index: 10;
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
  right: 12px;
  left: auto;
  z-index: 20;
  pointer-events: none;
}

.topbar-card {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  pointer-events: auto;
  padding: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--reader-panel, #ffffff) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--reader-border, #e5e7eb) 70%, transparent);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.1);
}

.panel-header h3 {
  margin: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.topbar-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar-button {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--reader-text, #1f2937);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.topbar-button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.topbar-button:hover,
.topbar-button--active {
  background: color-mix(in srgb, var(--reader-bg, #fff8dc) 60%, transparent);
  border-color: color-mix(in srgb, var(--reader-border, #e5e7eb) 70%, transparent);
}

.mode-button {
  background: color-mix(in srgb, var(--reader-bg, #fff8dc) 72%, transparent);
  border-color: color-mix(in srgb, var(--reader-border, #e5e7eb) 55%, transparent);
}

.mode-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.topbar-button:focus-visible,
.panel-close:focus-visible,
.toc-item:focus-visible,
.theme-card:focus-visible,
.font-option:focus-visible,
.stepper button:focus-visible {
  outline: 2px solid var(--reader-text, #0f172a);
  outline-offset: 2px;
}

.topbar-text {
  font-weight: 700;
  font-size: 14px;
}

.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 20;
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

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-header h3 {
  font-size: 22px;
  line-height: 1.1;
  color: inherit;
}

.panel-close {
  width: 36px;
  height: 36px;
  border: 1px solid var(--reader-border, #e5e7eb);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
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
    max-height: calc(100dvh - 110px);
    padding-bottom: 8px;
  }

  .panel-handle {
    display: none;
  }
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
}

.theme-swatch {
  width: 100%;
  height: 44px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-text) 18%, transparent);
  background: color-mix(in srgb, var(--theme-bg) 92%, white 8%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  box-sizing: border-box;
}

.theme-swatch__bg,
.theme-swatch__text {
  display: block;
  border-radius: 999px;
  background: var(--theme-text);
}

.theme-swatch__bg {
  width: 18px;
  height: 18px;
  opacity: 0.3;
}

.theme-swatch__text {
  width: 54px;
  height: 4px;
  opacity: 0.8;
}

.theme-card.active {
  outline: 2px solid color-mix(in srgb, var(--theme-text) 70%, white 30%);
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

.type-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
}

.type-label {
  font-size: 14px;
  font-weight: 600;
  color: inherit;
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
  min-width: 40px;
  min-height: 40px;
  border: 1px solid var(--reader-border, #e5e7eb);
  border-radius: 10px;
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

@media (max-width: 720px) {
  .reader-topbar {
    right: 10px;
  }

  .page-button {
    width: 38px;
    height: 56px;
  }

  .type-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
