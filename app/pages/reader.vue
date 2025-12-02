<template>
  <ReaderShell />
</template>

<script setup lang="ts">
import { useHead } from "#imports";
import ReaderShell from "~/components/ReaderShell.vue";

useHead({
  bodyAttrs: {
    class: "body--reader",
  },
});
</script>
