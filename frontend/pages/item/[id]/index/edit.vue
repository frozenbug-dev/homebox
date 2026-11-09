<script setup lang="ts">
  /** Everything is edited on the item page now; old links and bookmarks land there. */
  definePageMeta({
    middleware: ["auth"],
    redirect: to => `/item/${to.params.id}`,
  });
</script>

<template>
  <div />
</template>
