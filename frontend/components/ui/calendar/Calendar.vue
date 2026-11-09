<script setup lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/vue";
  import { type DateValue, getLocalTimeZone, parseDate, today } from "@internationalized/date";
  import {
    CalendarCell,
    CalendarCellTrigger,
    CalendarGrid,
    CalendarGridBody,
    CalendarGridHead,
    CalendarGridRow,
    CalendarHeadCell,
    CalendarHeader,
    CalendarHeading,
    CalendarNext,
    CalendarPrev,
    CalendarRoot,
    DateFieldInput,
    DateFieldRoot,
  } from "reka-ui";
  import { cn } from "@/lib/utils";

  /**
   * A month calendar for picking one day, bound to a "YYYY-MM-DD" string
   * ("" when nothing is picked). Arrow keys move between days, PageUp/PageDown
   * between months. The `footer` slot sits under the grid (e.g. Today / Clear).
   *
   * Above the grid sits a typeable date field in the locale's order
   * (e.g. 11/08/2026), focused first inside a popover so you can just type.
   * A complete typed date updates the model and moves the grid to it without
   * emitting `pick`; Enter in the field emits `pick`, so popovers that close
   * on pick close on Enter. Clicking a day emits `pick` right away.
   * Pass `:field="false"` to show the grid alone.
   */
  const props = withDefaults(defineProps<{ disabled?: boolean; field?: boolean; class?: string }>(), {
    field: true,
    class: undefined,
  });
  const model = defineModel<string>({ default: "" });
  const emit = defineEmits<{ pick: [value: string] }>();
  defineSlots<{ footer?(props: { today: () => void; clear: () => void }): unknown }>();

  const locale = useFormatLocale();

  const value = computed<DateValue | undefined>({
    get() {
      try {
        return model.value ? parseDate(model.value.slice(0, 10)) : undefined;
      } catch {
        return undefined;
      }
    },
    set(v) {
      const next = v ? v.toString() : "";
      model.value = next;
      emit("pick", next);
    },
  });

  /** Which month is showing; follows the picked day. */
  const placeholder = shallowRef<DateValue>(value.value ?? today(getLocalTimeZone()));
  watch(value, v => v && (placeholder.value = v));

  /** From the typed field: only complete dates; half-typed ones keep the last value. */
  function onTyped(v: DateValue | undefined | null) {
    if (v) model.value = v.toString();
  }
  function onFieldEnter() {
    if (model.value) emit("pick", model.value);
  }

  const pickToday = () => (value.value = today(getLocalTimeZone()));
  const clear = () => (value.value = undefined);

  const nav =
    "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";
</script>

<template>
  <div :class="cn('w-62 select-none', props.class)">
    <DateFieldRoot
      v-if="field"
      v-slot="{ segments }"
      :model-value="value"
      :locale="locale"
      :disabled="disabled"
      class="mb-2 flex h-8 items-center rounded-md border border-input bg-background px-2 text-[13px] tabular-nums transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15 data-disabled:opacity-50 data-invalid:border-destructive"
      @update:model-value="onTyped"
      @keydown.enter.prevent="onFieldEnter"
    >
      <template v-for="item in segments" :key="item.part">
        <DateFieldInput v-if="item.part === 'literal'" :part="item.part" class="px-px text-muted-foreground">
          {{ item.value }}
        </DateFieldInput>
        <DateFieldInput
          v-else
          :part="item.part"
          class="rounded px-0.5 outline-none focus:bg-primary focus:text-primary-foreground data-placeholder:text-muted-foreground focus:data-placeholder:text-primary-foreground/70"
        >
          {{ item.value }}
        </DateFieldInput>
      </template>
    </DateFieldRoot>
    <CalendarRoot
      v-slot="{ grid, weekDays }"
      v-model:placeholder="placeholder"
      :model-value="value"
      :locale="locale"
      :disabled="disabled"
      :week-starts-on="1"
      weekday-format="narrow"
      fixed-weeks
      prevent-deselect
      class="w-full"
      @update:model-value="v => (value = (Array.isArray(v) ? v[0] : v) ?? undefined)"
    >
      <CalendarHeader class="mb-1.5 flex items-center justify-between">
        <CalendarHeading class="pl-1.5 text-[13px] font-semibold" />
        <div class="flex items-center">
          <CalendarPrev :class="nav"><ChevronLeft class="size-4" /></CalendarPrev>
          <CalendarNext :class="nav"><ChevronRight class="size-4" /></CalendarNext>
        </div>
      </CalendarHeader>

      <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="w-full border-collapse">
        <CalendarGridHead>
          <CalendarGridRow class="grid grid-cols-7">
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="flex h-7 items-center justify-center text-[11px] font-medium text-muted-foreground"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(week, i) in month.rows" :key="i" class="grid grid-cols-7">
            <CalendarCell v-for="date in week" :key="date.toString()" :date="date" class="p-px">
              <CalendarCellTrigger
                :day="date"
                :month="month.value"
                class="relative flex aspect-square w-full items-center justify-center rounded-md text-[13px] tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-40 data-outside-view:text-muted-foreground/50 data-selected:bg-primary data-selected:font-medium data-selected:text-primary-foreground data-selected:hover:bg-primary/90 data-today:font-semibold data-today:after:absolute data-today:after:bottom-1 data-today:after:size-1 data-today:after:rounded-full data-today:after:bg-current [&[data-today]:not([data-selected])]:text-primary"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>

      <slot name="footer" :today="pickToday" :clear="clear" />
    </CalendarRoot>
  </div>
</template>
