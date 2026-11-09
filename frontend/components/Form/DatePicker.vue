<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { CalendarDays, X } from "@lucide/vue";
  import { Time } from "@internationalized/date";
  import { TimeFieldInput, TimeFieldRoot } from "reka-ui";
  import { isDateOnlyString, parseDateOnly, toDateOnlyString } from "~/lib/datelib/dateOnly";
  import { Label } from "@/components/ui/label";
  import { Calendar } from "@/components/ui/calendar";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { cn } from "@/lib/utils";

  /**
   * A labelled date field: an input-like button that opens a calendar.
   *
   * Date-only by default, emitting "YYYY-MM-DD" built from local components
   * ("" when cleared). Emitting a Date would let JSON.stringify serialize it as
   * a UTC instant, which lands on the previous day west of Greenwich, so every
   * calendar-date field (types.Date on the backend) uses this mode.
   *
   * With `time`, it also edits hours and minutes and emits a Date (or null),
   * for real timestamps such as an invite's expiry.
   */
  const props = withDefaults(
    defineProps<{
      modelValue?: Date | string | null;
      inline?: boolean;
      label?: string;
      time?: boolean;
      placeholder?: string;
      clearable?: boolean;
      id?: string;
    }>(),
    {
      modelValue: null,
      inline: false,
      label: "Date",
      time: false,
      placeholder: undefined,
      clearable: true,
      id: undefined,
    }
  );
  const emit = defineEmits<{ "update:modelValue": [value: string | Date | null] }>();

  const { t } = useI18n();
  const locale = useFormatLocale();
  const open = ref(false);
  const generatedId = useId();
  const fieldId = computed(() => props.id ?? generatedId);

  /** The model as a local Date, or null for empty / invalid / zero dates. */
  const selected = computed<Date | null>(() => {
    const v = props.modelValue;
    if (typeof v === "string") {
      if (v === "" || v === "Invalid Date") return null;
      // YYYY-MM-DD is read through local components; parseDateOnly also rejects
      // impossible days such as 2026-02-30 instead of rolling them over.
      if (isDateOnlyString(v)) return parseDateOnly(v);
      const parsed = new Date(v);
      return Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 1000 ? null : parsed;
    }
    if (v instanceof Date) return Number.isNaN(v.getTime()) || v.getFullYear() < 1000 ? null : v;
    return null;
  });

  const day = computed(() => (selected.value ? toDateOnlyString(selected.value) : ""));

  const shown = computed(() =>
    selected.value
      ? selected.value.toLocaleString(locale.value, {
          year: "numeric",
          month: "short",
          day: "numeric",
          ...(props.time ? { hour: "numeric", minute: "2-digit" } : {}),
        })
      : ""
  );

  /** A typed or clicked day; typing keeps the popover open. */
  function setDay(next: string) {
    if (next === day.value) return;
    if (!props.time) {
      emit("update:modelValue", next);
      return;
    }
    if (!next) return emit("update:modelValue", null);
    const [y, m, d] = next.split("-").map(Number) as [number, number, number];
    const base = selected.value ?? new Date(new Date().setHours(23, 59, 0, 0));
    emit("update:modelValue", new Date(y, m - 1, d, base.getHours(), base.getMinutes()));
  }

  const timeValue = computed(() =>
    selected.value ? new Time(selected.value.getHours(), selected.value.getMinutes()) : undefined
  );
  function setTime(v: unknown) {
    if (!(v instanceof Time) && !(v && typeof v === "object" && "hour" in v)) return;
    const { hour, minute } = v as Time;
    const base = selected.value ?? new Date();
    emit("update:modelValue", new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute));
  }

  const clear = () => emit("update:modelValue", props.time ? null : "");
</script>

<template>
  <div :class="inline ? 'sm:grid sm:grid-cols-4 sm:items-start sm:gap-4' : 'flex w-full flex-col gap-1.5'">
    <Label :for="fieldId" :class="inline ? 'flex w-full px-1 py-2' : 'cursor-pointer px-1'">{{ label }}</Label>
    <Popover v-model:open="open">
      <div :class="cn('group/date relative', inline && 'col-span-3 mt-2 sm:mt-0')">
        <PopoverTrigger as-child>
          <button
            :id="fieldId"
            type="button"
            :class="
              cn(
                'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15',
                open && 'border-ring ring-[3px] ring-ring/15',
                !shown && 'text-muted-foreground'
              )
            "
          >
            <CalendarDays class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span class="truncate">{{ shown || placeholder || t("global.pick_date") }}</span>
          </button>
        </PopoverTrigger>
        <button
          v-if="clearable && shown"
          type="button"
          class="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 group-focus-within/date:opacity-100 group-hover/date:opacity-100 hover:bg-muted hover:text-foreground pointer-coarse:opacity-100"
          :aria-label="t('global.clear')"
          @click="clear"
        >
          <X class="size-3.5" />
        </button>
      </div>
      <PopoverContent align="start" class="w-auto p-2.5" @keydown.esc.stop="open = false">
        <Calendar :model-value="day" @update:model-value="setDay" @pick="!time && (open = false)">
          <template #footer="{ today }">
            <div class="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
              <button type="button" class="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted" @click="today">
                {{ t("global.today") }}
              </button>
              <TimeFieldRoot
                v-if="time"
                v-slot="{ segments }"
                :model-value="timeValue"
                :locale="locale"
                granularity="minute"
                :disabled="!selected"
                class="flex h-7 items-center rounded-md border border-input bg-background px-2 text-[13px] tabular-nums focus-within:border-ring data-disabled:opacity-50"
                @update:model-value="setTime"
              >
                <template v-for="item in segments" :key="item.part">
                  <TimeFieldInput v-if="item.part === 'literal'" :part="item.part" class="text-muted-foreground">
                    {{ item.value }}
                  </TimeFieldInput>
                  <TimeFieldInput
                    v-else
                    :part="item.part"
                    class="rounded px-0.5 outline-none focus:bg-primary focus:text-primary-foreground data-placeholder:text-muted-foreground"
                  >
                    {{ item.value }}
                  </TimeFieldInput>
                </template>
              </TimeFieldRoot>
              <button
                v-else-if="day"
                type="button"
                class="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                @click="(clear(), (open = false))"
              >
                {{ t("global.clear") }}
              </button>
            </div>
          </template>
        </Calendar>
      </PopoverContent>
    </Popover>
  </div>
</template>
