<script setup lang="ts">
  // Backwards compatibility redirect from /label/:id to the tag on /tags
  const route = useRoute();
  const tagId = route.params.id as string;

  // Redirect to the new tag route
  await navigateTo({ path: "/tags", query: { tag: tagId } }, { replace: true, redirectCode: 308 });
</script>

<template>
  <div></div>
</template>
