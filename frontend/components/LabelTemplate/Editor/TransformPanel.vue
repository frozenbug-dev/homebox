<script setup lang="ts">
  import { Label } from "@/components/ui/label";
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
  <div v-if="objectProps" class="space-y-4">
    <div class="grid grid-cols-2 gap-2">
      <div class="space-y-1">
        <Label for="tp-left" class="text-xs text-muted-foreground">X</Label>
        <div class="flex items-center gap-1">
          <NumberField
            id="tp-left"
            :step="step"
            :model-value="Number(objectProps.left)"
            class="h-8"
            @update:model-value="v => handlePositionChange('left', String(v ?? ''))"
          />
          <span class="w-6 shrink-0 text-xs text-muted-foreground">{{ unit }}</span>
        </div>
      </div>
      <div class="space-y-1">
        <Label for="tp-top" class="text-xs text-muted-foreground">Y</Label>
        <div class="flex items-center gap-1">
          <NumberField
            id="tp-top"
            :step="step"
            :model-value="Number(objectProps.top)"
            class="h-8"
            @update:model-value="v => handlePositionChange('top', String(v ?? ''))"
          />
          <span class="w-6 shrink-0 text-xs text-muted-foreground">{{ unit }}</span>
        </div>
      </div>
      <div class="space-y-1">
        <Label for="tp-width" class="text-xs text-muted-foreground">
          {{ $t("components.label_template.form.width") }}
        </Label>
        <div class="flex items-center gap-1">
          <NumberField
            id="tp-width"
            :step="step"
            :model-value="Number(objectProps.width)"
            class="h-8"
            :disabled="!canResizeWidth"
            @update:model-value="v => handleSizeChange('width', String(v ?? ''))"
          />
          <span class="w-6 shrink-0 text-xs text-muted-foreground">{{ unit }}</span>
        </div>
      </div>
      <div class="space-y-1">
        <Label for="tp-height" class="text-xs text-muted-foreground">
          {{ $t("components.label_template.form.height") }}
        </Label>
        <div class="flex items-center gap-1">
          <NumberField
            id="tp-height"
            :step="step"
            :model-value="Number(objectProps.height)"
            class="h-8"
            :disabled="!canResizeHeight"
            @update:model-value="v => handleSizeChange('height', String(v ?? ''))"
          />
          <span class="w-6 shrink-0 text-xs text-muted-foreground">{{ unit }}</span>
        </div>
      </div>
    </div>

    <div class="space-y-1">
      <Label for="tp-angle" class="text-xs text-muted-foreground">
        {{ $t("components.label_template.editor.properties.rotation") }}
      </Label>
      <div class="flex items-center gap-1">
        <NumberField
          id="tp-angle"
          :model-value="objectProps.angle"
          class="h-8 w-28"
          :min="0"
          :max="360"
          :step="1"
          @update:model-value="v => handleAngleChange(String(v ?? ''))"
        />
        <span class="text-xs text-muted-foreground">°</span>
      </div>
    </div>
  </div>
</template>
