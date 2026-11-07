<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Copy, Download, Pencil, Star, StarOff, Trash2 } from "@lucide/vue";
  import type { LabelTemplateSummary } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { useResourceListContext } from "./context";
  import { toast } from "@/components/ui/sonner";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  /**
   * A label template as a list row: a small rendered preview, name, default
   * star, stock and size on the left; when it was last edited on the right.
   */
  const props = defineProps<{ template: LabelTemplateSummary }>();
  const emit = defineEmits<{ changed: []; delete: [templates: LabelTemplateSummary[]] }>();

  const { t, locale } = useI18n();
  const api = useUserApi();
  const list = useResourceListContext();
  const { duplicate } = useLabelTemplateActions();
  const { find: findPreset, title: presetTitle } = useLabelPresetLookup();
  const measurement = useMeasurement();
  const preferences = useViewPreferences();

  const asTemplates = (targets: unknown[]) => targets as LabelTemplateSummary[];
  const edited = computed(() => {
    const d = new Date(props.template.updatedAt);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString(locale.value, { month: "short", day: "numeric", year: "numeric" });
  });
  const isDefault = computed(() => preferences.value.defaultTemplateId === props.template.id);
  const preset = computed(() => findPreset(props.template.preset));
  const previewUrl = computed(() => api.labelTemplates.getPreviewUrl(props.template.id));
  const sizeLabel = computed(() => measurement.formatSize(props.template.width, props.template.height));
  const presetKind = computed(() => {
    const p = preset.value;
    if (!p) return "";
    if (p.kind === "sheet") return t("components.label_template.card.sheet_up", { count: p.perSheet ?? 0 });
    if (p.kind === "continuous") return t("components.label_template.card.continuous");
    return t("components.label_template.card.die_cut");
  });

  function toggleDefault() {
    if (isDefault.value) {
      preferences.value.defaultTemplateId = null;
      toast.success(t("components.label_template.toast.default_cleared"));
    } else {
      preferences.value.defaultTemplateId = props.template.id;
      toast.success(t("components.label_template.toast.default_set", { name: props.template.name }));
    }
  }

  async function handleDuplicate() {
    try {
      const copy = await duplicate(props.template.id);
      if (copy) {
        toast.success(t("components.label_template.toast.duplicated", { name: copy.name }));
        emit("changed");
      }
    } catch {
      toast.error(t("components.label_template.toast.duplicate_failed"));
    }
  }

  async function handleExport() {
    const { data, error } = await api.labelTemplates.get(props.template.id);
    if (error || !data) {
      toast.error(t("components.label_template.toast.export_failed"));
      return;
    }
    const payload = {
      name: data.name,
      description: data.description,
      width: data.width,
      height: data.height,
      preset: data.preset,
      dpi: data.dpi,
      outputFormat: data.outputFormat,
      canvasData: data.canvasData,
      // The page layout describes the label stock; the print offset is left out
      // because it calibrates one printer.
      sheetLayout: data.sheetLayout ?? null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "label-template"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<template>
  <ResourceRow :id="template.id">
    <template #left>
      <span class="flex h-8 w-14 shrink-0 items-center justify-center rounded bg-muted/70 p-0.5">
        <img
          :src="previewUrl"
          :alt="t('components.label_template.card.thumbnail_alt', { name: template.name })"
          class="max-h-full max-w-full rounded-[2px] bg-white shadow-xs"
          loading="lazy"
        />
      </span>
      <span class="truncate font-medium">{{ template.name }}</span>
      <Star
        v-if="isDefault"
        class="size-3.5 shrink-0 fill-amber-400 text-amber-500"
        :aria-label="t('components.label_template.default')"
      />
      <span class="hidden shrink-0 text-xs text-muted-foreground md:inline">
        <template v-if="preset">{{ presetTitle(template.preset) }} · {{ presetKind }} · </template>{{ sizeLabel }}
      </span>
      <span v-if="template.isShared" class="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
        {{ t("components.label_template.shared") }}
      </span>
      <span v-if="!template.isOwner" class="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
        {{ t("components.label_template.not_owner") }}
      </span>
      <span v-if="template.description" class="hidden truncate text-[13px] text-muted-foreground lg:inline">
        {{ template.description }}
      </span>
    </template>

    <template #right>
      <span
        class="hidden w-28 text-right text-xs whitespace-nowrap sm:inline"
        :title="t('components.label_template.card.edited')"
      >
        {{ edited }}
      </span>
    </template>

    <template #menu="{ targets }">
      <template v-if="asTemplates(targets).length === 1">
        <ContextMenuItem v-if="template.isOwner" @select="navigateTo(`/label-templates/${template.id}/edit`)">
          <Pencil /> {{ t("global.edit") }}
        </ContextMenuItem>
        <ContextMenuItem @select="handleDuplicate">
          <Copy /> {{ t("components.label_template.card.duplicate") }}
        </ContextMenuItem>
        <ContextMenuItem @select="handleExport">
          <Download /> {{ t("components.label_template.card.export_json") }}
        </ContextMenuItem>
        <ContextMenuItem @select="toggleDefault">
          <component :is="isDefault ? StarOff : Star" />
          {{
            isDefault
              ? t("components.label_template.card.clear_default")
              : t("components.label_template.card.set_default")
          }}
        </ContextMenuItem>
      </template>
      <template v-if="asTemplates(targets).some(tpl => tpl.isOwner)">
        <ContextMenuSeparator v-if="asTemplates(targets).length === 1" />
        <ContextMenuItem
          class="text-destructive focus:text-destructive"
          @select="
            (emit(
              'delete',
              asTemplates(targets).filter(tpl => tpl.isOwner)
            ),
            list.clear())
          "
        >
          <Trash2 />
          {{ t("shell.templates_page.delete", { n: asTemplates(targets).filter(tpl => tpl.isOwner).length }) }}
        </ContextMenuItem>
      </template>
    </template>
  </ResourceRow>
</template>
