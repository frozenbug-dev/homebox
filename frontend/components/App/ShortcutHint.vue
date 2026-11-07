<script setup lang="ts">
  import { formatForDisplay, type RegisterableHotkey } from "@tanstack/vue-hotkeys";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";

  /** Renders a hotkey from lib/shortcuts.ts as keycaps, e.g. "⌘ K" on macOS and "Ctrl K" elsewhere. */
  const props = defineProps<{ hotkey: RegisterableHotkey; class?: string }>();

  const keys = computed(() => {
    const steps = Array.isArray(props.hotkey) ? props.hotkey : [props.hotkey];
    return steps.flatMap(step =>
      formatForDisplay(step as never)
        .split(/[\s+]+/)
        .filter(Boolean)
    );
  });
</script>

<template>
  <KbdGroup :class="props.class" aria-hidden="true">
    <Kbd v-for="(k, i) in keys" :key="i">{{ k }}</Kbd>
  </KbdGroup>
</template>
