<script setup lang="ts">
  /**
   * Places are viewed and edited on /locations now. Old links (bookmarks,
   * printed labels: /location/{id} and /location/{id}/edit) land on that place there.
   */
  definePageMeta({
    middleware: [
      "auth",
      to => {
        const [id] = ([] as string[]).concat(to.params.path ?? []);
        return navigateTo(id ? { path: "/locations", query: { place: id } } : "/locations", {
          replace: true,
          redirectCode: 301,
        });
      },
    ],
  });
</script>

<template>
  <div />
</template>
