<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { cn } from "@/lib/utils";

  /**
   * A date shown as text that turns into a native date picker on click.
   * Emits `save` with "YYYY-MM-DD", or "" when cleared.
   */
  const props = defineProps<{ value?: Date | string | null; placeholder: string; label?: string; class?: string }>();
  const emit = defineEmits<{ save: [value: string] }>();

  const { locale } = useI18n();
  const editing = ref(false);

  /** The API sends zero dates for "not set". */
  const parsed = computed(() => {
    if (!props.value) return null;
    const d = new Date(props.value);
    return Number.isNaN(d.getTime()) || d.getFullYear() < 1900 ? null : d;
  });
  const iso = computed(() => (parsed.value ? parsed.value.toISOString().slice(0, 10) : ""));
  const shown = computed(() =>
    parsed.value
      ? parsed.value.toLocaleDateString(locale.value, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
      : ""
  );

  const vAutofocus = { mounted: (el: HTMLInputElement) => (el.focus(), el.showPicker?.()) };

  function commit(e: Event) {
    const next = (e.target as HTMLInputElement).value;
    editing.value = false;
    if (next !== iso.value) emit("save", next);
  }
</script>

<template>
  <input
    v-if="editing"
    v-autofocus
    type="date"
    :value="iso"
    :aria-label="label"
    :class="cn('h-7 w-full rounded-md bg-background px-1.5 text-[13px] outline-none', props.class)"
    @change="commit"
    @blur="editing = false"
    @keydown.esc.stop="editing = false"
  />
  <button
    v-else
    type="button"
    :aria-label="label"
    :class="
      cn(
        'block w-full truncate rounded-md px-1.5 py-1 text-left hover:bg-muted',
        !shown && 'text-muted-foreground',
        props.class
      )
    "
    @click="editing = true"
  >
    {{ shown || placeholder }}
  </button>
</template>
