<template>
  <nav class="tab-bar" aria-label="底部导航">
    <button
      class="tab"
      type="button"
      :aria-current="active === 'home' ? 'page' : undefined"
      :class="{ 'tab--active': active === 'home' }"
      @click="emit('home')"
    >
      <i class="fa-solid fa-house tab-icon" aria-hidden="true"></i>
      <span class="tab-label">书架</span>
    </button>
    <button class="tab add-btn" type="button" aria-label="导入 EPUB" @click="emit('add')">
      <i class="fa-solid fa-plus tab-icon" aria-hidden="true"></i>
      <span class="tab-label">导入</span>
    </button>
    <button
      class="tab"
      type="button"
      :aria-current="active === 'user' ? 'page' : undefined"
      :class="{ 'tab--active': active === 'user' }"
      @click="emit('user')"
    >
      <i class="fa-solid fa-gear tab-icon" aria-hidden="true"></i>
      <span class="tab-label">设置</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  active: 'home' | 'user'
}>()

const emit = defineEmits<{
  (event: 'home'): void
  (event: 'add'): void
  (event: 'user'): void
}>()
</script>

<style scoped>
.tab-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 88px;
  padding: 10px 12px calc(14px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-bottom: none;
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 30px rgba(15, 23, 42, 0.08);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: stretch;
  justify-items: center;
  box-sizing: border-box;
  z-index: 20;
}

.tab {
  border: none;
  background: transparent;
  width: 100%;
  min-width: 0;
  padding: 8px 10px 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  border-radius: 16px;
  transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.tab-icon {
  font-size: 20px;
}

.tab-label {
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
}

.tab:focus-visible {
  outline: 2px solid #111827;
  outline-offset: -2px;
}

.tab--active {
  color: #0f172a;
  background: #f8fafc;
}

.tab--active .tab-icon,
.tab--active .tab-label {
  color: inherit;
}

.add-btn {
  color: #ffffff;
  background: #111827;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
}

.add-btn .tab-icon,
.add-btn .tab-label {
  color: inherit;
}

.tab:not(.add-btn):active {
  transform: translateY(1px);
}

.add-btn:active {
  transform: translateY(1px);
}
</style>
