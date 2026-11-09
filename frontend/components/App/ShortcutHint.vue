<script setup lang="ts">
  import { formatForDisplay, type RegisterableHotkey } from "@tanstack/vue-hotkeys";
  import { Kbd, KbdGroup } from "@/components/ui/kbd";
  import { cn } from "@/lib/utils";

  /**
   * Renders a hotkey from lib/shortcuts.ts as keycaps, e.g. "⌘ K" on macOS and "Ctrl K" elsewhere.
   * Hidden on phones, where there's no keyboard to press them on.
   */
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
  <KbdGroup :class="cn(props.class, 'max-md:hidden')" aria-hidden="true">
    <Kbd v-for="(k, i) in keys" :key="i">{{ k }}</Kbd>
  </KbdGroup>
</template>
