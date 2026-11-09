<script setup lang="ts">
  /**
   * `/collection` is the section list on phones. Wider screens show the list
   * beside a section anyway, so they open General.
   */
  definePageMeta({ middleware: ["auth"] });

  onMounted(() => {
    if (window.matchMedia("(width >= 48rem)").matches) void navigateTo("/collection/settings", { replace: true });
  });
</script>

<template>
  <div />
</template>
