<template>
  <nav class="tab-bar" aria-label="底部导航">
    <button
      class="tab"
      type="button"
      aria-label="首页"
      :class="{ 'tab--active': active === 'home' }"
      @click="emit('home')"
    >
      <i class="fa-solid fa-house tab-icon" aria-hidden="true"></i>
    </button>
    <button class="tab add-btn" type="button" aria-label="添加" @click="emit('add')">
      <i class="fa-solid fa-plus tab-icon" aria-hidden="true"></i>
    </button>
    <button
      class="tab"
      type="button"
      aria-label="个人中心"
      :class="{ 'tab--active': active === 'user' }"
      @click="emit('user')"
    >
      <i class="fa-regular fa-user tab-icon" aria-hidden="true"></i>
    </button>
    <div class="home-indicator" aria-hidden="true" />
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
  left: 0;
  right: 0;
  bottom: 0;
  height: 78px;
  padding: 10px 24px calc(16px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 -0.5px 0 rgba(0, 0, 0, 0.1);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: start;
  justify-items: center;
  box-sizing: border-box;
  z-index: 10;
}

.tab {
  border: none;
  background: transparent;
  padding: 12px 20px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tab-icon {
  font-size: 22px;
  color: #1d1b20;
}

.tab--active {
  color: #1d1b20;
  font-weight: 600;
}

.tab--active .tab-icon {
  color: #0f0d12;
}

.add-btn {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  margin-top: -10px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.add-btn .tab-icon {
  font-size: 26px;
}

.home-indicator {
  position: absolute;
  bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: 134px;
  height: 5px;
  background: #000000;
  border-radius: 100px;
}
</style>
