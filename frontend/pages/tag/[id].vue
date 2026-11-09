<script setup lang="ts">
  /**
   * Tags are viewed and edited on /tags now. Old links to /tag/{id} land on that tag there.
   */
  definePageMeta({
    middleware: [
      "auth",
      to =>
        navigateTo(
          { path: "/tags", query: { tag: String(to.params.id ?? "") || undefined } },
          { replace: true, redirectCode: 301 }
        ),
    ],
  });
</script>

<template>
  <div />
</template>
