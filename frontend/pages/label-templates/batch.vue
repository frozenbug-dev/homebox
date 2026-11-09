<script setup lang="ts">
  import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    GripVertical,
    LayoutGrid,
    ListFilter,
    LoaderCircle,
    Printer,
    RectangleHorizontal,
    Search,
    X,
  } from "@lucide/vue";
  import { useI18n } from "vue-i18n";
  import { watchDebounced } from "@vueuse/core";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { toast } from "@/components/ui/sonner";
  import type { EntitySummary } from "~~/lib/api/types/data-contracts";
  import { useTagStore } from "~~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { cn } from "@/lib/utils";
  import { Button } from "@/components/ui/button";
  import { NumberField } from "@/components/ui/number-field";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import AppSubheader from "~/components/App/Subheader.vue";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import FilterChip from "~/components/Items/FilterChip.vue";

  const { t } = useI18n();
  const measurement = useMeasurement();

  definePageMeta({
    middleware: ["auth"],
  });

  useHead({
    title: computed(() => `HomeBox | ${t("pages.label_templates.batch.title")}`),
  });

  usePageHeader(() => [
    { label: t("menu.label_templates"), to: "/label-templates" },
    { label: t("pages.label_templates.batch.title") },
  ]);

  const api = useUserApi();
  const preferences = useViewPreferences();

  // ---------------------------------------------------------------------------
  // What to print: items or places, with the items page's filter chips
  // ---------------------------------------------------------------------------
  type Kind = "items" | "locations";
  const kind = ref<Kind>("items");

  const loading = ref(false);
  const results = ref<EntitySummary[]>([]);
  const query = ref("");

  const locationsStore = useLocationStore();
  const tagStore = useTagStore();
  const places = useFlatLocations();

  const placeIds = ref<string[]>([]);
  const tagIds = ref<string[]>([]);
  const showPlaceChip = ref(false);
  const showTagChip = ref(false);
  const placePickerOpen = ref(false);
  const tagPickerOpen = ref(false);

  // The menu closes first; opening the chip's picker in the same tick would close it again.
  function addPlaceFilter() {
    showPlaceChip.value = true;
    setTimeout(() => (placePickerOpen.value = true));
  }
  function addTagFilter() {
    showTagChip.value = true;
    setTimeout(() => (tagPickerOpen.value = true));
  }

  onMounted(async () => {
    await Promise.all([locationsStore.ensureLocationsFetched(), tagStore.ensureAllTagsFetched()]);
    await search();
  });

  async function search() {
    loading.value = true;
    try {
      if (kind.value === "locations") {
        const { data, error } = await api.items.getLocations({ filterChildren: false });
        if (error) throw new Error("locations");
        const q = query.value.trim().toLowerCase();
        results.value = (data ?? []).filter(l => !q || l.name.toLowerCase().includes(q));
      } else {
        const { data, error } = await api.items.getAll({
          q: query.value || "",
          parentIds: placeIds.value,
          tags: tagIds.value,
          pageSize: 100,
        });
        if (error) throw new Error("items");
        results.value = data.items || [];
      }
    } catch {
      toast.error(t("items.toast.failed_search_items"));
    } finally {
      loading.value = false;
    }
  }

  watchDebounced([query, placeIds, tagIds], search, { debounce: 250, maxWait: 1000 });
  watch(kind, () => {
    selectedIds.value = [];
    quantities.value = {};
    query.value = "";
    placeIds.value = [];
    tagIds.value = [];
    showPlaceChip.value = false;
    showTagChip.value = false;
    search();
  });

  // ---------------------------------------------------------------------------
  // Selection (ordered: entries print in the order they were picked) and copies
  // ---------------------------------------------------------------------------
  const selectedIds = ref<string[]>([]);
  const quantities = ref<Record<string, number>>({});
  const getQuantity = (id: string) => quantities.value[id] ?? 1;
  const setQuantity = (id: string, qty: number) => {
    quantities.value[id] = Math.max(1, Math.min(100, Number.isFinite(qty) ? qty : 1));
  };

  /** Everything picked so far, including entries a later search no longer shows. */
  const known = ref(new Map<string, EntitySummary>());
  watch(results, list => list.forEach(r => known.value.set(r.id, r)));

  const isSelected = (id: string) => selectedIds.value.includes(id);
  function toggle(id: string) {
    selectedIds.value = isSelected(id) ? selectedIds.value.filter(x => x !== id) : [...selectedIds.value, id];
  }
  const allSelected = computed(() => results.value.length > 0 && results.value.every(r => isSelected(r.id)));
  function toggleAll() {
    const visible = new Set(results.value.map(r => r.id));
    if (allSelected.value) {
      selectedIds.value = selectedIds.value.filter(id => !visible.has(id));
    } else {
      const current = new Set(selectedIds.value);
      selectedIds.value = [...selectedIds.value, ...results.value.filter(r => !current.has(r.id)).map(r => r.id)];
    }
  }
  function clearSelection() {
    selectedIds.value = [];
    quantities.value = {};
  }

  const queue = computed(() =>
    selectedIds.value.map(id => ({ id, name: known.value.get(id)?.name ?? "", qty: getQuantity(id) }))
  );
  const totalLabels = computed(() => selectedIds.value.reduce((sum, id) => sum + getQuantity(id), 0));
  const expandedIds = computed(() => selectedIds.value.flatMap(id => Array(getQuantity(id)).fill(id) as string[]));

  function rowSubtitle(row: EntitySummary) {
    if (kind.value === "items") return row.parent?.name || t("pages.label_templates.batch.no_location");
    return row.parent?.name ?? "";
  }
  function rowMeta(row: EntitySummary) {
    if (kind.value === "items") return row.assetId && row.assetId !== "0" ? `#${row.assetId}` : "";
    return t("pages.label_templates.batch.item_count", { count: row.itemCount ?? 0 });
  }

  // Drag to reorder the print order
  const dragId = ref<string | null>(null);
  function onDragStart(e: DragEvent, id: string) {
    dragId.value = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    }
  }
  function onDrop(targetId: string) {
    const from = dragId.value;
    dragId.value = null;
    if (!from || from === targetId) return;
    const order = selectedIds.value.filter(x => x !== from);
    order.splice(order.indexOf(targetId), 0, from);
    selectedIds.value = order;
  }

  // ---------------------------------------------------------------------------
  // Template and sheet layout
  // ---------------------------------------------------------------------------
  const { templates, pending: templatesPending } = useLabelTemplates();
  const { find: findPreset, title: presetTitle } = useLabelPresetLookup();
  const selectedTemplateId = ref<string>("");
  watch(
    templates,
    list => {
      if (!list || selectedTemplateId.value) return;
      selectedTemplateId.value =
        list.find(tpl => tpl.id === preferences.value.defaultTemplateId)?.id ?? list[0]?.id ?? "";
    },
    { immediate: true }
  );
  const selectedTemplate = computed(() => templates.value?.find(tpl => tpl.id === selectedTemplateId.value) ?? null);
  const preset = computed(() => findPreset(selectedTemplate.value?.preset));
  const isSheet = computed(() => preset.value?.kind === "sheet");
  const perSheet = computed(() => preset.value?.perSheet ?? 0);

  function templateMedia(tpl: { preset?: string | null; width: number; height: number }) {
    const size = measurement.formatSize(tpl.width, tpl.height);
    return tpl.preset ? `${presetTitle(tpl.preset)} · ${size}` : size;
  }

  const skipLabels = ref(0);
  watch(selectedTemplateId, () => (skipLabels.value = 0));
  const sheetCount = computed(() =>
    perSheet.value ? Math.max(1, Math.ceil((totalLabels.value + skipLabels.value) / perSheet.value)) : 0
  );

  /** The first sheet drawn from the preset's geometry; click a position to start printing there. */
  const sheetMap = computed(() => {
    const layout = preset.value?.layout;
    const p = preset.value;
    if (!isSheet.value || !layout || !p || !layout.pageWidth || !layout.pageHeight) return null;
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    const onFirst = Math.max(0, Math.min(totalLabels.value, perSheet.value - skipLabels.value));
    const cells = Array.from({ length: layout.columns * layout.rows }, (_, i) => {
      const col = i % layout.columns;
      const row = Math.floor(i / layout.columns);
      const state = i < skipLabels.value ? "skipped" : i - skipLabels.value < onFirst ? "filled" : "empty";
      return {
        i,
        state,
        style: {
          left: pct(layout.marginLeft + col * (p.width + layout.gutterH), layout.pageWidth),
          top: pct(layout.marginTop + row * (p.height + layout.gutterV), layout.pageHeight),
          width: pct(p.width, layout.pageWidth),
          height: pct(p.height, layout.pageHeight),
        },
      };
    });
    return { aspect: `${layout.pageWidth} / ${layout.pageHeight}`, cells };
  });
  function pickStart(i: number) {
    skipLabels.value = skipLabels.value === i ? 0 : i;
  }

  // ---------------------------------------------------------------------------
  // Destination and output options
  // ---------------------------------------------------------------------------
  const showCutGuides = ref(false);
  const pageSize = ref<"Letter" | "A4">("Letter");

  const { printLabels, printLocationLabels } = useDirectPrint();
  const { labelPrinting } = useServerLabelPrinting();

  const DOWNLOAD = "_download";
  const BROWSER = "_browser";
  const SERVER = "_server";
  const destination = ref<string>(DOWNLOAD);

  /** One PDF for sheets and for several labels; a single roll label downloads as an image. */
  const asPdf = computed(() => isSheet.value || totalLabels.value > 1);
  const sheetsLabel = computed(() => t("pages.label_templates.batch.sheets", { n: sheetCount.value }));

  interface Destination {
    id: string;
    label: string;
    hint: string;
    disabled?: boolean;
  }
  const destinations = computed<Destination[]>(() => {
    const list: Destination[] = [];
    if (labelPrinting.value) {
      // Server-side printing renders one label per page; sheets go out as PDF.
      list.push({
        id: SERVER,
        label: t("components.label_template.print_dialog.label_printer"),
        hint: isSheet.value
          ? t("pages.label_templates.batch.printer_sheet_hint")
          : t("components.label_template.print_dialog.label_printer_hint"),
        disabled: isSheet.value,
      });
    }
    list.push(
      {
        id: DOWNLOAD,
        label: asPdf.value
          ? t("pages.label_templates.batch.download_pdf")
          : t("pages.label_templates.batch.download_png"),
        hint: isSheet.value
          ? sheetsLabel.value
          : asPdf.value
            ? t("pages.label_templates.batch.pdf_hint")
            : t("pages.label_templates.batch.png_hint"),
      },
      {
        id: BROWSER,
        label: t("pages.label_templates.batch.print_browser"),
        hint: t("pages.label_templates.batch.browser_hint"),
      }
    );
    return list;
  });
  watch(destinations, list => {
    if (list.find(d => d.id === destination.value)?.disabled) destination.value = DOWNLOAD;
  });
  // Prefer the server's label printer once we know it exists, unless the user already chose
  let destinationTouched = false;
  function pickDestination(id: string) {
    destinationTouched = true;
    destination.value = id;
  }
  watch(
    [labelPrinting, isSheet],
    ([enabled, sheet]) => {
      if (enabled && !sheet && !destinationTouched) destination.value = SERVER;
    },
    { immediate: true }
  );

  const rendersFile = computed(() => destination.value !== SERVER);
  /** Paper size only matters when loose labels are laid out on a page; sheets bring their own. */
  const showPageSize = computed(() => rendersFile.value && !isSheet.value && asPdf.value);

  // ---------------------------------------------------------------------------
  // Preview: one real label, stepping through the print order (copies included)
  // ---------------------------------------------------------------------------
  const previewIndex = ref(0);
  watch(expandedIds, ids => (previewIndex.value = Math.min(previewIndex.value, Math.max(ids.length - 1, 0))));
  const previewId = computed(() => expandedIds.value[previewIndex.value] ?? null);

  const previewUrl = ref<string | null>(null);
  const isLoadingPreview = ref(false);

  async function renderBlob(format: "png" | "pdf", ids: string[]): Promise<Blob> {
    const body = {
      format,
      pageSize: pageSize.value,
      showCutGuides: showCutGuides.value,
      skipLabels: isSheet.value ? skipLabels.value : 0,
      canvasData: "",
    };
    return kind.value === "locations"
      ? api.labelTemplates.renderLocations(selectedTemplateId.value, { ...body, locationIds: ids })
      : api.labelTemplates.render(selectedTemplateId.value, { ...body, itemIds: ids });
  }

  async function updatePreview() {
    if (!selectedTemplateId.value || !previewId.value) {
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
      return;
    }
    isLoadingPreview.value = true;
    try {
      const blob = await renderBlob("png", [previewId.value]);
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = URL.createObjectURL(blob);
    } catch {
      previewUrl.value = null;
    } finally {
      isLoadingPreview.value = false;
    }
  }
  watchDebounced([selectedTemplateId, previewId], updatePreview, { debounce: 250 });

  // ---------------------------------------------------------------------------
  // Go
  // ---------------------------------------------------------------------------
  const isWorking = ref(false);
  const canGo = computed(() => !!selectedTemplateId.value && selectedIds.value.length > 0 && !isWorking.value);

  const summary = computed(() => {
    if (!selectedIds.value.length) return t("pages.label_templates.batch.nothing_selected");
    const base = t(`pages.label_templates.batch.summary_${kind.value === "items" ? "items" : "places"}`, {
      labels: totalLabels.value,
      count: selectedIds.value.length,
    });
    return isSheet.value ? `${base} · ${sheetsLabel.value}` : base;
  });

  const actionLabel = computed(() => {
    if (destination.value === DOWNLOAD)
      return asPdf.value
        ? t("pages.label_templates.batch.download_pdf")
        : t("pages.label_templates.batch.download_png");
    return t("pages.label_templates.batch.action_print", { n: totalLabels.value });
  });

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function go() {
    if (!canGo.value) return;
    isWorking.value = true;
    try {
      const pdf = asPdf.value;
      if (destination.value === DOWNLOAD) {
        const blob = await renderBlob(pdf ? "pdf" : "png", pdf ? expandedIds.value : selectedIds.value);
        triggerDownload(blob, `labels-batch-${Date.now()}.${pdf ? "pdf" : "png"}`);
        toast.success(t("components.label_template.toast.downloaded"));
      } else if (destination.value === BROWSER) {
        const blob = await renderBlob(pdf ? "pdf" : "png", pdf ? expandedIds.value : selectedIds.value);
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (w) w.onload = () => w.print();
        toast.success(t("components.label_template.toast.printed"));
      } else if (destination.value === SERVER) {
        const withQty = selectedIds.value.map(id => ({ id, quantity: getQuantity(id) }));
        const result =
          kind.value === "locations"
            ? await printLocationLabels(selectedTemplateId.value, withQty)
            : await printLabels(selectedTemplateId.value, withQty);
        if (!result?.success) {
          toast.error(result?.message || t("pages.label_templates.batch.direct_print_failed"));
          return;
        }
        toast.success(
          result.message || t("pages.label_templates.batch.direct_print_success", { count: result.labelCount })
        );
      }
    } catch {
      toast.error(
        t(
          destination.value === SERVER
            ? "components.label_template.toast.print_failed"
            : "components.label_template.toast.render_failed"
        )
      );
    } finally {
      isWorking.value = false;
    }
  }

  useHotkey(SHORTCUTS.batchPrint, () => go(), {
    meta: { name: t("pages.label_templates.batch.title"), group: "general" },
  });

  onBeforeUnmount(() => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  });

  const segment = (on: boolean) =>
    cn(
      "rounded-[5px] px-2.5",
      on ? "bg-background font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
    );
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeaderActions>
      <Button
        variant="outline"
        size="sm"
        class="h-[30px] text-[13px]"
        :disabled="selectedIds.length === 0"
        @click="clearSelection"
      >
        {{ $t("pages.label_templates.batch.clear") }}
      </Button>
      <Button size="sm" class="h-[30px] text-[13px]" :disabled="!canGo" @click="go">
        <LoaderCircle v-if="isWorking" class="animate-spin" />
        <Printer v-else />
        {{ actionLabel }}
        <ShortcutHint
          :hotkey="SHORTCUTS.batchPrint"
          class="hidden lg:inline-flex [&_kbd]:border-primary-foreground/20 [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground"
        />
      </Button>
    </AppHeaderActions>

    <AppSubheader>
      <div
        role="group"
        :aria-label="$t('pages.label_templates.batch.what_to_label')"
        class="inline-flex h-7 rounded-md bg-muted p-0.5 text-xs"
      >
        <button
          v-for="k in ['items', 'locations'] as const"
          :key="k"
          type="button"
          :class="segment(kind === k)"
          :aria-pressed="kind === k"
          @click="kind = k"
        >
          {{ $t(`pages.label_templates.batch.kind_${k}`) }}
        </button>
      </div>

      <label
        class="flex h-7 w-full max-w-72 min-w-36 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15"
      >
        <Search class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="sr-only">{{ $t("global.search") }}</span>
        <input
          v-model="query"
          type="search"
          :placeholder="$t(`pages.label_templates.batch.search_${kind}`)"
          class="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>

      <template v-if="kind === 'items'">
        <FilterChip
          v-if="showPlaceChip"
          v-model="placeIds"
          v-model:open="placePickerOpen"
          :label="$t('shell.items_page.place_is')"
          :options="places"
          @remove="((placeIds = []), (showPlaceChip = false))"
        />
        <FilterChip
          v-if="showTagChip"
          v-model="tagIds"
          v-model:open="tagPickerOpen"
          :label="$t('shell.items_page.tag_is')"
          :options="tagStore.tags"
          @remove="((tagIds = []), (showTagChip = false))"
        />
        <DropdownMenu v-if="!showPlaceChip || !showTagChip">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
              <ListFilter class="size-3.5" />
              {{ $t("shell.items_page.add_filter") }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-48" @close-auto-focus.prevent>
            <DropdownMenuItem v-if="!showPlaceChip" @select="addPlaceFilter">
              {{ $t("shell.items_page.filter_place") }}…
            </DropdownMenuItem>
            <DropdownMenuItem v-if="!showTagChip" @select="addTagFilter">
              {{ $t("shell.items_page.filter_tag") }}…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>

      <div class="grow" />
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ $t("pages.label_templates.batch.count", { n: results.length, selected: selectedIds.length }) }}
      </span>
    </AppSubheader>

    <!-- On large screens the page fills the window so the list and the print panel scroll on their own -->
    <div
      class="flex flex-1 flex-col lg:h-[calc(100dvh-var(--header-height)-2.75rem-0.5rem-2px)] lg:flex-none lg:flex-row"
    >
      <!-- Picker -->
      <section
        class="flex min-w-0 flex-1 flex-col overflow-y-auto p-1.5"
        :aria-label="$t('pages.label_templates.batch.pick')"
      >
        <button
          type="button"
          class="flex h-8 w-full shrink-0 items-center gap-3 rounded-md pr-3 pl-2.5 text-left text-xs text-muted-foreground hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-50"
          :disabled="results.length === 0"
          :aria-pressed="allSelected"
          @click="toggleAll"
        >
          <span
            class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs"
            :class="allSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'"
            aria-hidden="true"
          >
            <Check v-if="allSelected" class="size-3" :stroke-width="3" />
          </span>
          {{ $t("pages.label_templates.batch.select_all", { n: results.length }) }}
        </button>
        <div class="mx-1.5 mt-0.5 mb-1 h-px shrink-0 bg-border" />

        <div v-if="loading && results.length === 0" class="flex flex-1 items-center justify-center py-12">
          <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
        </div>
        <div
          v-else-if="results.length === 0"
          class="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground"
        >
          {{ $t("pages.label_templates.batch.no_items") }}
        </div>
        <ul v-else :class="{ 'opacity-60 transition-opacity': loading }">
          <li v-for="row in results" :key="row.id">
            <button
              type="button"
              class="flex h-10 w-full items-center gap-3 rounded-md pr-3 pl-2.5 text-left text-sm"
              :class="isSelected(row.id) ? 'bg-primary/8 hover:bg-primary/12' : 'hover:bg-muted/70'"
              :aria-pressed="isSelected(row.id)"
              @click="toggle(row.id)"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors"
                :class="
                  isSelected(row.id)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background'
                "
                aria-hidden="true"
              >
                <Check v-if="isSelected(row.id)" class="size-3" :stroke-width="3" />
              </span>
              <span class="max-w-[55%] shrink-0 truncate font-medium">{{ row.name }}</span>
              <span class="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{{ rowSubtitle(row) }}</span>
              <span
                v-if="isSelected(row.id) && getQuantity(row.id) > 1"
                class="shrink-0 rounded-full bg-primary/12 px-1.5 text-[11.5px] font-medium text-primary tabular-nums"
              >
                ×{{ getQuantity(row.id) }}
              </span>
              <span
                class="shrink-0 text-right text-xs text-muted-foreground tabular-nums"
                :class="{ 'font-mono': kind === 'items' }"
              >
                {{ rowMeta(row) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <!-- Print panel -->
      <aside
        class="flex shrink-0 flex-col border-t bg-muted/25 lg:w-95 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        :aria-label="$t('pages.label_templates.batch.print_settings')"
      >
        <!-- Template -->
        <div
          class="flex items-center px-4 pt-3 pb-2 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          {{ $t("components.label_template.print_dialog.template") }}
          <span class="flex-1" />
          <NuxtLink to="/label-templates" class="text-xs font-normal tracking-normal normal-case hover:text-foreground">
            {{ $t("components.label_template.print_dialog.manage_templates") }}
          </NuxtLink>
        </div>
        <div class="px-4">
          <div v-if="templatesPending" class="text-sm text-muted-foreground">{{ $t("global.loading") }}</div>
          <div v-else-if="!templates || templates.length === 0" class="text-sm text-muted-foreground">
            {{ $t("pages.label_templates.batch.no_templates") }}
            <NuxtLink to="/label-templates" class="text-primary underline">
              {{ $t("pages.label_templates.batch.create_template") }}
            </NuxtLink>
          </div>
          <DropdownMenu v-else>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-lg border border-input bg-background px-2.5 py-2 text-left shadow-xs hover:bg-muted/40"
              >
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/80">
                  <LayoutGrid v-if="isSheet" class="size-4" />
                  <RectangleHorizontal v-else class="size-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">
                    {{ selectedTemplate?.name ?? $t("components.label_template.print_dialog.select_placeholder") }}
                  </span>
                  <span v-if="selectedTemplate" class="block truncate text-xs text-muted-foreground">
                    {{ templateMedia(selectedTemplate) }}
                  </span>
                </span>
                <ChevronDown class="size-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-(--reka-dropdown-menu-trigger-width)">
              <DropdownMenuRadioGroup v-model="selectedTemplateId">
                <DropdownMenuRadioItem v-for="tpl in templates" :key="tpl.id" :value="tpl.id" class="items-start">
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ tpl.name }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ templateMedia(tpl) }}</span>
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem as-child>
                <NuxtLink to="/label-templates">{{
                  $t("components.label_template.print_dialog.manage_templates")
                }}</NuxtLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Preview -->
        <div
          class="mx-4 mt-2.5 flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg bg-muted/60 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] bg-size-[14px_14px] p-3"
        >
          <template v-if="previewId">
            <div class="flex min-h-24 items-center justify-center">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                alt=""
                class="max-h-48 max-w-full rounded-sm bg-white shadow-md transition-opacity"
                :class="{ 'opacity-60': isLoadingPreview }"
              />
              <LoaderCircle v-else-if="isLoadingPreview" class="size-5 animate-spin text-muted-foreground" />
            </div>
            <div class="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Button
                variant="ghost"
                size="icon"
                class="size-6"
                :disabled="previewIndex === 0"
                :aria-label="$t('pages.label_templates.batch.previous_label')"
                @click="previewIndex--"
              >
                <ChevronLeft class="size-3.5" />
              </Button>
              {{ $t("pages.label_templates.batch.label_of", { n: previewIndex + 1, total: expandedIds.length }) }}
              <Button
                variant="ghost"
                size="icon"
                class="size-6"
                :disabled="previewIndex >= expandedIds.length - 1"
                :aria-label="$t('pages.label_templates.batch.next_label')"
                @click="previewIndex++"
              >
                <ChevronRight class="size-3.5" />
              </Button>
            </div>
          </template>
          <p v-else class="max-w-56 text-center text-xs text-muted-foreground">
            {{ $t("pages.label_templates.batch.preview_hint") }}
          </p>
        </div>

        <!-- Start position on the first sheet -->
        <template v-if="sheetMap">
          <div class="px-4 pt-4 pb-2 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">
            {{ $t("pages.label_templates.batch.start_position") }}
          </div>
          <div class="flex items-start gap-3 px-4">
            <div
              class="relative w-28 shrink-0 rounded-sm bg-white shadow-sm ring-1 ring-border"
              :style="{ aspectRatio: sheetMap.aspect }"
            >
              <button
                v-for="cell in sheetMap.cells"
                :key="cell.i"
                type="button"
                class="absolute rounded-[1.5px] transition-colors"
                :class="{
                  'bg-primary hover:bg-primary/80': cell.state === 'filled',
                  'bg-muted hover:bg-primary/30': cell.state === 'empty',
                  'bg-[repeating-linear-gradient(45deg,hsl(var(--border))_0_2px,transparent_2px_4px)] hover:bg-primary/30':
                    cell.state === 'skipped',
                }"
                :style="cell.style"
                :aria-label="$t('pages.label_templates.batch.position', { n: cell.i + 1 })"
                :aria-pressed="cell.i === skipLabels"
                @click="pickStart(cell.i)"
              />
            </div>
            <div class="flex flex-col gap-1.5 pt-0.5 text-xs text-muted-foreground">
              <p>{{ $t("pages.label_templates.batch.start_hint") }}</p>
              <span class="flex items-center gap-1.5">
                <span class="size-2.5 rounded-[2px] bg-primary" />{{ $t("pages.label_templates.batch.legend_label") }}
              </span>
              <span class="flex items-center gap-1.5">
                <span
                  class="size-2.5 rounded-[2px] bg-[repeating-linear-gradient(45deg,hsl(var(--border))_0_2px,transparent_2px_4px)] ring-1 ring-border"
                />
                {{ $t("pages.label_templates.batch.legend_skipped", { n: skipLabels }) }}
              </span>
              <span class="tabular-nums">{{ sheetsLabel }}</span>
            </div>
          </div>
        </template>

        <!-- Print order -->
        <div
          class="flex items-center gap-2 px-4 pt-4 pb-1.5 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          {{ $t("pages.label_templates.batch.print_order") }}
          <span class="rounded-full bg-muted px-1.5 tracking-normal text-foreground/80 tabular-nums">
            {{ selectedIds.length }}
          </span>
          <span class="flex-1" />
          <span v-if="selectedIds.length > 1" class="text-xs font-normal tracking-normal normal-case">
            {{ $t("pages.label_templates.batch.drag_hint") }}
          </span>
        </div>
        <div class="px-3">
          <p
            v-if="queue.length === 0"
            class="mx-1 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
          >
            {{ $t("pages.label_templates.batch.queue_empty") }}
          </p>
          <ol v-else class="max-h-72 overflow-y-auto lg:max-h-none lg:overflow-visible">
            <li
              v-for="(entry, i) in queue"
              :key="entry.id"
              draggable="true"
              class="group/q flex h-9 items-center gap-2 rounded-md px-1 text-[13px] hover:bg-muted/60"
              :class="{ 'opacity-40': dragId === entry.id }"
              @dragstart="onDragStart($event, entry.id)"
              @dragend="dragId = null"
              @dragover.prevent
              @drop.prevent="onDrop(entry.id)"
            >
              <GripVertical class="size-3.5 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden="true" />
              <span class="w-4 shrink-0 text-right text-[11.5px] text-muted-foreground tabular-nums">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1 truncate">{{ entry.name }}</span>
              <NumberField
                :model-value="entry.qty"
                :min="1"
                :max="100"
                step-snapping
                class="h-7 w-16"
                input-class="px-2 text-center text-xs"
                :aria-label="$t('components.label_template.print_dialog.copies')"
                @update:model-value="v => setQuantity(entry.id, v ?? 1)"
              />
              <Button
                variant="ghost"
                size="icon"
                class="size-6 text-muted-foreground"
                :aria-label="$t('pages.label_templates.batch.remove', { name: entry.name })"
                @click="toggle(entry.id)"
              >
                <X class="size-3.5" />
              </Button>
            </li>
          </ol>
        </div>

        <!-- Send to -->
        <div class="px-4 pt-4 pb-2 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">
          {{ $t("components.label_template.print_dialog.send_to") }}
        </div>
        <div role="radiogroup" class="flex flex-col gap-1.5 px-4">
          <button
            v-for="dest in destinations"
            :key="dest.id"
            type="button"
            role="radio"
            :aria-checked="destination === dest.id"
            :disabled="dest.disabled"
            class="flex items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-55"
            :class="
              destination === dest.id
                ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/50'
                : 'hover:bg-muted/40 disabled:hover:bg-background'
            "
            @click="pickDestination(dest.id)"
          >
            <span
              class="size-3.5 shrink-0 rounded-full bg-background"
              :class="destination === dest.id ? 'border-[4.5px] border-primary' : 'border-[1.5px] border-input'"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium">{{ dest.label }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ dest.hint }}</span>
            </span>
          </button>
          <p v-if="!labelPrinting" class="px-0.5 text-xs text-muted-foreground">
            {{ $t("components.label_template.print_dialog.server_print_disabled_hint") }}
          </p>
          <div v-if="rendersFile" class="flex flex-wrap items-center gap-3 px-0.5 pt-1 text-xs">
            <div
              v-if="showPageSize"
              role="group"
              :aria-label="$t('pages.label_templates.batch.page_size')"
              class="inline-flex h-7 rounded-md bg-muted p-0.5"
            >
              <button
                v-for="size in ['Letter', 'A4'] as const"
                :key="size"
                type="button"
                :class="segment(pageSize === size)"
                :aria-pressed="pageSize === size"
                @click="pageSize = size"
              >
                {{ size }}
              </button>
            </div>
            <label class="flex cursor-pointer items-center gap-2">
              <input v-model="showCutGuides" type="checkbox" class="size-3.5 accent-primary" />
              {{ $t("pages.label_templates.batch.cut_guides") }}
            </label>
          </div>
        </div>

        <!-- Summary -->
        <div
          class="sticky bottom-(--bottom-nav-space) mt-auto bg-linear-to-t from-background from-60% to-transparent p-4 lg:bottom-0"
        >
          <div class="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 shadow-xs">
            <span class="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums">{{ summary }}</span>
            <Button size="sm" class="h-[30px] text-[13px]" :disabled="!canGo" @click="go">
              <LoaderCircle v-if="isWorking" class="animate-spin" />
              {{ actionLabel }}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
