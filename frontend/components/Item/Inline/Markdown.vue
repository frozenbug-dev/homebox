<script setup lang="ts">
  import Markdown from "~/components/global/Markdown.vue";

  /**
   * Markdown that turns into a textarea on click. Blur or ⌘/Ctrl+Enter saves,
   * Escape reverts. Emits `save` only when the text changed.
   */
  const props = defineProps<{ value: string; placeholder: string; label?: string }>();
  const emit = defineEmits<{ save: [value: string] }>();

  const editing = ref(false);
  const draft = ref(props.value);
  const textarea = useTemplateRef<HTMLTextAreaElement>("textarea");

  async function start() {
    draft.value = props.value;
    editing.value = true;
    await nextTick();
    textarea.value?.focus();
  }

  function save() {
    if (!editing.value) return;
    editing.value = false;
    if (draft.value !== props.value) emit("save", draft.value);
  }

  function cancel() {
    editing.value = false;
    draft.value = props.value;
  }
</script>

<template>
  <!-- Same box as the preview, no border or ring: editing only shows the caret -->
  <textarea
    v-if="editing"
    ref="textarea"
    v-model="draft"
    class="-mx-2 block field-sizing-content min-h-[2lh] w-[calc(100%+1rem)] resize-none rounded-md bg-transparent px-2 py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
    :placeholder="placeholder"
    :aria-label="label"
    @blur="save"
    @keydown.meta.enter.prevent="save"
    @keydown.ctrl.enter.prevent="save"
    @keydown.esc.stop.prevent="cancel"
  />
  <button
    v-else
    type="button"
    class="-mx-2 block w-[calc(100%+1rem)] cursor-text rounded-md px-2 py-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    :aria-label="label"
    @click="start"
  >
    <Markdown v-if="value" class="prose max-w-none text-sm leading-relaxed" :source="value" />
    <span v-else class="text-sm leading-relaxed text-muted-foreground">{{ placeholder }}</span>
  </button>
</template>
