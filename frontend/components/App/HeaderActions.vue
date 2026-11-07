<script setup lang="ts">
  /**
   * Puts its slot into the panel header, right of the command bar, in place of
   * the default Scan / New item buttons. Use it once per page.
   */
  useProvidePageHeaderActions();
</script>

<template>
  <Teleport defer to="#page-header-actions">
    <slot />
  </Teleport>
</template>
