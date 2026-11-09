<script setup lang="ts">
  import { NumberField } from "@/components/ui/number-field";

  // Number input that edits a millimetre value in the user's measurement unit.
  // The stepper keeps the typed text itself and only commits on blur, Enter or
  // a step, so intermediate input like "2." isn't rewritten by the round trip
  // through millimetres.
  const props = defineProps<{
    id?: string;
    min?: number;
    max?: number;
    disabled?: boolean;
    inputClass?: string;
  }>();

  const modelValue = defineModel<number>({ required: true });

  const measurement = useMeasurement();
  const shown = computed(() => measurement.toDisplay(modelValue.value));

  function onInput(value: number | null) {
    if (value === null || Number.isNaN(value)) return;
    modelValue.value = measurement.fromDisplay(value);
  }
</script>

<template>
  <div class="flex items-center gap-1">
    <NumberField
      :id="props.id"
      :model-value="shown"
      :step="measurement.step.value"
      :min="props.min !== undefined ? measurement.toDisplay(props.min) : undefined"
      :max="props.max !== undefined ? measurement.toDisplay(props.max) : undefined"
      :format-options="{ maximumFractionDigits: 3 }"
      :disabled="props.disabled"
      :class="['h-9 flex-1', props.inputClass]"
      @update:model-value="onInput"
    />
    <span class="shrink-0 text-xs text-muted-foreground">{{ measurement.unit.value }}</span>
  </div>
</template>
