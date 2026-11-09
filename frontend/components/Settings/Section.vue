<script setup lang="ts">
  /**
   * One collection settings section: a title, a one-line description and the
   * section's main action on the right, above its groups.
   */
  defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section>
    <header class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-[22px] font-semibold tracking-[-0.015em]">{{ title }}</h1>
        <p v-if="description || $slots.description" class="mt-1 max-w-xl text-sm text-muted-foreground">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div class="flex flex-col gap-8">
      <slot />
    </div>
  </section>
</template>
