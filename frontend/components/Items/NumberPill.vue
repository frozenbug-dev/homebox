<script setup lang="ts">
  import type { Component } from "vue";
  import { Pill } from "@/components/ui/pill";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

  /**
   * A number shown as a pill; click it to edit in a small popover. Enter saves,
   * Escape or clicking away cancels. The default slot formats the value.
   */
  const props = withDefaults(
    defineProps<{
      value: number;
      label: string;
      icon?: Component;
    }>(),
    { icon: undefined }
  );
  const emit = defineEmits<{ commit: [value: number] }>();

  const open = ref(false);
  const draft = ref("");
  const input = ref<HTMLInputElement>();

  watch(open, async o => {
    if (!o) return;
    draft.value = String(props.value);
    await nextTick();
    input.value?.select();
  });

  function save() {
    open.value = false;
    const n = Number(draft.value.replace(",", "."));
    if (draft.value.trim() === "" || !Number.isFinite(n) || n < 0 || n === props.value) return;
    emit("commit", n);
  }
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Pill as="button" :icon="icon" :aria-label="label" @click.stop>
        <slot />
      </Pill>
    </PopoverTrigger>
    <PopoverContent class="w-48 p-2" align="end" @click.stop @open-auto-focus.prevent>
      <form class="flex flex-col gap-1.5" @submit.prevent="save">
        <label class="px-0.5 text-xs font-medium text-muted-foreground">{{ label }}</label>
        <input
          ref="input"
          v-model="draft"
          type="text"
          inputmode="decimal"
          :aria-label="label"
          class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.stop
          @keydown.esc.prevent="open = false"
        />
      </form>
    </PopoverContent>
  </Popover>
</template>
