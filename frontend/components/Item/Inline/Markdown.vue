<script setup lang="ts">
  import Markdown from "~/components/global/Markdown.vue";
  import { Textarea } from "@/components/ui/textarea";

  /**
   * Markdown that turns into a textarea on click. Blur or ⌘/Ctrl+Enter saves,
   * Escape reverts. Emits `save` only when the text changed.
   */
  const props = defineProps<{ value: string; placeholder: string; label?: string }>();
  const emit = defineEmits<{ save: [value: string] }>();

  const editing = ref(false);
  const draft = ref(props.value);
  const textarea = useTemplateRef<InstanceType<typeof Textarea>>("textarea");

  async function start() {
    draft.value = props.value;
    editing.value = true;
    await nextTick();
    (textarea.value?.$el as HTMLTextAreaElement | undefined)?.focus();
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
  <Textarea
    v-if="editing"
    ref="textarea"
    v-model="draft"
    class="field-sizing-content min-h-24 text-sm"
    :aria-label="label"
    @blur="save"
    @keydown.meta.enter.prevent="save"
    @keydown.ctrl.enter.prevent="save"
    @keydown.esc.stop.prevent="cancel"
  />
  <button
    v-else
    type="button"
    class="-mx-2 block w-[calc(100%+1rem)] cursor-text rounded-md px-2 py-1 text-left hover:bg-accent/60"
    :aria-label="label"
    @click="start"
  >
    <Markdown v-if="value" class="prose max-w-none text-sm" :source="value" />
    <span v-else class="text-sm text-muted-foreground">{{ placeholder }}</span>
  </button>
</template>
