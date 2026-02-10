<template>
  <div ref="viewerEl" class="epub-native-viewer" aria-label="epub-native-viewer" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const viewerEl = ref<HTMLDivElement | null>(null);

const testBookPath =
  "/book/Hold Me Tight Seven Conversations For A Lifetime Of Love (Dr. Sue Johnson) (Z-Library).epub";

let book: any = null;
let rendition: any = null;

onMounted(async () => {
  const container = viewerEl.value;
  if (!container) return;
  const { default: ePub } = await import("epubjs");
  const encodedPath = encodeURI(testBookPath);
  book = ePub(encodedPath);
  rendition = book.renderTo(container, {
    width: "100%",
    height: "100%",
    manager: "continuous",
    flow: "scrolled-continuous",
  });
  await rendition.display();
});

onBeforeUnmount(() => {
  rendition?.destroy?.();
  book?.destroy?.();
  rendition = null;
  book = null;
});
</script>

<style scoped>
.epub-native-viewer {
  width: 100vw;
  height: 100dvh;
}
</style>
