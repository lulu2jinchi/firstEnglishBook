<template>
  <div class="user-page">
    <header class="page-header">
      <button class="icon-btn" type="button" aria-label="返回首页" @click="goHome">
        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
      </button>
      <h1 class="page-title">个人中心</h1>
      <span class="header-spacer" aria-hidden="true"></span>
    </header>

    <section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">词汇量设置</h2>
          <p class="card-subtitle">调整词汇难度匹配你的阅读水平</p>
        </div>
        <span class="badge" :class="{ 'badge--loading': isLoading }">
          {{ isLoading ? '同步中' : '已同步' }}
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
        <button class="ghost-btn" type="button" @click="resetToSuggested">
          恢复建议
        </button>
      </div>

      <div class="level-hint">
        <p>提示词描述：{{ levelTextPreview }}</p>
        <p v-if="currentLevelText">当前提示词：{{ currentLevelText }}</p>
      </div>
    </section>

    <button class="save-btn" type="button" :disabled="isSaving" @click="saveLevel">
      {{ isSaving ? '保存中...' : '保存设置' }}
    </button>
    <p v-if="saveStatus" class="save-status">{{ saveStatus }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHead } from '#imports'
import { useRouter } from 'vue-router'

type ReaderLevelResponse = {
  levelText: string
  vocabularySize: number | null
}

const router = useRouter()
const minVocabularySize = 1000
const maxVocabularySize = 20000
const rangeStep = 500
const inputStep = 100
const fallbackVocabularySize = 6000

const vocabularySize = ref(fallbackVocabularySize)
const suggestedVocabularySize = ref(fallbackVocabularySize)
const currentLevelText = ref('')
const saveStatus = ref('')
const isLoading = ref(false)
const isSaving = ref(false)

const levelTextPreview = computed(() => `词汇量约 ${vocabularySize.value} 个`)

const clampVocabularySize = (value: number) => {
  if (!Number.isFinite(value)) return fallbackVocabularySize
  return Math.min(maxVocabularySize, Math.max(minVocabularySize, Math.round(value)))
}

const resetToSuggested = () => {
  vocabularySize.value = suggestedVocabularySize.value
}

const loadLevel = async () => {
  isLoading.value = true
  saveStatus.value = ''
  try {
    const data = await $fetch<ReaderLevelResponse>('/api/readerLevel')
    if (typeof data.vocabularySize === 'number') {
      const normalized = clampVocabularySize(data.vocabularySize)
      vocabularySize.value = normalized
      suggestedVocabularySize.value = normalized
    } else {
      suggestedVocabularySize.value = fallbackVocabularySize
    }
    if (data.levelText) {
      currentLevelText.value = data.levelText
    }
  } catch (error) {
    saveStatus.value = '读取词汇量失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const saveLevel = async () => {
  isSaving.value = true
  saveStatus.value = ''
  try {
    const normalized = clampVocabularySize(vocabularySize.value)
    const data = await $fetch<ReaderLevelResponse>('/api/readerLevel', {
      method: 'POST',
      body: { vocabularySize: normalized }
    })
    vocabularySize.value = normalized
    currentLevelText.value = data.levelText || levelTextPreview.value
    saveStatus.value = '已保存到 prompt.md'
  } catch (error) {
    saveStatus.value = '保存失败，请检查数值范围'
  } finally {
    isSaving.value = false
  }
}

const goHome = () => {
  router.push('/home')
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
  padding: 16px 20px 32px;
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.header-spacer {
  width: 40px;
  height: 40px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: #ffffff;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-btn i {
  font-size: 16px;
  color: #1d1b20;
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

.ghost-btn {
  border: 1px solid #ded4c7;
  background: #f7f2eb;
  color: #6b4d2a;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.level-hint {
  font-size: 12px;
  color: #6f6f6f;
  line-height: 1.6;
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
