<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Calendar } from "@/components/ui/calendar";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { cn } from "@/lib/utils";

  /**
   * A date shown as text that opens a calendar on click: type the date or
   * pick a day. Emits `save` with "YYYY-MM-DD" ("" when cleared) when the
   * popover closes with a changed date.
   */
  const props = defineProps<{ value?: Date | string | null; placeholder: string; label?: string; class?: string }>();
  const emit = defineEmits<{ save: [value: string] }>();

  const { t } = useI18n();
  const locale = useFormatLocale();
  const open = ref(false);

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

  /** What the calendar holds while open; saved when the popover closes. */
  const draft = ref("");
  watch(open, isOpen => {
    if (isOpen) draft.value = iso.value;
    else if (draft.value !== iso.value) emit("save", draft.value);
  });
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="label"
        :class="
          cn(
            'block w-full truncate rounded-md px-1.5 py-1 text-left hover:bg-muted',
            open && 'bg-muted',
            !shown && 'text-muted-foreground',
            props.class
          )
        "
      >
        {{ shown || placeholder }}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-auto p-2.5" @keydown.esc.stop="open = false">
      <Calendar v-model="draft" @pick="open = false">
        <template #footer="{ today, clear }">
          <div class="mt-2 flex justify-between border-t border-border pt-2">
            <button type="button" class="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted" @click="today">
              {{ t("global.today") }}
            </button>
            <button
              v-if="draft"
              type="button"
              class="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              @click="clear"
            >
              {{ t("global.clear") }}
            </button>
          </div>
        </template>
      </Calendar>
    </PopoverContent>
  </Popover>
</template>
