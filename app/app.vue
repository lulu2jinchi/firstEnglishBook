<template>
  <div class="app-shell">
    <NuxtPage />
    <div v-if="showModelConfigModal" class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal-card">
        <h2>需要配置大模型</h2>
        <p>检测到当前浏览器还没有配置 Base URL、API Key 与模型名称。</p>
        <div class="modal-actions">
          <button class="primary-btn" type="button" @click="goToSettings">前往设置</button>
          <button class="ghost-btn" type="button" @click="dismissModal">稍后再说</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const modelConfigStorageKey = 'first-english-book-model-config'

const router = useRouter()
const route = useRoute()
const dismissed = ref(false)
const missingModelConfig = ref(false)

const isSettingsRoute = computed(() => route.path === '/user')
const showModelConfigModal = computed(
  () => !dismissed.value && missingModelConfig.value && !isSettingsRoute.value
)

const readLocalModelConfig = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(modelConfigStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { baseUrl?: string; apiKey?: string; model?: string }
    const baseUrl = parsed.baseUrl?.trim() || ''
    const apiKey = parsed.apiKey?.trim() || ''
    const model = parsed.model?.trim() || ''
    if (!baseUrl || !apiKey || !model) return null
    return { baseUrl, apiKey, model }
  } catch {
    return null
  }
}

const refreshModelConfigStatus = () => {
  missingModelConfig.value = !readLocalModelConfig()
}

const dismissModal = () => {
  dismissed.value = true
}

const goToSettings = () => {
  dismissed.value = true
  router.push('/user')
}

const handleStorage = (event: StorageEvent) => {
  if (event.key !== modelConfigStorageKey) return
  refreshModelConfigStatus()
}

watch(
  () => route.path,
  () => {
    dismissed.value = false
    refreshModelConfigStatus()
  },
  { immediate: true }
)

onMounted(() => {
  refreshModelConfigStatus()
  window.addEventListener('storage', handleStorage)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorage)
})
</script>

<style scoped>
.app-shell {
  min-height: 100dvh;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(13, 10, 6, 0.45);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  width: min(360px, 100%);
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #1d1b20;
}

.modal-card h2 {
  margin: 0;
  font-size: 18px;
}

.modal-card p {
  margin: 0;
  font-size: 13px;
  color: #6f6f6f;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.primary-btn {
  border: none;
  background: #1d1b20;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ghost-btn {
  border: 1px solid #ded4c7;
  background: #f7f2eb;
  color: #6b4d2a;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}
</style>
