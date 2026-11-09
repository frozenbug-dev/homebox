<script setup lang="ts">
  import { RotateCw } from "@lucide/vue";
  import { NumberField } from "@/components/ui/number-field";

  export type EditorUnit = "mm" | "in";

  const props = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedObject: any;
    /** Bumped by the parent after in-place changes to the selected Fabric object */
    revision?: number;
    unit: EditorUnit;
  }>();

  // Fabric changes objects in place, so re-read the selection whenever the parent says so.
  const object = shallowRef(props.selectedObject);
  watch(
    () => [props.selectedObject, props.revision],
    () => {
      object.value = props.selectedObject;
      triggerRef(object);
    },
    { flush: "sync" }
  );

  const emit = defineEmits<{
    updateObject: [updates: Record<string, unknown>];
  }>();

  // The canvas works in CSS pixels at 96 dpi; the panel shows real-world units.
  const PX_PER_MM = 96 / 25.4;
  const PX_PER_IN = 96;

  const pxPerUnit = computed(() => (props.unit === "mm" ? PX_PER_MM : PX_PER_IN));
  const decimals = computed(() => (props.unit === "mm" ? 1 : 2));
  const step = computed(() => (props.unit === "mm" ? 0.5 : 0.05));

  function toUnit(px: number): string {
    return (px / pxPerUnit.value).toFixed(decimals.value);
  }

  function toPx(value: string): number | null {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return null;
    return n * pxPerUnit.value;
  }

  const type = computed(() => String(object.value?.type || "").toLowerCase());
  const canResize = computed(() => type.value === "rect" || type.value === "image" || type.value === "group");
  const isText = computed(() => type.value === "textbox");
  // A text frame (wrap set or autofit on) owns its height; a legacy text box grows with its text.
  const isTextFrame = computed(
    () => isText.value && (object.value?.data?.wrap !== undefined || !!object.value?.data?.autofit)
  );
  const canResizeWidth = computed(() => canResize.value || isText.value);
  const canResizeHeight = computed(() => canResize.value || isTextFrame.value);

  const objectProps = computed(() => {
    if (!object.value) return null;
    const obj = object.value;
    return {
      left: toUnit(obj.left || 0),
      top: toUnit(obj.top || 0),
      width: toUnit((obj.width || 0) * (obj.scaleX || 1)),
      height: toUnit((obj.height || 0) * (obj.scaleY || 1)),
      angle: Math.round(obj.angle || 0),
    };
  });

  function handlePositionChange(prop: "left" | "top", value: string) {
    const px = toPx(value);
    if (px !== null) emit("updateObject", { [prop]: Math.round(px * 100) / 100 });
  }

  // Width/height edits change the scale so Fabric keeps the object's native size;
  // the renderer multiplies width by scaleX the same way.
  function handleSizeChange(prop: "width" | "height", value: string) {
    const px = toPx(value);
    if (px === null || px <= 0 || !object.value) return;
    if (isText.value) {
      // Text is never scaled: the box (frame) itself changes size and the font stays put.
      const size = Math.round(px);
      const data = object.value.data || {};
      if (prop === "width") emit("updateObject", { width: size, data: { ...data, fixedWidth: size } });
      else emit("updateObject", { data: { ...data, fixedHeight: size } });
      return;
    }
    const base = prop === "width" ? object.value.width || 1 : object.value.height || 1;
    emit("updateObject", { [prop === "width" ? "scaleX" : "scaleY"]: px / base });
  }

  function handleAngleChange(value: string) {
    let numValue = parseInt(value, 10);
    if (Number.isNaN(numValue)) return;
    numValue = ((numValue % 360) + 360) % 360;
    emit("updateObject", { angle: numValue });
  }
</script>

<template>
  <div v-if="objectProps" class="grid grid-cols-2 gap-1.5">
    <NumberField
      :step="step"
      :model-value="Number(objectProps.left)"
      aria-label="X"
      @update:model-value="v => handlePositionChange('left', String(v ?? ''))"
    >
      <template #prefix>X</template>
      <template #suffix>{{ unit }}</template>
    </NumberField>
    <NumberField
      :step="step"
      :model-value="Number(objectProps.top)"
      aria-label="Y"
      @update:model-value="v => handlePositionChange('top', String(v ?? ''))"
    >
      <template #prefix>Y</template>
      <template #suffix>{{ unit }}</template>
    </NumberField>
    <NumberField
      :step="step"
      :model-value="Number(objectProps.width)"
      :aria-label="$t('components.label_template.form.width')"
      :disabled="!canResizeWidth"
      @update:model-value="v => handleSizeChange('width', String(v ?? ''))"
    >
      <template #prefix>W</template>
      <template #suffix>{{ unit }}</template>
    </NumberField>
    <NumberField
      :step="step"
      :model-value="Number(objectProps.height)"
      :aria-label="$t('components.label_template.form.height')"
      :disabled="!canResizeHeight"
      @update:model-value="v => handleSizeChange('height', String(v ?? ''))"
    >
      <template #prefix>H</template>
      <template #suffix>{{ unit }}</template>
    </NumberField>
    <NumberField
      :model-value="objectProps.angle"
      :min="0"
      :max="360"
      :step="1"
      :aria-label="$t('components.label_template.editor.properties.rotation')"
      @update:model-value="v => handleAngleChange(String(v ?? ''))"
    >
      <template #prefix><RotateCw class="size-3.5" /></template>
      <template #suffix>°</template>
    </NumberField>
  </div>
</template>
