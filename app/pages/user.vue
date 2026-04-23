<template>
  <div class="user-page">
    <header class="hero-panel">
      <div class="hero-head">
        <div>
          <h1>词汇量设置</h1>
        </div>
        <span class="badge" :class="badgeClass">
          {{ statusBadgeText }}
        </span>
      </div>
    </header>

    <section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">当前阈值</h2>
        </div>
        <p class="level-band">{{ levelBand }}</p>
      </div>

      <div class="level-overview">
        <div class="level-display">
          <span class="level-number">{{ vocabularySize }}</span>
          <span class="level-unit">词</span>
        </div>
      </div>

      <input
        v-model.number="vocabularySize"
        class="level-range"
        type="range"
        :min="minVocabularySize"
        :max="maxVocabularySize"
        :step="rangeStep"
        aria-label="词汇量范围选择"
      />

      <div class="range-ticks" aria-hidden="true">
        <span>{{ minVocabularySize }}</span>
        <span>10000</span>
        <span>{{ maxVocabularySize }}</span>
      </div>

      <div class="preset-group" aria-label="快速预设">
        <button
          v-for="preset in presetOptions"
          :key="preset"
          type="button"
          class="preset-btn"
          :class="{ 'preset-btn--active': vocabularySize === preset }"
          :aria-pressed="vocabularySize === preset"
          @click="selectPreset(preset)"
        >
          {{ preset }}
        </button>
      </div>

      <div class="level-input">
        <label class="input-group">
          <span>手动输入</span>
          <input
            v-model.number="vocabularySize"
            type="number"
            :min="minVocabularySize"
            :max="maxVocabularySize"
            :step="inputStep"
          />
        </label>
      </div>

      <div class="save-row">
        <button class="save-btn" type="button" :disabled="isSaving" @click="saveLevel">
          {{ isSaving ? '保存中...' : '保存设置' }}
        </button>
        <p v-if="saveStatus" class="save-status" :class="{ 'save-status--error': saveStatus.includes('失败') }">
          {{ saveStatus }}
        </p>
      </div>
    </section>

    <BottomTabBar active="user" @home="goHome" @add="goHome" @user="goUser" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHead } from '#imports'
import { useRouter } from 'vue-router'
import BottomTabBar from '~/components/BottomTabBar.vue'
import { VOCABULARY_STORAGE_KEY } from '~/constants/storageKeys'
import {
  broadcastDefinitionCacheBust,
  clearDefinitionCacheSilently
} from '~/utils/readerDefinitionCache'

const router = useRouter()
const minVocabularySize = 1000
const maxVocabularySize = 20000
const rangeStep = 500
const inputStep = 100
const fallbackVocabularySize = 4000
const presetOptions = [3000, 6000, 10000, 15000]

const vocabularySize = ref(fallbackVocabularySize)
const saveStatus = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const hasLocalLevel = ref(false)

type ReaderLevelResponse = {
  vocabularySize?: number | string | null
}

const clampVocabularySize = (value: number) => {
  if (!Number.isFinite(value)) return fallbackVocabularySize
  return Math.min(maxVocabularySize, Math.max(minVocabularySize, Math.round(value)))
}

const levelBand = computed(() => {
  if (vocabularySize.value < 4000) return '更密集释义'
  if (vocabularySize.value < 8000) return '平衡阅读辅助'
  if (vocabularySize.value < 14000) return '偏轻提示'
  return '接近原生阅读'
})

const statusBadgeText = computed(() => {
  if (isLoading.value) return '读取中'
  if (isSaving.value) return '保存中'
  if (saveStatus.value && !saveStatus.value.includes('失败')) return '已同步'
  return hasLocalLevel.value ? '已保存' : '未保存'
})

const badgeClass = computed(() => ({
  'badge--loading': isLoading.value || isSaving.value,
  'badge--success': !isLoading.value && !isSaving.value && (hasLocalLevel.value || Boolean(saveStatus.value && !saveStatus.value.includes('失败'))),
  'badge--idle': !isLoading.value && !isSaving.value && !hasLocalLevel.value && !saveStatus.value,
  'badge--error': Boolean(saveStatus.value && saveStatus.value.includes('失败'))
}))

const readLocalVocabularySize = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(VOCABULARY_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return clampVocabularySize(parsed)
  } catch {
    return null
  }
}

const readServerVocabularySize = async () => {
  try {
    const response = await $fetch<ReaderLevelResponse>('/api/readerLevel')
    const parsed = Number(response?.vocabularySize)
    if (!Number.isFinite(parsed)) return null
    return clampVocabularySize(parsed)
  } catch {
    return null
  }
}

const writeLocalVocabularySize = (value: number) => {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(VOCABULARY_STORAGE_KEY, String(value))
    return true
  } catch {
    return false
  }
}

const writeServerVocabularySize = async (value: number) => {
  try {
    await $fetch('/api/readerLevel', {
      method: 'POST',
      body: {
        vocabularySize: value
      }
    })
    return true
  } catch {
    return false
  }
}

const loadLevel = async () => {
  isLoading.value = true
  saveStatus.value = ''
  try {
    const localValue = readLocalVocabularySize()
    const serverValue = await readServerVocabularySize()
    const resolved = localValue ?? serverValue ?? fallbackVocabularySize
    vocabularySize.value = resolved
    hasLocalLevel.value = typeof localValue === 'number'
    if (localValue === null && typeof serverValue === 'number') {
      hasLocalLevel.value = writeLocalVocabularySize(serverValue)
    }
  } catch {
    saveStatus.value = '读取本地词汇量失败，请检查浏览器存储权限'
  } finally {
    isLoading.value = false
  }
}

const saveLevel = async () => {
  isSaving.value = true
  saveStatus.value = ''
  try {
    const normalized = clampVocabularySize(vocabularySize.value)
    const localSaved = writeLocalVocabularySize(normalized)
    const serverSaved = await writeServerVocabularySize(normalized)

    if (!localSaved && !serverSaved) {
      throw new Error('保存失败')
    }

    vocabularySize.value = normalized
    hasLocalLevel.value = localSaved
    if (localSaved && serverSaved) {
      saveStatus.value = '已保存到浏览器和服务端'
    } else if (localSaved) {
      saveStatus.value = '已保存到浏览器（服务端同步失败）'
    } else {
      saveStatus.value = '已保存到服务端（浏览器存储失败）'
    }
  } catch {
    saveStatus.value = '保存失败，请检查浏览器存储权限与网络'
  } finally {
    await clearDefinitionCacheSilently()
    broadcastDefinitionCacheBust()
    isSaving.value = false
  }
}

const selectPreset = (value: number) => {
  vocabularySize.value = clampVocabularySize(value)
}

const goHome = () => {
  router.push('/home')
}

const goUser = () => {
  router.push('/user')
}

onMounted(() => {
  void loadLevel()
})

useHead({
  title: '阅读设置 · First English Book',
  bodyAttrs: {
    class: 'body--user'
  }
})
</script>

<style scoped>
:global(body.body--user) {
  margin: 0;
  background: #f3f4f6;
  color: #111827;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

.user-page {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 18px 16px calc(132px + env(safe-area-inset-bottom, 0px));
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-panel,
.card,
.tips-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

.hero-panel,
.card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-head,
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hero-head h1,
.card-title {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
}

.save-status {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
}

.badge {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  font-weight: 600;
  white-space: nowrap;
}

.badge--loading {
  background: #fef3c7;
  color: #92400e;
}

.badge--success {
  background: #dcfce7;
  color: #166534;
}

.badge--idle {
  background: #e2e8f0;
  color: #475569;
}

.badge--error {
  background: #fee2e2;
  color: #b91c1c;
}

.level-overview {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.level-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.level-number {
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
  color: #0f172a;
}

.level-unit {
  font-size: 16px;
  color: #64748b;
  font-weight: 500;
}

.level-band {
  margin: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 600;
}

.level-range {
  width: 100%;
  accent-color: #111827;
}

.range-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
}

.preset-group {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.preset-btn {
  min-height: 40px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 12px;
  color: #334155;
  font-weight: 600;
  cursor: pointer;
}

.preset-btn--active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.level-input {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #6f6f6f;
}

.input-group input {
  width: 148px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  padding: 0 12px;
  font-size: 14px;
  color: #0f172a;
}

.save-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.save-btn {
  width: 100%;
  border: none;
  min-height: 48px;
  border-radius: 16px;
  background: #111827;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.save-status--error {
  color: #b91c1c;
}

@media (max-width: 520px) {
  .hero-head,
  .card-header,
  .level-input {
    flex-direction: column;
    align-items: stretch;
  }

  .preset-group {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .input-group input {
    width: 100%;
  }
}
</style>
