<script setup lang="ts">
  import AppSubheader from "~/components/App/Subheader.vue";
  import { useI18n } from "vue-i18n";
  import { Plus, Printer, Upload } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import ResourceList from "~/components/Resource/List.vue";
  import LabelTemplateResource from "~/components/Resource/LabelTemplateResource.vue";
  import SelectionBar from "~/components/Resource/SelectionBar.vue";
  import SelectionAction from "~/components/Resource/SelectionAction.vue";
  import LabelTemplateCreateModal from "~/components/LabelTemplate/CreateModal.vue";
  import type {
    LabelTemplateCreate,
    LabelTemplateSummary,
    LabelmakerSheetLayout,
  } from "~~/lib/api/types/data-contracts";

  definePageMeta({
    middleware: ["auth"],
  });

  const { t } = useI18n();

  useHead({
    title: computed(() => `HomeBox | ${t("pages.label_templates.title")}`),
  });
  usePageHeader(() => [{ label: t("pages.label_templates.title") }]);

  const { templates, refresh, pending } = useLabelTemplates();
  const { create, remove } = useLabelTemplateActions();
  const confirm = useConfirm();
  const { openDialog } = useDialog();

  const handleRefresh = () => refresh();

  // Import: the file is the payload written by a card's "Export JSON", which matches the create request.
  const importInput = ref<HTMLInputElement | null>(null);
  const importing = ref(false);
  // An export is a few KB of JSON plus any embedded images (the editor caps each at 512 KB),
  // so anything beyond this is not a template and must not be read into memory.
  const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

  function parseTemplateExport(raw: unknown): LabelTemplateCreate | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
    const width = num(o.width);
    const height = num(o.height);
    const dpi = num(o.dpi);
    if (typeof o.name !== "string" || !o.name.trim()) return null;
    if (!(width > 0 && width <= 1000) || !(height > 0 && height <= 1000)) return null;
    if (!(dpi >= 72 && dpi <= 1200)) return null;
    if (!o.canvasData || typeof o.canvasData !== "object" || Array.isArray(o.canvasData)) return null;
    return {
      name: o.name.trim().slice(0, 255),
      description: typeof o.description === "string" ? o.description.slice(0, 1000) : "",
      width,
      height,
      dpi,
      preset: typeof o.preset === "string" ? o.preset : null,
      outputFormat: o.outputFormat === "pdf" ? "pdf" : "png",
      // Imported designs start private; the owner can share them afterwards.
      isShared: false,
      canvasData: o.canvasData as Record<string, unknown>,
      // The server validates the layout's values
      sheetLayout:
        o.sheetLayout && typeof o.sheetLayout === "object" && !Array.isArray(o.sheetLayout)
          ? (o.sheetLayout as LabelmakerSheetLayout)
          : null,
      offsetX: 0,
      offsetY: 0,
    };
  }

  async function handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error(t("components.label_template.toast.import_too_large", { max: "4 MB" }));
      return;
    }
    importing.value = true;
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        toast.error(t("components.label_template.toast.import_invalid"));
        return;
      }
      const body = parseTemplateExport(parsed);
      if (!body) {
        toast.error(t("components.label_template.toast.import_invalid"));
        return;
      }
      const created = await create(body);
      toast.success(t("components.label_template.toast.imported", { name: created?.name ?? body.name }));
      await refresh();
    } catch {
      toast.error(t("components.label_template.toast.import_failed"));
    } finally {
      importing.value = false;
    }
  }

  const sharedCount = computed(() => (templates.value ?? []).filter(tpl => tpl.isShared).length);

  async function removeTemplates(list: LabelTemplateSummary[]) {
    const owned = list.filter(tpl => tpl.isOwner);
    if (!owned.length) return;
    const message =
      owned.length === 1
        ? t("components.label_template.confirm_delete")
        : t("shell.templates_page.delete_confirm", { n: owned.length });
    const { isCanceled } = await confirm.open(message);
    if (isCanceled) return;
    const results = await Promise.allSettled(owned.map(tpl => remove(tpl.id)));
    if (results.some(r => r.status === "rejected")) toast.error(t("components.label_template.toast.delete_failed"));
    else toast.success(t("components.label_template.toast.deleted"));
    await refresh();
  }
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeaderActions>
      <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
        <NuxtLink to="/label-templates/batch">
          <Printer class="size-4" />
          {{ $t("pages.label_templates.batch.title") }}
        </NuxtLink>
      </Button>
      <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="importing" @click="importInput?.click()">
        <Upload class="size-4" />
        {{ $t("pages.label_templates.import_json") }}
      </Button>
      <Button size="sm" class="h-8 gap-1.5" @click="openDialog(DialogID.CreateLabelTemplate)">
        <Plus class="size-4" />
        {{ $t("pages.label_templates.new_template") }}
      </Button>
    </AppHeaderActions>
    <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="handleImport" />
    <LabelTemplateCreateModal @created="handleRefresh" />

    <AppSubheader v-if="templates" class="text-xs text-muted-foreground">
      {{ $t("pages.label_templates.subtitle", { count: templates.length, shared: sharedCount }) }}
    </AppSubheader>

    <div v-if="pending" class="px-4 py-12 text-center text-sm text-muted-foreground">{{ $t("global.loading") }}</div>

    <ResourceList
      v-else-if="templates && templates.length > 0"
      class="py-1.5"
      :items="templates"
      :get-key="tpl => tpl.id"
      :to="tpl => (tpl.isOwner ? `/label-templates/${tpl.id}/edit` : undefined)"
      :label="$t('pages.label_templates.title')"
      :row-height="48"
    >
      <template #default="{ item }">
        <LabelTemplateResource :template="item" @changed="handleRefresh" @delete="removeTemplates" />
      </template>
      <template #selection="{ items, clear }">
        <SelectionBar :count="items.length" @clear="clear">
          <SelectionAction destructive @click="removeTemplates(items).then(clear)">
            {{ $t("shell.items_page.delete") }}
          </SelectionAction>
        </SelectionBar>
      </template>
    </ResourceList>

    <div v-else class="flex flex-col items-center justify-center px-4 py-16 text-center">
      <p class="mb-1 font-medium">{{ $t("pages.label_templates.no_templates") }}</p>
      <p class="mb-4 max-w-md text-sm text-muted-foreground">{{ $t("pages.label_templates.empty_hint") }}</p>
      <Button @click="openDialog(DialogID.CreateLabelTemplate)">
        <Plus class="size-4" />
        {{ $t("components.label_template.create_modal.title") }}
      </Button>
    </div>
  </div>
</template>
