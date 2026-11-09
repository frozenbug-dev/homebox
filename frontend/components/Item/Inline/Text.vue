<script setup lang="ts">
  import type { HTMLAttributes } from "vue";
  import { EditableArea, EditableInput, EditablePreview, EditableRoot } from "reka-ui";
  import { cn } from "@/lib/utils";

  /**
   * Click-to-edit single line text. Enter or blur saves, Escape reverts.
   * Emits `save` only when the value actually changed. With `wrap` (titles),
   * it's an auto-growing textarea instead, so long values wrap while editing
   * too and nothing below moves when editing starts.
   */
  const props = defineProps<{
    value: string;
    placeholder?: string;
    class?: HTMLAttributes["class"];
    label?: string;
    wrap?: boolean;
    /** Shown instead of the raw value when not editing, e.g. a formatted price. */
    display?: string;
  }>();
  const emit = defineEmits<{ save: [value: string] }>();

  const draft = ref(props.value);
  watch(
    () => props.value,
    v => (draft.value = v)
  );

  const root = useTemplateRef<InstanceType<typeof EditableRoot>>("root");
  const area = useTemplateRef<HTMLTextAreaElement>("area");
  /** Switch to editing from outside, e.g. a keyboard shortcut. */
  defineExpose({ edit: () => (props.wrap ? area.value?.focus() : root.value?.edit()) });

  /** Grow the textarea to fit its text (field-sizing isn't everywhere yet). */
  function fit() {
    const el = area.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }
  watch(draft, () => nextTick(fit));
  onMounted(fit);
  useResizeObserver(area, fit);

  function onAreaInput() {
    // A title is one line: pasted newlines become spaces.
    if (draft.value.includes("\n")) draft.value = draft.value.replace(/\s*\n\s*/g, " ");
  }
  function onAreaBlur() {
    submit(draft.value);
    draft.value = props.value;
  }
  function onAreaEscape() {
    draft.value = props.value;
    area.value?.blur();
  }

  function submit(v: string | null | undefined) {
    const next = (v ?? "").trim();
    if (next !== props.value) emit("save", next);
  }
</script>

<template>
  <textarea
    v-if="wrap"
    ref="area"
    v-model="draft"
    rows="1"
    :placeholder="placeholder ?? '—'"
    :aria-label="label"
    :class="
      cn(
        'block w-full min-w-0 resize-none overflow-hidden rounded-md bg-transparent px-1.5 py-1 outline-none placeholder:text-muted-foreground hover:not-focus:bg-muted',
        props.class
      )
    "
    @focus="(e: FocusEvent) => (e.target as HTMLTextAreaElement).select()"
    @input="onAreaInput"
    @blur="onAreaBlur"
    @keydown.enter.prevent="area?.blur()"
    @keydown.esc.stop.prevent="onAreaEscape"
  />
  <EditableRoot
    v-else
    ref="root"
    v-model="draft"
    :placeholder="placeholder ?? '—'"
    submit-mode="both"
    activation-mode="focus"
    select-on-focus
    @submit="submit"
  >
    <EditableArea :class="cn('min-w-0 rounded-md px-1.5 py-1 hover:not-focus-within:bg-muted', props.class)">
      <EditablePreview
        class="block w-full cursor-text truncate"
        :class="{ 'text-muted-foreground': !value }"
        :aria-label="label"
      >
        {{ (value && display) || value || placeholder || "—" }}
      </EditablePreview>
      <!-- block + one line-height tall: an inline input adds baseline space and shifts the content below -->
      <EditableInput class="block h-lh w-full border-0 bg-transparent p-0 outline-none" :aria-label="label" />
    </EditableArea>
  </EditableRoot>
</template>
