<template>
  <div class="user-page">
    <section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">词汇量设置</h2>
          <p class="card-subtitle">调整词汇难度匹配你的阅读水平</p>
        </div>
        <span class="badge" :class="{ 'badge--loading': isLoading }">
          {{ isLoading ? '读取中' : hasLocalLevel ? '已保存' : '未保存' }}
        </span>
      </div>

      <div class="level-display">
        <span class="level-number">{{ vocabularySize }}</span>
        <span class="level-unit">个</span>
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
    </section>

    <button class="save-btn" type="button" :disabled="isSaving" @click="saveLevel">
      {{ isSaving ? '保存中...' : '保存设置' }}
    </button>
    <p v-if="saveStatus" class="save-status">{{ saveStatus }}</p>

    <BottomTabBar active="user" @home="goHome" @add="goHome" @user="goUser" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
const fallbackVocabularySize = 6000

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
  title: '个人中心 · First English Book',
  bodyAttrs: {
    class: 'body--user'
  }
})
</script>

<style scoped>
:global(body.body--user) {
  margin: 0;
  background: #f7f4ef;
  color: #1d1b20;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

.user-page {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 16px 20px calc(120px + env(safe-area-inset-bottom, 0px));
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  margin: 0;
  font-size: 18px;
}

.card-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6f6f6f;
}

.badge {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #e9f6ef;
  color: #2f6f4f;
  font-weight: 600;
}

.badge--loading {
  background: #fcefdc;
  color: #9b5a1f;
}

.level-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 32px;
  font-weight: 700;
  color: #1d1b20;
}

.level-unit {
  font-size: 14px;
  color: #6f6f6f;
  font-weight: 500;
}

.level-range {
  width: 100%;
  accent-color: #1d1b20;
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
  width: 140px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  padding: 0 12px;
  font-size: 14px;
}

.save-btn {
  width: 100%;
  border: none;
  height: 48px;
  border-radius: 16px;
  background: #1d1b20;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.save-status {
  margin: 0;
  font-size: 12px;
  color: #6f6f6f;
  text-align: center;
}
</style>
