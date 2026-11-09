<script setup lang="ts">
  import { cn } from "@/lib/utils";

  /**
   * The bar under the page header that holds a page's filters, tabs and counts.
   * Every page uses this one so the bars line up at the same height; it wraps
   * onto more lines on narrow screens instead of overflowing.
   */
  const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    :class="
      cn(
        'flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] sm:px-4',
        props.class
      )
    "
  >
    <slot />
  </div>
</template>
