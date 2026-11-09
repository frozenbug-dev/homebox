<script setup lang="ts">
  import type { HTMLAttributes } from "vue";
  import { useI18n } from "vue-i18n";
  import { ChevronDown, ChevronUp } from "@lucide/vue";
  import { NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot } from "reka-ui";
  import { cn } from "@/lib/utils";

  /**
   * A number input with stacked up/down steppers in place of the browser's
   * spinner. Arrow keys, PageUp/PageDown and the mouse wheel (while focused)
   * step too. Empty is `null`. Values between steps are kept unless
   * `stepSnapping` is on. The `prefix` and `suffix` slots put a short label
   * or unit inside the box, e.g. "W … mm".
   */
  const props = withDefaults(
    defineProps<{
      min?: number;
      max?: number;
      step?: number;
      stepSnapping?: boolean;
      formatOptions?: Intl.NumberFormatOptions;
      placeholder?: string;
      disabled?: boolean;
      id?: string;
      ariaLabel?: string;
      class?: HTMLAttributes["class"];
      inputClass?: HTMLAttributes["class"];
    }>(),
    {
      min: undefined,
      max: undefined,
      step: 1,
      stepSnapping: false,
      formatOptions: () => ({ maximumFractionDigits: 2 }),
      placeholder: undefined,
      id: undefined,
      ariaLabel: undefined,
      class: undefined,
      inputClass: undefined,
    }
  );

  const model = defineModel<number | null>({ default: null });
  const emit = defineEmits<{ enter: [] }>();
  const { t } = useI18n();
  const locale = useFormatLocale();

  const stepper =
    "flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
</script>

<template>
  <NumberFieldRoot
    :id="id"
    v-model="model"
    :min="min"
    :max="max"
    :step="step"
    :step-snapping="stepSnapping"
    :format-options="formatOptions"
    :locale="locale"
    :disabled="disabled"
    :class="
      cn(
        'group/number flex h-8 items-stretch overflow-hidden rounded-md border border-input bg-background text-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15 has-disabled:opacity-50',
        props.class
      )
    "
  >
    <span
      v-if="$slots.prefix"
      class="flex shrink-0 items-center pl-2.5 text-xs text-muted-foreground select-none"
      aria-hidden="true"
    >
      <slot name="prefix" />
    </span>
    <NumberFieldInput
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :class="
        cn(
          'min-w-0 flex-1 bg-transparent px-2.5 text-foreground tabular-nums outline-none placeholder:text-muted-foreground',
          $slots.prefix && 'pl-2',
          $slots.suffix && 'pr-1',
          inputClass
        )
      "
      @keydown.enter="emit('enter')"
    />
    <span
      v-if="$slots.suffix"
      class="flex shrink-0 items-center pr-2 text-xs text-muted-foreground select-none"
      aria-hidden="true"
    >
      <slot name="suffix" />
    </span>
    <div class="flex w-6 shrink-0 flex-col border-l border-input">
      <NumberFieldIncrement :class="stepper" :aria-label="t('global.increase')">
        <ChevronUp class="size-3" :stroke-width="2.25" />
      </NumberFieldIncrement>
      <NumberFieldDecrement :class="cn(stepper, 'border-t border-input')" :aria-label="t('global.decrease')">
        <ChevronDown class="size-3" :stroke-width="2.25" />
      </NumberFieldDecrement>
    </div>
  </NumberFieldRoot>
</template>
