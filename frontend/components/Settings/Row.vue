<script setup lang="ts">
  /**
   * A setting: its label and help text on the left, its control on the right.
   * Wraps the control under the text on narrow screens. Pass `for` to make the
   * label point at the control's input.
   */
  defineProps<{ title: string; description?: string; for?: string; align?: "center" | "start" }>();
</script>

<template>
  <div class="flex flex-wrap gap-x-8 gap-y-3 px-5 py-4" :class="align === 'start' ? 'items-start' : 'items-center'">
    <div class="min-w-0 flex-[1_1_16rem]">
      <component :is="$props.for ? 'label' : 'div'" :for="$props.for" class="block text-sm font-medium">
        {{ title }}
      </component>
      <div v-if="description || $slots.description" class="mt-0.5 text-[13px] text-muted-foreground">
        <slot name="description">{{ description }}</slot>
      </div>
      <slot name="extra" />
    </div>
    <div class="flex min-w-48 flex-[0_1_18rem] justify-end gap-2">
      <slot />
    </div>
  </div>
</template>
