<script setup lang="ts">
  import type { RegisterableHotkey } from "@tanstack/vue-hotkeys";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";

  defineProps<{ hotkey?: RegisterableHotkey; destructive?: boolean }>();
  const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="flex h-8 items-center gap-2 rounded-lg px-2.5 hover:bg-background/15"
    :class="{ 'text-destructive': destructive }"
    @click="emit('click')"
  >
    <slot />
    <ShortcutHint v-if="hotkey" :hotkey="hotkey" class="[&_kbd]:bg-background/15 [&_kbd]:text-background" />
  </button>
</template>
