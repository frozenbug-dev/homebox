<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useWindowVirtualizer } from "@tanstack/vue-virtual";
  import { getCoreRowModel, useVueTable, type RowSelectionState, type VisibilityState } from "@tanstack/vue-table";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { useQueryClient } from "@tanstack/vue-query";
  import { GripVertical, Minus, Plus } from "@lucide/vue";
  import PlaceCell from "./PlaceCell.vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { vDragSource, type DragData } from "~/lib/dnd";
  import { valueUpdater } from "~/lib/utils";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import Currency from "~/components/global/Currency.vue";
  import DateTime from "~/components/global/DateTime.vue";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Button } from "@/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";

  export type ItemColumn = "asset" | "place" | "tags" | "quantity" | "price" | "added";

  const props = defineProps<{
    rows: EntitySummary[];
    total: number;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    columns: Record<ItemColumn, boolean>;
    filtered: boolean;
    /** Rows can be dragged onto drop targets (e.g. places in the places tree); shows a ⋮⋮ grip. */
    draggableRows?: boolean;
    /** Leave out the column header row (compact lists). */
    hideHeader?: boolean;
  }>();
  const emit = defineEmits<{ loadMore: []; clearFilters: [] }>();

  const { t } = useI18n();
  const router = useRouter();
  const api = useUserApi();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { openDialog } = useDialog();
  const { mutate: patch } = usePatchEntity();
  const places = useFlatLocations();
  const placeIds = computed(() => new Set(places.value.map(p => p.id)));

  // ----- Table state (TanStack Table owns selection and column visibility) -----

  const rowSelection = ref<RowSelectionState>({});
  const columnVisibility = computed<VisibilityState>(() => ({ ...props.columns }));

  const table = useVueTable({
    get data() {
      return props.rows;
    },
    columns: [
      { id: "select" },
      { id: "name" },
      { id: "place" },
      { id: "tags" },
      { id: "quantity" },
      { id: "price" },
      { id: "added" },
      { id: "asset" },
    ],
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    state: {
      get rowSelection() {
        return rowSelection.value;
      },
      get columnVisibility() {
        return columnVisibility.value;
      },
    },
    onRowSelectionChange: updater => valueUpdater(updater, rowSelection),
  });

  const tableRows = computed(() => table.getRowModel().rows);
  const selectedItems = computed(() => table.getSelectedRowModel().rows.map(r => r.original));

  /** Dragging a selected row drags the whole selection; any other row drags just itself. */
  function dragData(index: number): DragData {
    const row = tableRows.value[index]!;
    const ids = row.getIsSelected() ? selectedItems.value.map(i => i.id) : [row.original.id];
    return { kind: "items", ids };
  }
  const show = (c: ItemColumn) => props.columns[c];

  // Column widths drive one CSS grid shared by the header and every row.
  const gridTemplate = computed(() =>
    [
      "2.25rem",
      "minmax(12rem, 1fr)",
      show("place") ? "minmax(8rem, 11rem)" : "",
      show("tags") ? "minmax(8rem, 14rem)" : "",
      show("quantity") ? "6.5rem" : "",
      show("price") ? "6.5rem" : "",
      show("added") ? "6rem" : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  // ----- Virtualized window scrolling + infinite loading -----

  const listEl = ref<HTMLElement | null>(null);
  const scrollMargin = ref(0);
  const ROW_HEIGHT = 44;

  const virtualizer = useWindowVirtualizer(
    computed(() => ({
      count: tableRows.value.length,
      estimateSize: () => ROW_HEIGHT,
      overscan: 12,
      scrollMargin: scrollMargin.value,
    }))
  );

  const measure = () => {
    if (listEl.value) scrollMargin.value = listEl.value.getBoundingClientRect().top + window.scrollY;
  };
  onMounted(measure);
  useResizeObserver(listEl, measure);

  const virtualRows = computed(() => virtualizer.value.getVirtualItems());
  const totalSize = computed(() => virtualizer.value.getTotalSize());

  watch(virtualRows, items => {
    const last = items[items.length - 1];
    if (last && last.index >= tableRows.value.length - 15 && props.hasNextPage && !props.isFetchingNextPage) {
      emit("loadMore");
    }
  });

  // ----- Keyboard -----

  const focused = ref(-1);
  watch(
    () => props.rows,
    () => {
      if (focused.value >= props.rows.length) focused.value = props.rows.length - 1;
    }
  );

  function focusRow(index: number) {
    if (!tableRows.value.length) return;
    focused.value = Math.max(0, Math.min(index, tableRows.value.length - 1));
    virtualizer.value.scrollToIndex(focused.value, { align: "auto" });
  }

  const listMeta = (name: string) => ({ meta: { name: t(name), group: "list" } });
  const target = () =>
    selectedItems.value.length ? selectedItems.value : props.rows[focused.value] ? [props.rows[focused.value]!] : [];

  useHotkey(SHORTCUTS.listDown, () => focusRow(focused.value + 1), listMeta("shell.shortcuts.list_down"));
  useHotkey(SHORTCUTS.listUp, () => focusRow(focused.value - 1), listMeta("shell.shortcuts.list_up"));
  useHotkey(
    SHORTCUTS.listOpen,
    () => {
      const row = props.rows[focused.value];
      if (row) router.push(`/item/${row.id}`);
    },
    listMeta("shell.shortcuts.list_open")
  );
  useHotkey(
    SHORTCUTS.listSelect,
    () => tableRows.value[focused.value]?.toggleSelected(),
    listMeta("shell.shortcuts.list_select")
  );
  useHotkey(SHORTCUTS.selectionMove, () => bulkMove(), {
    ...listMeta("shell.shortcuts.selection_move"),
    enabled: () => target().length > 0,
  });
  useHotkey(SHORTCUTS.selectionTag, () => bulkTag(), {
    ...listMeta("shell.shortcuts.selection_tag"),
    enabled: () => target().length > 0,
  });
  useHotkey(SHORTCUTS.selectionPrint, () => bulkPrint(), {
    ...listMeta("shell.shortcuts.selection_print"),
    enabled: () => target().length > 0,
  });
  useHotkey(SHORTCUTS.selectionClear, () => table.resetRowSelection(), {
    ...listMeta("shell.shortcuts.selection_clear"),
    enabled: () => selectedItems.value.length > 0,
  });

  /** Whether M / T / P would act on something (a selection or the focused row). */
  defineExpose({ hasTarget: computed(() => target().length > 0) });

  // ----- Actions -----

  const afterBulk = () => {
    table.resetRowSelection();
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  };

  function bulkMove() {
    const items = target();
    if (!items.length) return;
    openDialog(DialogID.ItemChangeDetails, { params: { items, changeLocation: true }, onClose: afterBulk });
  }
  function bulkTag() {
    const items = target();
    if (!items.length) return;
    openDialog(DialogID.ItemChangeDetails, { params: { items, addTags: true }, onClose: afterBulk });
  }
  function bulkPrint() {
    const items = target();
    if (!items.length) return;
    openDialog(DialogID.PrintLabelTemplate, { params: { itemIds: items.map(i => i.id) } });
  }
  async function bulkDelete() {
    const items = selectedItems.value;
    if (!items.length) return;
    const { isCanceled } = await confirm.open(t("shell.items_page.delete_confirm", { n: items.length }));
    if (isCanceled) return;
    await Promise.all(items.map(i => api.items.delete(i.id)));
    toast.success(t("shell.items_page.deleted", { n: items.length }));
    afterBulk();
  }

  function movePlace(item: EntitySummary, place: FlatTreeItem) {
    patch(
      {
        patch: { id: item.id, parentId: place.id },
        optimistic: { parent: { ...(item.parent ?? item), id: place.id, name: place.name } },
      },
      { onSuccess: () => toast.success(t("shell.items_page.moved_to", { place: place.name })) }
    );
  }

  function setQuantity(item: EntitySummary, quantity: number) {
    if (quantity < 0) return;
    patch({ patch: { id: item.id, quantity }, optimistic: { quantity } });
  }

  const allSelected = computed(() =>
    table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false
  );
</script>

<template>
  <div role="grid" :aria-rowcount="total" class="text-sm">
    <!-- Header row: sticks below the panel header while the list scrolls. -->
    <div
      v-if="!hideHeader"
      role="row"
      class="sticky top-(--header-height-mobile) z-10 grid h-9 items-center border-b border-border bg-background px-3 text-xs text-muted-foreground sm:top-(--header-height)"
      :style="{ gridTemplateColumns: gridTemplate }"
    >
      <span role="columnheader" class="flex items-center">
        <Checkbox
          :model-value="allSelected"
          :aria-label="t('shell.items_page.select_all')"
          @update:model-value="v => table.toggleAllRowsSelected(!!v)"
        />
      </span>
      <span role="columnheader">{{ t("items.name") }}</span>
      <span v-if="show('place')" role="columnheader">{{ t("shell.items_page.filter_place") }}</span>
      <span v-if="show('tags')" role="columnheader">{{ t("global.tags") }}</span>
      <span v-if="show('quantity')" role="columnheader">{{ t("items.quantity") }}</span>
      <span v-if="show('price')" role="columnheader" class="text-right">{{ t("items.purchase_price") }}</span>
      <span v-if="show('added')" role="columnheader" class="pl-3">{{ t("shell.items_page.col_added") }}</span>
    </div>

    <div ref="listEl" class="relative" :style="{ height: `${totalSize}px` }">
      <div
        v-for="vRow in virtualRows"
        :key="tableRows[vRow.index]!.id"
        v-drag-source="draggableRows ? () => dragData(vRow.index) : null"
        role="row"
        :aria-rowindex="vRow.index + 1"
        :aria-selected="tableRows[vRow.index]!.getIsSelected()"
        class="group absolute inset-x-0 top-0 grid cursor-pointer items-center border-b border-border/60 px-3 hover:bg-muted/40"
        :class="{
          'bg-accent/50 hover:bg-accent/60': tableRows[vRow.index]!.getIsSelected(),
          'outline-2 -outline-offset-2 outline-ring/50': vRow.index === focused,
        }"
        :style="{
          height: `${ROW_HEIGHT}px`,
          transform: `translateY(${vRow.start - virtualizer.options.scrollMargin}px)`,
          gridTemplateColumns: gridTemplate,
        }"
        @click="router.push(`/item/${tableRows[vRow.index]!.original.id}`)"
        @mouseenter="focused = vRow.index"
      >
        <span class="flex items-center" @click.stop>
          <GripVertical
            v-if="draggableRows && !selectedItems.length"
            class="size-4 cursor-grab text-muted-foreground/50 group-hover:hidden"
            aria-hidden="true"
          />
          <Checkbox
            :class="{ 'hidden group-hover:inline-flex': draggableRows && !selectedItems.length }"
            :model-value="tableRows[vRow.index]!.getIsSelected()"
            :aria-label="t('components.item.view.selectable.select_card')"
            @update:model-value="v => tableRows[vRow.index]!.toggleSelected(!!v)"
          />
        </span>
        <span class="flex min-w-0 items-center gap-2.5">
          <span v-if="show('asset')" class="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {{ tableRows[vRow.index]!.original.assetId }}
          </span>
          <NuxtLink
            :to="`/item/${tableRows[vRow.index]!.original.id}`"
            class="truncate font-medium hover:underline"
            @click.stop
          >
            {{ tableRows[vRow.index]!.original.name }}
          </NuxtLink>
        </span>
        <span v-if="show('place')" class="min-w-0">
          <PlaceCell
            :item="tableRows[vRow.index]!.original"
            :place-ids="placeIds"
            @move="p => movePlace(tableRows[vRow.index]!.original, p)"
          />
        </span>
        <span v-if="show('tags')" class="flex min-w-0 gap-1 overflow-hidden">
          <span
            v-for="tag in tableRows[vRow.index]!.original.tags.slice(0, 3)"
            :key="tag.id"
            class="truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80"
          >
            {{ tag.name }}
          </span>
          <span v-if="tableRows[vRow.index]!.original.tags.length > 3" class="text-xs text-muted-foreground">
            +{{ tableRows[vRow.index]!.original.tags.length - 3 }}
          </span>
        </span>
        <span v-if="show('quantity')" class="flex items-center gap-0.5 tabular-nums" @click.stop>
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100"
            :aria-label="t('shell.items_page.decrease')"
            @click="setQuantity(tableRows[vRow.index]!.original, tableRows[vRow.index]!.original.quantity - 1)"
          >
            <Minus class="size-3" />
          </button>
          <span class="min-w-6 text-center">{{ tableRows[vRow.index]!.original.quantity }}</span>
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100"
            :aria-label="t('shell.items_page.increase')"
            @click="setQuantity(tableRows[vRow.index]!.original, tableRows[vRow.index]!.original.quantity + 1)"
          >
            <Plus class="size-3" />
          </button>
        </span>
        <span v-if="show('price')" class="text-right tabular-nums">
          <Currency
            v-if="tableRows[vRow.index]!.original.purchasePrice"
            :amount="tableRows[vRow.index]!.original.purchasePrice"
          />
        </span>
        <span v-if="show('added')" class="pl-3 text-xs text-muted-foreground">
          <DateTime :date="tableRows[vRow.index]!.original.createdAt" format="long" datetime-type="date" />
        </span>
      </div>
    </div>

    <!-- e.g. an "add item" row that ends the list -->
    <slot v-if="!isLoading" name="append" />

    <div class="flex flex-col items-center gap-3 px-4 py-6 text-center text-sm text-muted-foreground">
      <template v-if="isLoading" />
      <template v-else-if="!rows.length">
        <p>{{ filtered ? t("shell.items_page.empty") : t("shell.items_page.empty_none") }}</p>
        <Button v-if="filtered" variant="outline" size="sm" @click="emit('clearFilters')">
          {{ t("shell.items_page.clear_filters") }}
        </Button>
      </template>
      <span v-else-if="isFetchingNextPage">{{ t("shell.items_page.loading_more") }}</span>
      <span v-else-if="!hasNextPage" class="text-xs">{{ t("shell.items_page.all_loaded", { n: total }) }}</span>
    </div>

    <!-- Actions for the selection -->
    <Transition
      enter-from-class="translate-y-4 opacity-0"
      leave-to-class="translate-y-4 opacity-0"
      enter-active-class="transition"
      leave-active-class="transition"
    >
      <div
        v-if="selectedItems.length"
        role="toolbar"
        :aria-label="t('shell.items_page.selected', { n: selectedItems.length })"
        class="fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-xl bg-foreground p-1.5 text-sm text-background shadow-2xl md:left-[calc(50%+var(--sidebar-width)/2)]"
      >
        <span class="px-2.5 font-medium">{{ t("shell.items_page.selected", { n: selectedItems.length }) }}</span>
        <button
          type="button"
          class="flex h-8 items-center gap-2 rounded-lg px-2.5 hover:bg-background/15"
          @click="bulkMove"
        >
          {{ t("shell.items_page.move") }}
          <ShortcutHint :hotkey="SHORTCUTS.selectionMove" class="[&_kbd]:bg-background/15 [&_kbd]:text-background" />
        </button>
        <button
          type="button"
          class="flex h-8 items-center gap-2 rounded-lg px-2.5 hover:bg-background/15"
          @click="bulkTag"
        >
          {{ t("shell.items_page.tag") }}
          <ShortcutHint :hotkey="SHORTCUTS.selectionTag" class="[&_kbd]:bg-background/15 [&_kbd]:text-background" />
        </button>
        <button
          type="button"
          class="flex h-8 items-center gap-2 rounded-lg px-2.5 hover:bg-background/15"
          @click="bulkPrint"
        >
          {{ t("shell.items_page.print") }}
          <ShortcutHint :hotkey="SHORTCUTS.selectionPrint" class="[&_kbd]:bg-background/15 [&_kbd]:text-background" />
        </button>
        <button
          type="button"
          class="flex h-8 items-center rounded-lg px-2.5 text-destructive hover:bg-background/15"
          @click="bulkDelete"
        >
          {{ t("shell.items_page.delete") }}
        </button>
      </div>
    </Transition>
  </div>
</template>
