<script setup lang="ts">
  import type { HTMLAttributes } from "vue";
  import { EditableArea, EditableInput, EditablePreview, EditableRoot } from "reka-ui";
  import { cn } from "@/lib/utils";

  /**
   * Click-to-edit single line text. Enter or blur saves, Escape reverts.
   * Emits `save` only when the value actually changed.
   */
  const props = defineProps<{
    value: string;
    placeholder?: string;
    class?: HTMLAttributes["class"];
    label?: string;
    wrap?: boolean;
  }>();
  const emit = defineEmits<{ save: [value: string] }>();

  const draft = ref(props.value);
  watch(
    () => props.value,
    v => (draft.value = v)
  );

  function submit(v: string | null | undefined) {
    const next = (v ?? "").trim();
    if (next !== props.value) emit("save", next);
  }
</script>

<template>
  <EditableRoot
    v-model="draft"
    :placeholder="placeholder ?? '—'"
    submit-mode="both"
    activation-mode="focus"
    select-on-focus
    @submit="submit"
  >
    <EditableArea :class="cn('min-w-0 rounded-md px-1.5 py-1 hover:bg-accent has-[input]:bg-background', props.class)">
      <EditablePreview
        class="block w-full cursor-text"
        :class="[wrap ? 'wrap-break-word' : 'truncate', { 'text-muted-foreground': !value }]"
        :aria-label="label"
      />
      <EditableInput class="w-full bg-transparent outline-none" :aria-label="label" />
    </EditableArea>
  </EditableRoot>
</template>
