<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useEventListener } from "@vueuse/core";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { LoaderCircle, Maximize, Minus, Plus, Printer, Trash2 } from "@lucide/vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import AppSubheader from "~/components/App/Subheader.vue";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import LabelTemplateEditorDockPanel from "~/components/LabelTemplate/Editor/DockPanel.vue";
  import LabelTemplateEditorCanvas from "~/components/LabelTemplate/Editor/Canvas.vue";
  import LabelTemplateEditorToolRail, { type AlignTarget } from "~/components/LabelTemplate/Editor/ToolRail.vue";
  import LabelTemplateEditorTextToolbar from "~/components/LabelTemplate/Editor/TextToolbar.vue";
  import LabelTemplateEditorBarcodePanel from "~/components/LabelTemplate/Editor/BarcodePanel.vue";
  import LabelTemplateEditorTransformPanel, {
    type EditorUnit,
  } from "~/components/LabelTemplate/Editor/TransformPanel.vue";
  import LabelTemplateEditorLayerPanel from "~/components/LabelTemplate/Editor/LayerPanel.vue";
  import LabelTemplateEditorPreviewPanel from "~/components/LabelTemplate/Editor/PreviewPanel.vue";
  import LabelTemplateEditorSheetLayoutPanel from "~/components/LabelTemplate/Editor/SheetLayoutPanel.vue";
  import LabelTemplateEditorLabelSettings, {
    type EditorSettings,
    type DisplaySettings,
  } from "~/components/LabelTemplate/Editor/LabelSettings.vue";
  import {
    DEFAULT_LABEL_BORDER,
    readLabelBorder,
    withLabelBorder,
    type LabelBorder,
  } from "~/components/LabelTemplate/Editor/label-border";
  import type { EntitySummary, LabelmakerSheetLayout } from "~/lib/api/types/data-contracts";

  definePageMeta({
    middleware: ["auth"],
  });

  const { t } = useI18n();
  const route = useRoute();
  const templateId = computed(() => route.params.id as string);

  useHead({
    title: computed(() => `HomeBox | ${t("components.label_template.editor.title")}`),
  });

  const { template, pending, refresh } = useLabelTemplate(templateId);
  const { update } = useLabelTemplateActions();
  const { presets } = useLabelPresets();
  const { title: presetTitle } = useLabelPresetLookup();
  const { labelPrinting } = useServerLabelPrinting();
  const { printLabels } = useDirectPrint();

  // ---------------------------------------------------------------------------
  // Editable copies of the template's settings and canvas
  // ---------------------------------------------------------------------------
  const settings = reactive<EditorSettings>({
    name: "",
    description: "",
    width: 62,
    height: 29,
    preset: "",
    dpi: 300,
    isShared: false,
  });

  // The breadcrumb is the way back to the list
  usePageHeader(() => [
    { label: t("menu.label_templates"), to: "/label-templates" },
    {
      label: settings.name || template.value?.name || t("components.label_template.editor.title"),
    },
  ]);

  const display = reactive<DisplaySettings>({
    showRuler: true,
    showGrid: false,
    snapToGrid: false,
    gridSize: 10,
  });

  // The border is part of canvasData, so it is saved with the design and
  // rendered by the server; here it is edited as its own small object.
  const border = reactive<LabelBorder>({ ...DEFAULT_LABEL_BORDER });

  // The unit follows the user's measurement preference; the toggle below changes it
  const measurement = useMeasurement();
  const preferences = useViewPreferences();
  const unit = computed<EditorUnit>({
    get: () => (measurement.isImperial.value ? "in" : "mm"),
    set: value => {
      preferences.value.measurementSystem = value === "in" ? "imperial" : "metric";
    },
  });
  const localCanvasData = ref<Record<string, unknown>>({});

  // Page layout for sheet printing (null follows the preset) and the printer calibration offset
  const sheetLayout = ref<LabelmakerSheetLayout | null>(null);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const selectedPreset = computed(() => presets.value?.find(p => p.key === settings.preset) ?? null);

  function loadFromTemplate() {
    const tpl = template.value;
    if (!tpl) return;
    settings.name = tpl.name;
    settings.description = tpl.description ?? "";
    settings.width = tpl.width;
    settings.height = tpl.height;
    settings.preset = tpl.preset || "";
    settings.dpi = tpl.dpi;
    settings.isShared = tpl.isShared;
    if (tpl.canvasData) localCanvasData.value = tpl.canvasData;
    Object.assign(border, readLabelBorder(tpl.canvasData));
    sheetLayout.value = tpl.sheetLayout ? { ...tpl.sheetLayout } : null;
    offsetX.value = tpl.offsetX ?? 0;
    offsetY.value = tpl.offsetY ?? 0;
  }

  watch(template, loadFromTemplate, { immediate: true });

  // A custom layout is measured for one sheet; picking another preset drops it
  // so the new preset's layout applies.
  watch(
    () => settings.preset,
    preset => {
      if (preset !== (template.value?.preset || "")) sheetLayout.value = null;
    }
  );

  watch(border, () => {
    localCanvasData.value = withLabelBorder(localCanvasData.value, border);
  });

  // The API returns JSON objects with sorted keys while the editor builds them
  // in insertion order, so compare canvas data independent of key order.
  function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      return `{${Object.keys(o)
        .sort()
        .map(k => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }

  const isDirty = computed(() => {
    const tpl = template.value;
    if (!tpl) return false;
    const settingsChanged =
      settings.name !== tpl.name ||
      settings.description !== (tpl.description ?? "") ||
      settings.width !== tpl.width ||
      settings.height !== tpl.height ||
      settings.preset !== (tpl.preset || "") ||
      settings.dpi !== tpl.dpi ||
      settings.isShared !== tpl.isShared ||
      offsetX.value !== (tpl.offsetX ?? 0) ||
      offsetY.value !== (tpl.offsetY ?? 0) ||
      stableStringify(sheetLayout.value) !== stableStringify(tpl.sheetLayout ?? null);
    const canvasChanged = stableStringify(localCanvasData.value) !== stableStringify(tpl.canvasData ?? {});
    return settingsChanged || canvasChanged;
  });

  useEventListener(window, "beforeunload", (e: BeforeUnloadEvent) => {
    if (isDirty.value) e.preventDefault();
  });

  const sizeLabel = computed(() => measurement.formatSize(settings.width, settings.height));

  // ---------------------------------------------------------------------------
  // Canvas interaction
  // ---------------------------------------------------------------------------
  const canvasRef = ref<InstanceType<typeof LabelTemplateEditorCanvas> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedObject = ref<any>(null);
  // Fabric mutates objects in place, which Vue cannot see; the panels re-read
  // the selection whenever this counter moves.
  const selectionRevision = ref(0);
  const isSaving = ref(false);
  const isTestPrinting = ref(false);
  // Which dock panels are unfolded; not remembered between visits
  const panels = reactive({
    element: true,
    layers: true,
    label: false,
    preview: true,
  });
  const previewItem = ref<EntitySummary | null>(null);

  interface LayerItem {
    index: number;
    type: string;
    name: string;
    visible: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any;
  }
  const layers = ref<LayerItem[]>([]);

  const selectedType = computed(() => String(selectedObject.value?.type || "").toLowerCase());
  const isTextSelected = computed(() => ["textbox", "i-text", "itext", "text"].includes(selectedType.value));
  const selectedTypeLabel = computed(() => {
    if (!selectedObject.value) return "";
    if (selectedObject.value.data?.type === "barcode") {
      return t("components.label_template.editor.element.type_barcode");
    }
    const map: Record<string, string> = {
      textbox: "type_text",
      "i-text": "type_text",
      itext: "type_text",
      text: "type_text",
      rect: "type_rect",
      line: "type_line",
      image: "type_image",
      group: "type_group",
    };
    return t(`components.label_template.editor.element.${map[selectedType.value] ?? "type_group"}`);
  });

  const selectionCount = computed(() => canvasRef.value?.selectionCount ?? 0);
  const canUndo = computed(() => canvasRef.value?.canUndo ?? false);
  const canRedo = computed(() => canvasRef.value?.canRedo ?? false);
  const zoomLevel = computed(() => canvasRef.value?.zoomLevel ?? 1);

  function refreshLayers() {
    layers.value = canvasRef.value?.getLayers() || [];
  }

  function handleCanvasUpdate(data: Record<string, unknown>) {
    // Fabric serialises only its own objects; keep the label-level settings with them.
    localCanvasData.value = withLabelBorder(data, border);
    nextTick(() => refreshLayers());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelectionChanged(obj: any) {
    selectedObject.value = obj;
    selectionRevision.value++;
  }

  const quickFields = ["name", "asset_id", "location", "location_path", "serial_number", "tags", "current_date"];

  function handleInsertField(fieldName: string) {
    const canvas = canvasRef.value?.getCanvas();
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type?.toLowerCase() !== "textbox") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textbox = activeObject as any;
    const placeholder = `{{${fieldName}}}`;

    if (textbox.isEditing) {
      const selectionStart = textbox.selectionStart || 0;
      const selectionEnd = textbox.selectionEnd || 0;
      const currentText = textbox.text || "";
      textbox.set("text", currentText.substring(0, selectionStart) + placeholder + currentText.substring(selectionEnd));
      textbox.selectionStart = selectionStart + placeholder.length;
      textbox.selectionEnd = selectionStart + placeholder.length;
    } else {
      textbox.set("text", (textbox.text || "") + placeholder);
    }

    canvas.renderAll();
    canvasRef.value?.updateSelectedObject({});
  }

  function handleAlign(target: AlignTarget) {
    canvasRef.value?.alignSelected(target);
  }

  async function handleAddImage(file: File) {
    try {
      await canvasRef.value?.addImage(file);
    } catch {
      toast.error(t("components.label_template.editor.tools.image_failed"));
    }
  }

  function handleDeleteSelected() {
    canvasRef.value?.deleteSelected();
    selectedObject.value = null;
  }

  function handleUpdateObject(updates: Record<string, unknown>) {
    canvasRef.value?.updateSelectedObject(updates);
  }

  function withLayerRefresh(fn: (index: number) => void) {
    return (index: number) => {
      fn(index);
      nextTick(() => refreshLayers());
    };
  }
  const bringForward = withLayerRefresh(i => canvasRef.value?.bringForward(i));
  const sendBackward = withLayerRefresh(i => canvasRef.value?.sendBackward(i));
  const bringToFront = withLayerRefresh(i => canvasRef.value?.bringToFront(i));
  const sendToBack = withLayerRefresh(i => canvasRef.value?.sendToBack(i));
  const toggleVisibility = withLayerRefresh(i => canvasRef.value?.toggleLayerVisibility(i));

  // ---------------------------------------------------------------------------
  // Save / test print
  // ---------------------------------------------------------------------------
  async function handleSave(): Promise<boolean> {
    if (!template.value) return false;
    if (!settings.name.trim()) {
      toast.error(t("components.label_template.validation.name_required"));
      return false;
    }

    isSaving.value = true;
    try {
      await update(templateId.value, {
        id: templateId.value,
        name: settings.name.trim(),
        description: settings.description,
        width: settings.width,
        height: settings.height,
        preset: settings.preset || "",
        isShared: settings.isShared,
        outputFormat: (template.value.outputFormat as "png" | "pdf") || "png",
        dpi: settings.dpi,
        canvasData: localCanvasData.value,
        sheetLayout: sheetLayout.value,
        offsetX: offsetX.value,
        offsetY: offsetY.value,
      });
      toast.success(t("components.label_template.toast.updated"));
      await refresh();
      return true;
    } catch {
      toast.error(t("components.label_template.toast.update_failed"));
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  useHotkey(SHORTCUTS.templateSave, () => !isSaving.value && handleSave(), {
    meta: { name: t("global.save"), group: "general" },
  });

  const canTestPrint = computed(() => !!previewItem.value && labelPrinting.value);
  const testPrintHint = computed(() => {
    if (!labelPrinting.value) return t("components.label_template.editor.toast.test_print_needs_server");
    if (!previewItem.value) return t("components.label_template.editor.toast.test_print_needs_item");
    return t("components.label_template.editor.header.test_print_hint");
  });

  async function handleTestPrint() {
    if (!previewItem.value || !labelPrinting.value) return;
    isTestPrinting.value = true;
    try {
      // The printer renders the saved template, so persist pending edits first.
      if (isDirty.value) {
        const ok = await handleSave();
        if (!ok) return;
      }
      const result = await printLabels(templateId.value, [previewItem.value.id], 1);
      if (result?.success) {
        toast.success(result.message || t("components.label_template.editor.toast.test_print_sent"));
      } else {
        toast.error(result?.message || t("components.label_template.editor.toast.test_print_failed"));
      }
    } catch {
      toast.error(t("components.label_template.editor.toast.test_print_failed"));
    } finally {
      isTestPrinting.value = false;
    }
  }

  const viewToggles = computed(() => [
    {
      key: "showGrid" as const,
      label: t("components.label_template.editor.display.grid"),
    },
    {
      key: "snapToGrid" as const,
      label: t("components.label_template.editor.display.snap"),
    },
    {
      key: "showRuler" as const,
      label: t("components.label_template.editor.display.rulers"),
    },
  ]);

  const canvasDataJson = computed(() =>
    localCanvasData.value && Object.keys(localCanvasData.value).length > 0 ? JSON.stringify(localCanvasData.value) : ""
  );
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div v-if="pending" class="px-4 py-12 text-center text-sm text-muted-foreground">
      {{ $t("global.loading") }}
    </div>

    <template v-else-if="template">
      <AppHeaderActions>
        <Button
          variant="outline"
          size="sm"
          class="h-[30px] text-[13px]"
          :disabled="!canTestPrint || isTestPrinting"
          :title="testPrintHint"
          @click="handleTestPrint"
        >
          <LoaderCircle v-if="isTestPrinting" class="animate-spin" />
          <Printer v-else />
          <span class="max-sm:hidden">{{ $t("components.label_template.editor.header.test_print") }}</span>
        </Button>
        <div role="group" class="flex">
          <Button
            variant="outline"
            size="icon"
            class="size-[30px] rounded-r-none border-r-0"
            :disabled="!selectedObject"
            :aria-label="$t('components.label_template.editor.tools.delete')"
            :title="`${$t('components.label_template.editor.tools.delete')} (⌫)`"
            @click="handleDeleteSelected"
          >
            <Trash2 />
          </Button>
          <Button size="sm" class="h-[30px] rounded-l-none text-[13px]" :disabled="isSaving" @click="handleSave">
            {{ $t("global.save") }}
            <ShortcutHint
              :hotkey="SHORTCUTS.templateSave"
              class="hidden lg:inline-flex [&_kbd]:border-primary-foreground/20 [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground"
            />
          </Button>
        </div>
      </AppHeaderActions>

      <AppSubheader class="gap-2.5">
        <InlineText
          :value="settings.name"
          :label="$t('components.label_template.editor.header.name_label')"
          class="-ml-1.5 max-w-80 text-sm font-semibold"
          @save="name => name && (settings.name = name)"
        />
        <span
          v-if="isDirty"
          class="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2 text-[11.5px] font-medium text-amber-800"
        >
          <span class="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {{ $t("components.label_template.editor.header.unsaved") }}
        </span>
        <span class="flex-1" />
        <Button variant="outline" size="sm" class="h-7 gap-2 px-2.5 text-xs" @click="panels.label = true">
          <span class="font-medium">
            {{ settings.preset ? presetTitle(settings.preset) : $t("components.label_template.form.preset_custom") }}
          </span>
          <span class="text-muted-foreground">{{ sizeLabel }} · {{ settings.dpi }} dpi</span>
        </Button>
        <div
          role="group"
          :aria-label="$t('components.label_template.editor.header.units')"
          class="inline-flex h-7 rounded-md bg-muted p-0.5 text-xs"
        >
          <button
            v-for="u in ['mm', 'in'] as const"
            :key="u"
            type="button"
            class="rounded-[5px] px-2.5"
            :class="
              unit === u ? 'bg-background font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            "
            :aria-pressed="unit === u"
            @click="unit = u"
          >
            {{ u }}
          </button>
        </div>
      </AppSubheader>

      <!-- On large screens the editor fills the window: header, subheader (2.75rem) and the panel's bottom gap -->
      <div
        class="flex flex-1 flex-col lg:h-[calc(100dvh-var(--header-height)-2.75rem-0.5rem-2px)] lg:flex-none lg:flex-row"
      >
        <!-- Design area: tools, text bar and zoom float over it, so the label never moves -->
        <section
          class="relative flex min-h-120 min-w-0 flex-1 bg-muted/40 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] bg-size-[16px_16px]"
          :aria-label="$t('components.label_template.editor.design')"
        >
          <!-- One canvas instance: toggling the rulers must not recreate it and lose the undo history -->
          <LabelTemplateEditorCanvas
            ref="canvasRef"
            class="absolute inset-0"
            :width="settings.width"
            :height="settings.height"
            :dpi="settings.dpi"
            :canvas-data="localCanvasData"
            :snap-to-grid="display.snapToGrid"
            :show-grid="display.showGrid"
            :grid-size="display.gridSize"
            :label-border="border"
            :show-ruler="display.showRuler"
            :ruler-unit="unit === 'mm' ? 'metric' : 'imperial'"
            @update:canvas-data="handleCanvasUpdate"
            @selection-changed="handleSelectionChanged"
            @loaded="refreshLayers"
          />

          <!-- The rail's root is a TooltipProvider (no element), so position a wrapper -->
          <div class="absolute top-1/2 left-3 z-10 -translate-y-1/2">
            <LabelTemplateEditorToolRail
              :has-selection="!!selectedObject"
              :selection-count="selectionCount"
              :can-undo="canUndo"
              :can-redo="canRedo"
              @add-text="canvasRef?.addText()"
              @add-barcode="(format, source) => canvasRef?.addBarcode(format, source)"
              @add-shape="type => canvasRef?.addShape(type)"
              @add-image="handleAddImage"
              @align="handleAlign"
              @align-selection="target => canvasRef?.alignWithinSelection(target)"
              @undo="canvasRef?.undo()"
              @redo="canvasRef?.redo()"
            />
          </div>

          <LabelTemplateEditorTextToolbar
            v-if="isTextSelected"
            class="absolute top-3 left-1/2 z-10 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2"
            :selected-object="selectedObject"
            :revision="selectionRevision"
            :unit="unit"
            @update-object="handleUpdateObject"
            @insert-field="handleInsertField"
          />

          <!-- Zoom + canvas toggles -->
          <div
            class="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border bg-card p-1 text-xs whitespace-nowrap shadow-md shadow-black/5"
          >
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="zoomLevel <= 0.25"
              :aria-label="$t('components.label_template.editor.zoom.out')"
              @click="canvasRef?.zoomOut()"
            >
              <Minus class="size-4" />
            </Button>
            <span class="w-11 text-center font-medium tabular-nums">{{ Math.round(zoomLevel * 100) }}%</span>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="zoomLevel >= 4"
              :aria-label="$t('components.label_template.editor.zoom.in')"
              @click="canvasRef?.zoomIn()"
            >
              <Plus class="size-4" />
            </Button>
            <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="canvasRef?.zoomToFit()">
              <Maximize class="size-3.5" />
              {{ $t("components.label_template.editor.zoom.fit") }}
            </Button>
            <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="canvasRef?.zoomTo100()">100%</Button>
            <span class="mx-1 h-4 w-px bg-border" />
            <button
              v-for="toggle in viewToggles"
              :key="toggle.key"
              type="button"
              class="h-7 rounded-md px-2"
              :class="
                display[toggle.key]
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              "
              :aria-pressed="display[toggle.key]"
              @click="display[toggle.key] = !display[toggle.key]"
            >
              {{ toggle.label }}
            </button>
          </div>
        </section>

        <!-- Dock -->
        <aside
          class="w-full shrink-0 overflow-y-auto border-t bg-background text-[13px] lg:w-80 lg:border-t-0 lg:border-l"
          :aria-label="$t('components.label_template.editor.inspector')"
        >
          <LabelTemplateEditorDockPanel
            v-model:open="panels.element"
            :title="$t('components.label_template.editor.tabs.element')"
            :meta="selectedTypeLabel || '—'"
          >
            <p v-if="!selectedObject" class="text-xs text-muted-foreground">
              {{ $t("components.label_template.editor.element.no_selection") }}
            </p>
            <div v-else class="space-y-4">
              <LabelTemplateEditorTransformPanel
                :selected-object="selectedObject"
                :revision="selectionRevision"
                :unit="unit"
                @update-object="handleUpdateObject"
              />
              <LabelTemplateEditorBarcodePanel
                v-if="selectedObject?.data?.type === 'barcode'"
                :selected-object="selectedObject"
                :revision="selectionRevision"
                :dpi="settings.dpi"
                @update-object="handleUpdateObject"
              />
              <div v-if="isTextSelected" class="space-y-2">
                <span class="text-xs font-medium text-muted-foreground">
                  {{ $t("components.label_template.editor.element.insert_field") }}
                </span>
                <div class="flex flex-wrap gap-1.5">
                  <Button
                    v-for="field in quickFields"
                    :key="field"
                    variant="secondary"
                    size="sm"
                    class="h-6 rounded-full px-2.5 text-xs font-normal"
                    @click="handleInsertField(field)"
                  >
                    +
                    {{ $t(`components.label_template.editor.data_fields.${field}`) }}
                  </Button>
                </div>
              </div>
            </div>
          </LabelTemplateEditorDockPanel>

          <LabelTemplateEditorDockPanel
            v-model:open="panels.layers"
            :title="$t('components.label_template.editor.tabs.layers')"
            :meta="layers.length"
          >
            <LabelTemplateEditorLayerPanel
              :layers="layers"
              :selected-object="selectedObject"
              @select-layer="canvasRef?.selectLayerByIndex($event)"
              @bring-forward="bringForward"
              @send-backward="sendBackward"
              @bring-to-front="bringToFront"
              @send-to-back="sendToBack"
              @toggle-visibility="toggleVisibility"
            />
          </LabelTemplateEditorDockPanel>

          <LabelTemplateEditorDockPanel
            v-model:open="panels.label"
            :title="$t('components.label_template.editor.tabs.label')"
            :meta="sizeLabel"
          >
            <div class="space-y-5">
              <LabelTemplateEditorLabelSettings
                v-model="settings"
                v-model:display="display"
                v-model:border="border"
                :presets="presets ?? []"
              />
              <div class="border-t pt-4">
                <LabelTemplateEditorSheetLayoutPanel
                  v-model:sheet-layout="sheetLayout"
                  v-model:offset-x="offsetX"
                  v-model:offset-y="offsetY"
                  :preset="selectedPreset"
                  :label-width="settings.width"
                  :label-height="settings.height"
                />
              </div>
            </div>
          </LabelTemplateEditorDockPanel>

          <LabelTemplateEditorDockPanel
            v-model:open="panels.preview"
            :title="$t('components.label_template.editor.preview.print_preview')"
            :meta="previewItem?.name"
          >
            <LabelTemplateEditorPreviewPanel
              :template-id="templateId"
              :canvas-data="localCanvasData"
              :canvas-data-json="canvasDataJson"
              :width="settings.width"
              :height="settings.height"
              :dpi="settings.dpi"
              @update:item="previewItem = $event"
            />
          </LabelTemplateEditorDockPanel>
        </aside>
      </div>
    </template>

    <div v-else class="flex flex-col items-center justify-center py-12">
      <p class="text-muted-foreground">
        {{ $t("components.label_template.editor.not_found") }}
      </p>
      <Button variant="outline" class="mt-4" as-child>
        <NuxtLink to="/label-templates">{{ $t("components.label_template.editor.header.back") }}</NuxtLink>
      </Button>
    </div>
  </div>
</template>
