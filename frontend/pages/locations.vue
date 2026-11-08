<script setup lang="ts">
  import AppSubheader from "~/components/App/Subheader.vue";
  import { useI18n } from "vue-i18n";
  import { useQuery, useQueryClient } from "@tanstack/vue-query";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { useRouteQuery } from "@vueuse/router";
  import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
  import { ArrowLeft, Ellipsis, ExternalLink, Plus, Printer, Search } from "@lucide/vue";
  import { isDragData, vDropTarget, type DragData } from "~/lib/dnd";
  import { ancestors, filterTree, indexPlaces, subtreeIds } from "~/lib/place-tree";
  import { toEntityUpdate } from "~/lib/entity-update";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import { toast } from "@/components/ui/sonner";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { Button } from "@/components/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import PlacesTree, { type PlaceAction } from "~/components/Places/Tree.vue";
  import ItemList, { type ItemColumn } from "~/components/Items/List.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import Currency from "~/components/global/Currency.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("shell.places")}` });

  const api = useUserApi();
  const queryClient = useQueryClient();
  const preferences = useViewPreferences();
  const { openDialog } = useDialog();
  const entityTypeStore = useEntityTypeStore();
  const locationStore = useLocationStore();

  // ----- Data: the tree, item counts per place and value per place -----

  const collection = computed(() => preferences.value.collectionId);

  const { data: tree } = useQuery({
    queryKey: computed(() => ["entities", "tree", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.items.getTree();
      if (error) throw new Error("Failed to load places");
      return data;
    },
  });

  const { data: placeSummaries } = useQuery({
    queryKey: computed(() => ["entities", "places", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.items.getLocations({ filterChildren: false });
      if (error) throw new Error("Failed to load places");
      return data;
    },
  });

  const { data: totals } = useQuery({
    queryKey: computed(() => ["stats", "locations", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.stats.locations();
      if (error) throw new Error("Failed to load totals");
      return data;
    },
  });

  const index = computed(() => indexPlaces(tree.value ?? []));

  /** Units (summed quantities, as the API counts them) per place, including its sub-places. */
  const counts = computed(() => {
    const direct = new Map((placeSummaries.value ?? []).map(p => [p.id, p.itemCount]));
    const out = new Map<string, number>();
    for (const id of index.value.byId.keys()) {
      out.set(
        id,
        subtreeIds(index.value, id).reduce((n, sub) => n + (direct.get(sub) ?? 0), 0)
      );
    }
    return out;
  });

  // ----- Tree view state -----

  const filter = ref("");
  const hideEmpty = useLocalStorage("homebox/places/hide-empty", false);
  const expanded = useLocalStorage<string[]>("homebox/places/expanded", []);

  const visibleTree = computed(() =>
    filterTree(tree.value ?? [], filter.value, hideEmpty.value ? n => (counts.value.get(n.id) ?? 0) > 0 : undefined)
  );

  /** Where the inline "new place" row is: a place id, null for top level, undefined when closed. */
  const addingIn = ref<string | null | undefined>(undefined);

  // ----- Selection lives in the URL (?place=) -----

  const placeParam = useRouteQuery<string>("place", "", { mode: "replace" });
  const selectedId = computed(() =>
    placeParam.value && index.value.byId.has(placeParam.value) ? placeParam.value : tree.value?.[0]?.id
  );
  const selected = computed(() => (selectedId.value ? index.value.byId.get(selectedId.value) : undefined));
  const path = computed(() => (selectedId.value ? ancestors(index.value, selectedId.value) : []));

  function select(id: string) {
    placeParam.value = id;
  }

  // Keep the selected place visible in the tree.
  watch(path, parents => {
    const missing = parents.map(p => p.id).filter(id => !expanded.value.includes(id));
    if (missing.length) expanded.value = [...expanded.value, ...missing];
  });

  usePageHeader(() => [
    { label: t("shell.places"), to: "/locations" },
    ...path.value.map(p => ({ label: p.name, to: `/locations?place=${p.id}` })),
    ...(selected.value ? [{ label: selected.value.name }] : []),
  ]);

  // ----- The selected place's contents (including its sub-places) -----

  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));
  const placeAndBelow = computed(() => (selectedId.value ? subtreeIds(index.value, selectedId.value) : []));
  const subPlaceCount = computed(() => Math.max(placeAndBelow.value.length - 1, 0));
  /** Sum of quantities, which is what the tree and sidebar count. */
  const units = computed(() => (selectedId.value ? (counts.value.get(selectedId.value) ?? 0) : 0));
  const placeValue = computed(() => totals.value?.find(x => x.id === selectedId.value)?.total ?? 0);
  /** Value per place for the tree's Value column. */
  const values = computed(() => new Map((totals.value ?? []).map(x => [x.id, x.total])));

  const openInItems = computed(() => ({ path: "/items", query: { places: placeAndBelow.value } }));

  const contentsQuery = computed(() => ({
    parentIds: placeAndBelow.value,
    entityTypeIds: itemTypeIds.value,
    orderBy: "name",
    orderDirection: "asc",
  }));
  const { rows, total, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage } = useEntityList(
    contentsQuery,
    () => placeAndBelow.value.length > 0 && itemTypeIds.value.length > 0
  );

  const wide = useMediaQuery("(min-width: 768px)");
  const columns = computed<Record<ItemColumn, boolean>>(() => ({
    asset: true,
    place: subPlaceCount.value > 0,
    tags: wide.value,
    quantity: false,
    price: wide.value,
    added: false,
  }));

  // ----- Actions -----

  function refreshPlaces() {
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    // Other pickers read places from the store.
    locationStore.refreshTree();
    locationStore.refreshChildren();
    locationStore.refreshParents();
  }

  async function createPlace(name: string, parentId: string | null) {
    const placeType = entityTypeStore.locationTypes[0];
    if (!placeType) return;
    const { data, error } = await api.items.create({
      name,
      description: "",
      parentId,
      quantity: 1,
      tagIds: [],
      entityTypeId: placeType.id,
    });
    addingIn.value = undefined;
    if (error) {
      toast.error(t("shell.places_page.failed_create"));
      return;
    }
    toast.success(t("shell.places_page.created_place", { name }));
    refreshPlaces();
    select(data.id);
  }

  async function rename(name: string) {
    if (!name || !selectedId.value) return;
    const { data: place, error } = await api.items.get(selectedId.value);
    if (error) return toast.error(t("items.toast.failed_save"));
    const res = await api.items.update(place.id, toEntityUpdate(place, { name }));
    if (res.error) return toast.error(t("items.toast.failed_save"));
    refreshPlaces();
  }

  const title = useTemplateRef<InstanceType<typeof InlineText>>("title");
  function startRename() {
    title.value?.edit();
  }

  function moveItemsHere() {
    if (!selected.value) return;
    openDialog(DialogID.CommandPalette, {
      params: { moveInto: { id: selected.value.id, name: selected.value.name } },
      onClose: () => refreshPlaces(),
    });
  }

  function addInside() {
    if (selectedId.value) addingIn.value = selectedId.value;
  }

  /** Actions from a tree row's context menu: select that place, then act on it. */
  function onTreeAction(action: PlaceAction, id: string) {
    if (action === "open-in-items") {
      navigateTo({ path: "/items", query: { places: subtreeIds(index.value, id) } });
      return;
    }
    if (action === "open-details") {
      navigateTo(`/location/${id}`);
      return;
    }
    select(id);
    // Wait for the place header to show the newly selected place.
    nextTick(() => {
      if (action === "add-inside") addInside();
      else if (action === "rename") startRename();
      else if (action === "print") printLabel();
      else if (action === "move-items-here") moveItemsHere();
    });
  }

  function printAllLabels() {
    openDialog(DialogID.PrintLabelTemplate, { params: { locationIds: [...index.value.byId.keys()] } });
  }

  function printLabel() {
    if (selectedId.value) openDialog(DialogID.PrintLabelTemplate, { params: { locationIds: [selectedId.value] } });
  }

  const newItemName = ref("");
  async function addItem() {
    const name = newItemName.value.trim();
    const itemType = entityTypeStore.itemTypes[0];
    if (!name || !itemType || !selectedId.value) return;
    const { error } = await api.items.create({
      name,
      description: "",
      parentId: selectedId.value,
      quantity: 1,
      tagIds: [],
      entityTypeId: itemType.id,
    });
    if (error) {
      toast.error(t("shell.places_page.failed_create"));
      return;
    }
    newItemName.value = "";
    toast.success(t("shell.places_page.created_item", { name }));
    refreshPlaces();
  }

  // ----- Drag and drop: items or a place onto a place in the tree -----

  const dropActiveId = ref<string | null>(null);
  /** The place being dragged, so the "top level" drop zone can show while it's nested. */
  const draggingPlaceId = ref<string | null>(null);
  const canMoveToTop = computed(() => !!draggingPlaceId.value && !!index.value.parentOf.get(draggingPlaceId.value));

  /** PATCH can't clear a parent, so moving a place to the top level is a full PUT. */
  async function moveToTopLevel(placeId: string) {
    const { data: place, error } = await api.items.get(placeId);
    const res = error
      ? { error }
      : await api.items.update(placeId, toEntityUpdate(place, { parentId: null, locationId: null }));
    if (res.error) {
      toast.error(t("shell.places_page.failed_move"));
      return;
    }
    toast.success(t("shell.places_page.moved_to_top", { name: index.value.byId.get(placeId)?.name ?? "" }));
    refreshPlaces();
  }

  async function drop(source: DragData, targetId: string) {
    const target = index.value.byId.get(targetId);
    if (!target) return;
    if (source.kind === "items") {
      const results = await Promise.all(source.ids.map(id => api.items.patch(id, { id, parentId: targetId })));
      const moved = results.filter(r => !r.error).length;
      if (moved > 0) toast.success(t("shell.places_page.moved_items", { n: moved, name: target.name }));
      if (moved < results.length) toast.error(t("shell.places_page.failed_move"));
    } else {
      const place = index.value.byId.get(source.id);
      const { error } = await api.items.patch(source.id, { id: source.id, parentId: targetId });
      if (error) {
        toast.error(t("shell.places_page.failed_move"));
        return;
      }
      if (!expanded.value.includes(targetId)) expanded.value = [...expanded.value, targetId];
      toast.success(t("shell.places_page.moved_place", { name: place?.name ?? "", target: target.name }));
    }
    refreshPlaces();
  }

  let stopMonitor: (() => void) | undefined;
  onMounted(() => {
    stopMonitor = monitorForElements({
      canMonitor: ({ source }) => isDragData(source.data),
      onDragStart: ({ source }) => {
        draggingPlaceId.value = source.data.kind === "place" ? (source.data.id as string) : null;
      },
      onDropTargetChange: ({ location }) => {
        const target = location.current.dropTargets[0]?.data;
        dropActiveId.value = !target ? null : target.kind === "top-level" ? "top-level" : (target.id as string);
      },
      onDrop: ({ source, location }) => {
        dropActiveId.value = null;
        draggingPlaceId.value = null;
        const target = location.current.dropTargets[0]?.data;
        if (!isDragData(source.data)) return;
        if (target?.kind === "place") drop(source.data, target.id as string);
        if (target?.kind === "top-level" && source.data.kind === "place") moveToTopLevel(source.data.id);
      },
    });
  });
  onBeforeUnmount(() => stopMonitor?.());

  // ----- Shortcuts -----

  const placesMeta = (name: string) => ({ meta: { name: t(name), group: "places" as const } });
  const hasSelection = () => !!selected.value;

  useHotkey(SHORTCUTS.placeAddInside, addInside, {
    ...placesMeta("shell.shortcuts.place_add_inside"),
    enabled: hasSelection,
  });
  useHotkey(SHORTCUTS.placeMoveItemsHere, moveItemsHere, {
    ...placesMeta("shell.shortcuts.place_move_items_here"),
    enabled: hasSelection,
  });
  // The list's own P prints the hovered or selected rows; otherwise P prints this place's label.
  const list = useTemplateRef<{ hasTarget: boolean }>("list");
  useHotkey(SHORTCUTS.placePrint, printLabel, {
    ...placesMeta("shell.shortcuts.place_print"),
    enabled: () => hasSelection() && !list.value?.hasTarget,
  });
  useHotkey(SHORTCUTS.placeRename, startRename, {
    ...placesMeta("shell.shortcuts.place_rename"),
    enabled: hasSelection,
  });
</script>

<template>
  <div class="grid flex-1 md:grid-cols-[21rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
    <AppHeaderActions>
      <Button variant="outline" size="sm" class="h-[30px] text-[13px] max-sm:hidden" @click="printAllLabels">
        {{ t("shell.places_page.print_labels") }}
      </Button>
      <Button size="sm" class="h-[30px] text-[13px]" @click="addingIn = null">
        <Plus class="sm:hidden" />
        <span class="max-sm:sr-only">{{ t("shell.places_page.new_place") }}</span>
        <ShortcutHint
          :hotkey="SHORTCUTS.newPlace"
          class="max-lg:hidden [&_kbd]:border-primary-foreground/20 [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground"
        />
      </Button>
    </AppHeaderActions>

    <!-- All places -->
    <section
      class="flex flex-col border-border/70 md:sticky md:top-(--header-height) md:h-[calc(100svh-var(--header-height)-1rem-2px-2rem)] md:border-r"
      :class="{ 'max-md:hidden': !!placeParam }"
      :aria-label="t('shell.places')"
    >
      <AppSubheader class="flex-nowrap">
        <label class="flex flex-1 items-center gap-1.5 text-[13px] text-muted-foreground">
          <Search class="size-3.5 shrink-0" aria-hidden="true" />
          <input
            v-model="filter"
            :placeholder="t('shell.places_page.filter_placeholder')"
            :aria-label="t('shell.places_page.filter_placeholder')"
            class="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          class="h-[26px] rounded-[7px] border px-2 text-xs transition-colors"
          :class="
            hideEmpty
              ? 'border-primary/60 bg-primary/10 text-foreground'
              : 'border-border bg-background text-foreground/80 hover:bg-muted'
          "
          :aria-pressed="hideEmpty"
          @click="hideEmpty = !hideEmpty"
        >
          {{ t("shell.places_page.hide_empty") }}
        </button>
      </AppSubheader>
      <div
        class="grid h-[30px] shrink-0 grid-cols-[minmax(0,1fr)_64px_84px] items-center border-b border-border/70 px-4 text-xs text-muted-foreground"
      >
        <span>{{ t("shell.places_page.col_place") }}</span>
        <span class="text-right">{{ t("shell.places_page.col_items") }}</span>
        <span class="text-right">{{ t("shell.places_page.col_value") }}</span>
      </div>

      <div class="flex-1 overflow-y-auto">
        <PlacesTree
          v-if="tree"
          v-model:expanded="expanded"
          :tree="visibleTree"
          :index="index"
          :counts="counts"
          :values="values"
          :selected-id="selectedId"
          :drop-active-id="dropActiveId"
          :adding-in="addingIn"
          :expand-all="!!filter.trim()"
          @select="select"
          @create="createPlace"
          @cancel-create="addingIn = undefined"
          @action="onTreeAction"
        />
        <div
          v-if="canMoveToTop"
          v-drop-target="{ data: { kind: 'top-level' }, canDrop: source => source.kind === 'place' }"
          class="m-3 rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground"
          :class="{ 'border-primary bg-primary/10 text-foreground': dropActiveId === 'top-level' }"
        >
          {{ t("shell.places_page.drop_top_level") }}
        </div>
        <p
          v-if="tree && visibleTree.length === 0 && addingIn === undefined"
          class="px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {{ tree.length === 0 ? t("shell.places_page.no_places") : t("shell.places_page.no_match") }}
        </p>
      </div>

      <div
        class="hidden shrink-0 flex-wrap gap-x-3.5 gap-y-1 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground md:flex"
      >
        <span class="inline-flex items-center gap-1">
          <ShortcutHint hotkey="ArrowRight" /><ShortcutHint hotkey="ArrowLeft" />
          {{ t("shell.places_page.hint_open_close") }}
        </span>
        <span class="inline-flex items-center gap-1">
          <ShortcutHint :hotkey="SHORTCUTS.placeAddInside" />{{ t("shell.places_page.hint_add_inside") }}
        </span>
        <span class="inline-flex items-center gap-1">
          <ShortcutHint :hotkey="SHORTCUTS.placeRename" />{{ t("shell.places_page.hint_rename") }}
        </span>
        <span>{{ t("shell.places_page.hint_drag") }}</span>
      </div>
    </section>

    <!-- The selected place -->
    <section v-if="selected" class="flex min-w-0 flex-col" :class="{ 'max-md:hidden': !placeParam }">
      <header class="flex flex-col gap-2.5 border-b border-border/70 px-4 pt-[22px] pb-4 sm:px-6">
        <NuxtLink
          to="/locations"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:hidden"
        >
          <ArrowLeft class="size-3.5" />
          {{ t("shell.places_page.all_places") }}
        </NuxtLink>
        <nav v-if="path.length" class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <template v-for="(p, i) in path" :key="p.id">
            <button type="button" class="hover:text-foreground hover:underline" @click="select(p.id)">
              {{ p.name }}
            </button>
            <span v-if="i < path.length - 1" aria-hidden="true">/</span>
          </template>
        </nav>

        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <InlineText
              ref="title"
              :value="selected.name"
              :label="t('shell.places_page.rename')"
              wrap
              class="-mx-1.5 text-2xl font-semibold tracking-tight"
              @save="rename"
            />
          </div>
          <Button variant="outline" size="sm" class="h-[30px] text-[13px]" @click="startRename">
            {{ t("shell.places_page.rename") }}
            <ShortcutHint :hotkey="SHORTCUTS.placeRename" />
          </Button>
          <Button variant="outline" size="sm" class="h-[30px] text-[13px] max-sm:hidden" @click="printLabel">
            {{ t("shell.places_page.print_label") }}
            <ShortcutHint :hotkey="SHORTCUTS.placePrint" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon" class="size-[30px]" :aria-label="t('shell.item_page.more')">
                <Ellipsis class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuItem @select="addInside">
                <Plus class="size-4" />
                {{ t("shell.places_page.add_inside") }}
                <ShortcutHint :hotkey="SHORTCUTS.placeAddInside" class="ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem class="sm:hidden" @select="printLabel">
                <Printer class="size-4" />
                {{ t("shell.places_page.print_label") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem as-child>
                <NuxtLink :to="`/location/${selected.id}`">
                  <ExternalLink class="size-4" />
                  {{ t("shell.places_page.open_details") }}
                </NuxtLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p class="flex flex-wrap items-center gap-x-[18px] gap-y-1 text-[13px] text-muted-foreground">
          <span>
            <b class="font-semibold text-foreground tabular-nums">{{ total }}</b>
            {{ t("shell.places_page.stat_items", { n: total }) }}
          </span>
          <span v-if="units !== total">
            <b class="font-semibold text-foreground tabular-nums">{{ units }}</b>
            {{ t("shell.places_page.stat_units", { n: units }) }}
          </span>
          <span>
            <b class="font-semibold text-foreground tabular-nums"><Currency :amount="placeValue" /></b>
            {{ t("shell.places_page.stat_total") }}
          </span>
          <span>
            <b class="font-semibold text-foreground tabular-nums">{{ subPlaceCount }}</b>
            {{ t("shell.places_page.stat_places", { n: subPlaceCount }) }}
          </span>
        </p>
      </header>

      <AppSubheader class="flex-nowrap sm:px-5">
        <span class="font-semibold">{{ t("shell.places_page.contents") }}</span>
        <span class="truncate text-muted-foreground max-sm:hidden"
          >· {{ t("shell.places_page.including_sub_places") }}</span
        >
        <span class="flex-1" />
        <NuxtLink :to="openInItems" class="mr-1.5 shrink-0 font-medium text-primary hover:underline max-sm:hidden">
          {{ t("shell.places_page.open_in_items") }}
        </NuxtLink>
        <button
          type="button"
          class="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-primary bg-primary/10 px-2.5 font-medium text-foreground hover:bg-primary/15"
          @click="moveItemsHere"
        >
          {{ t("shell.places_page.move_items_here") }}
          <ShortcutHint :hotkey="SHORTCUTS.placeMoveItemsHere" class="max-sm:hidden" />
        </button>
      </AppSubheader>

      <ItemList
        ref="list"
        virtual
        :rows="rows"
        :total="total"
        :has-next-page="!!hasNextPage"
        :is-fetching-next-page="isFetchingNextPage"
        :is-loading="isLoading"
        :columns="columns"
        :filtered="false"
        draggable-rows
        @load-more="fetchNextPage()"
      >
        <template #append>
          <form
            class="flex h-10 items-center gap-2.5 rounded-md px-2.5 focus-within:bg-muted/70"
            @submit.prevent="addItem"
          >
            <Plus class="size-4 shrink-0 text-primary" aria-hidden="true" />
            <input
              v-model="newItemName"
              class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              :placeholder="t('shell.places_page.add_item_placeholder', { name: selected.name })"
              :aria-label="t('shell.places_page.add_item_placeholder', { name: selected.name })"
            />
          </form>
        </template>
      </ItemList>
      <p class="hidden px-5 pb-5 text-xs text-muted-foreground md:block">{{ t("shell.places_page.drag_hint") }}</p>
    </section>
  </div>
</template>
