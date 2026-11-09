<script setup lang="ts">
  /** A titled card of settings rows or list rows, divided by hairlines. */
  defineProps<{ title?: string; hint?: string }>();
</script>

<template>
  <div>
    <div v-if="title || hint || $slots.actions" class="mx-0.5 mb-2.5 flex items-center justify-between gap-3">
      <h2 v-if="title" class="text-sm font-semibold">{{ title }}</h2>
      <span v-if="hint" class="text-[12.5px] text-muted-foreground">{{ hint }}</span>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <slot />
    </div>
  </div>
</template>
