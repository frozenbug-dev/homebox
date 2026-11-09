<script setup lang="ts">
  import type { Component, HTMLAttributes } from "vue";
  import { cn } from "@/lib/utils";

  /**
   * A small rounded label: tags, places, quantities, prices. Give it a
   * `color` (any CSS color) to tint it, and an `icon` to lead with. Render it
   * as a button (`as="button"`) to make it clickable; `dashed` is for an empty
   * "add one" placeholder.
   */
  const props = withDefaults(
    defineProps<{
      as?: string | Component;
      color?: string | null;
      icon?: Component;
      dashed?: boolean;
      class?: HTMLAttributes["class"];
    }>(),
    { as: "span", color: undefined, icon: undefined, class: undefined }
  );

  const style = computed(() =>
    props.color
      ? {
          backgroundColor: `color-mix(in oklab, ${props.color} 14%, transparent)`,
          borderColor: `color-mix(in oklab, ${props.color} 35%, transparent)`,
          color: `color-mix(in oklab, ${props.color} 60%, hsl(var(--foreground)))`,
        }
      : undefined
  );
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? 'button' : undefined"
    :class="
      cn(
        'inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1 rounded-full border text-xs leading-none whitespace-nowrap tabular-nums transition-colors',
        icon ? ($slots.default ? 'pr-2 pl-1.5' : 'px-1.5') : 'px-2',
        !color && 'border-border text-foreground/80',
        dashed && 'border-dashed text-muted-foreground',
        as === 'button' &&
          'cursor-pointer hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:brightness-125',
        as === 'button' && !color && 'hover:bg-accent hover:text-foreground',
        props.class
      )
    "
    :style="style"
  >
    <component :is="icon" v-if="icon" class="size-3.5 shrink-0" aria-hidden="true" />
    <span v-if="$slots.default" class="truncate"><slot /></span>
  </component>
</template>
