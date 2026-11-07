<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { X } from "@lucide/vue";

  /** Floating bar for what's selected in a list; put <ResourceSelectionAction>s in the slot. */
  defineProps<{ count: number }>();
  const emit = defineEmits<{ clear: [] }>();

  const { t } = useI18n();
</script>

<template>
  <Transition
    appear
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
    enter-active-class="transition"
    leave-active-class="transition"
  >
    <div
      role="toolbar"
      :aria-label="t('shell.items_page.selected', { n: count })"
      class="fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-xl bg-foreground p-1.5 text-sm text-background shadow-2xl md:left-[calc(50%+var(--sidebar-width)/2)]"
    >
      <span class="flex items-center gap-1 pr-1 pl-2.5 font-medium">
        {{ t("shell.items_page.selected", { n: count }) }}
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-md text-background/70 hover:bg-background/15 hover:text-background"
          :aria-label="t('shell.shortcuts.selection_clear')"
          @click="emit('clear')"
        >
          <X class="size-3.5" />
        </button>
      </span>
      <slot />
    </div>
  </Transition>
</template>
