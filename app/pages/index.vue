<template>
  <main class="filing-redirect">
    <p>正在进入书架首页...</p>
    <p>
      若未自动跳转，请点击
      <a href="/home">这里</a>
    </p>
  </main>
</template>

<script setup lang="ts">
if (import.meta.client) {
  window.location.replace('/home')
}
</script>

<style scoped>
.filing-redirect {
  min-height: 100vh;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 10px;
  color: #1f2937;
  padding: 16px;
}

a {
  color: #2563eb;
}
</style>
