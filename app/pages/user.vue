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
        <button class="ghost-btn" type="button" @click="resetToSuggested">
          恢复建议
        </button>
      </div>

      <div class="level-hint">
        <p>提示词描述：{{ levelTextPreview }}</p>
        <p v-if="currentLevelText">当前提示词：{{ currentLevelText }}</p>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">大模型设置</h2>
          <p class="card-subtitle">配置接口地址、密钥与模型名称</p>
        </div>
        <span class="badge" :class="{ 'badge--loading': isModelLoading }">
          {{ isModelLoading ? '读取中' : hasModelConfig ? '已配置' : '未配置' }}
        </span>
      </div>

      <div class="form-grid">
        <label class="form-field">
          <span>Base URL</span>
          <input
            v-model.trim="modelBaseUrl"
            type="url"
            placeholder="https://api.example.com/v1"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
        <label class="form-field">
          <span>API Key</span>
          <input
            v-model.trim="modelApiKey"
            :type="apiKeyInputType"
            placeholder="sk-..."
            autocomplete="off"
            spellcheck="false"
          />
        </label>
        <label class="form-field">
          <span>模型名称</span>
          <input
            v-model.trim="modelName"
            type="text"
            placeholder="gpt-4.1-nano"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
      </div>

      <div class="config-actions">
        <button class="ghost-btn" type="button" @click="toggleApiKey">
          {{ showApiKey ? '隐藏密钥' : '显示密钥' }}
        </button>
      </div>
      <p v-if="modelStatus" class="save-status">{{ modelStatus }}</p>
    </section>

    <button class="save-btn" type="button" :disabled="isAnySaving" @click="saveAll">
      {{ isAnySaving ? '保存中...' : '保存设置' }}
    </button>
    <p v-if="saveStatus" class="save-status">{{ saveStatus }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHead } from '#imports'
import { useRouter } from 'vue-router'

const router = useRouter()
const minVocabularySize = 1000
const maxVocabularySize = 20000
const rangeStep = 500
const inputStep = 100
const fallbackVocabularySize = 6000
const vocabularyStorageKey = 'first-english-book-vocabulary-size'
const modelConfigStorageKey = 'first-english-book-model-config'

const vocabularySize = ref(fallbackVocabularySize)
const suggestedVocabularySize = ref(fallbackVocabularySize)
const currentLevelText = ref('')
const saveStatus = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const hasLocalLevel = ref(false)

const modelBaseUrl = ref('')
const modelApiKey = ref('')
const modelName = ref('')
const modelStatus = ref('')
const isModelLoading = ref(false)
const isModelSaving = ref(false)
const showApiKey = ref(false)

const levelTextPreview = computed(() => `词汇量约 ${vocabularySize.value} 个`)
const apiKeyInputType = computed(() => (showApiKey.value ? 'text' : 'password'))
const hasModelConfig = computed(
  () => Boolean(modelBaseUrl.value && modelApiKey.value && modelName.value)
)
const isAnySaving = computed(() => isSaving.value || isModelSaving.value)

const clampVocabularySize = (value: number) => {
  if (!Number.isFinite(value)) return fallbackVocabularySize
  return Math.min(maxVocabularySize, Math.max(minVocabularySize, Math.round(value)))
}

const resetToSuggested = () => {
  vocabularySize.value = suggestedVocabularySize.value
}

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '')

const readLocalVocabularySize = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(vocabularyStorageKey)
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return clampVocabularySize(parsed)
  } catch {
    return null
  }
}

const readLocalModelConfig = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(modelConfigStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      baseUrl?: string
      apiKey?: string
      model?: string
    }
    const baseUrl = parsed.baseUrl?.trim() || ''
    const apiKey = parsed.apiKey?.trim() || ''
    const model = parsed.model?.trim() || ''
    if (!baseUrl && !apiKey && !model) return null
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey,
      model
    }
  } catch {
    return null
  }
}

const loadLevel = async () => {
  isLoading.value = true
  saveStatus.value = ''
  try {
    const localValue = readLocalVocabularySize()
    vocabularySize.value = localValue ?? fallbackVocabularySize
    suggestedVocabularySize.value = fallbackVocabularySize
    currentLevelText.value = levelTextPreview.value
    hasLocalLevel.value = typeof localValue === 'number'
  } catch {
    saveStatus.value = '读取本地词汇量失败，请检查浏览器存储权限'
  } finally {
    isLoading.value = false
  }
}

const loadModelConfig = async () => {
  isModelLoading.value = true
  modelStatus.value = ''
  try {
    const localConfig = readLocalModelConfig()
    modelBaseUrl.value = localConfig?.baseUrl || ''
    modelApiKey.value = localConfig?.apiKey || ''
    modelName.value = localConfig?.model || ''
  } catch {
    modelStatus.value = '读取模型配置失败，请检查浏览器存储权限'
  } finally {
    isModelLoading.value = false
  }
}

const saveLevel = async () => {
  isSaving.value = true
  saveStatus.value = ''
  try {
    const normalized = clampVocabularySize(vocabularySize.value)
    if (typeof window === 'undefined') {
      throw new Error('localStorage 不可用')
    }
    window.localStorage.setItem(vocabularyStorageKey, String(normalized))
    vocabularySize.value = normalized
    currentLevelText.value = levelTextPreview.value
    hasLocalLevel.value = true
    saveStatus.value = '已保存到浏览器'
  } catch {
    saveStatus.value = '保存失败，请检查浏览器存储权限'
  } finally {
    isSaving.value = false
  }
}

const saveModelConfig = async () => {
  const baseUrl = normalizeBaseUrl(modelBaseUrl.value)
  const apiKey = modelApiKey.value.trim()
  const model = modelName.value.trim()

  if (!baseUrl || !apiKey || !model) {
    modelStatus.value = '请填写完整的 Base URL、API Key 与模型名称'
    return
  }

  isModelSaving.value = true
  modelStatus.value = ''
  try {
    if (typeof window === 'undefined') {
      throw new Error('localStorage 不可用')
    }
    const payload = { baseUrl, apiKey, model }
    window.localStorage.setItem(modelConfigStorageKey, JSON.stringify(payload))
    modelBaseUrl.value = baseUrl
    modelApiKey.value = apiKey
    modelName.value = model
    modelStatus.value = '模型配置已保存（仅当前浏览器）'
  } catch {
    modelStatus.value = '保存模型配置失败，请检查浏览器存储权限'
  } finally {
    isModelSaving.value = false
  }
}

const saveAll = async () => {
  await saveLevel()
  await saveModelConfig()
}

const toggleApiKey = () => {
  showApiKey.value = !showApiKey.value
}

const goHome = () => {
  router.push('/home')
}

onMounted(() => {
  void loadLevel()
  void loadModelConfig()
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

.form-grid {
  display: grid;
  gap: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #6f6f6f;
}

.form-field input {
  height: 38px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  padding: 0 12px;
  font-size: 14px;
  color: #1d1b20;
  background: #ffffff;
}

.form-field input::placeholder {
  color: #b3b3b3;
}

.config-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
