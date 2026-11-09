<script setup lang="ts">
  import AppSubheader from "~/components/App/Subheader.vue";
  import { useI18n } from "vue-i18n";
  import { useQuery, useQueryClient } from "@tanstack/vue-query";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { useRouteQuery } from "@vueuse/router";
  import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
  import { ArrowLeft, Ellipsis, Link as LinkIcon, MapPin, Plus, Printer, Search, Trash2 } from "@lucide/vue";
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
  import InlineMarkdown from "~/components/Item/Inline/Markdown.vue";
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";
  import TagPicker from "~/components/Item/Inline/TagPicker.vue";
  import TagChip from "~/components/Tag/Chip.vue";
  import PlaceDetails from "~/components/Places/PlaceDetails.vue";
  import CoverPhoto from "~/components/Entity/CoverPhoto.vue";
  import AttachmentDialog from "~/components/Item/AttachmentDialog.vue";
  import { entityPhotos } from "~/lib/entity-photos";
  import type { EntityOut, EntityUpdate } from "~/lib/api/types/data-contracts";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("shell.places")}` });

  const api = useUserApi();
  const queryClient = useQueryClient();
  const preferences = useViewPreferences();
  const { openDialog } = useDialog();
  const entityTypeStore = useEntityTypeStore();
  const locationStore = useLocationStore();
  const tagStore = useTagStore();
  const confirm = useConfirm();

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
  const expanded = useLocalStorage<string[]>("homebox/places/expanded", []);

  const visibleTree = computed(() => filterTree(tree.value ?? [], filter.value));

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

  // ----- The selected place itself: every field is edited in the pane -----

  const placeKey = computed(() => ["entities", "place", selectedId.value]);
  const { data: place } = useQuery({
    queryKey: placeKey,
    queryFn: async () => {
      const { data, error } = await api.items.get(selectedId.value!);
      if (error) throw new Error("Failed to load place");
      return data;
    },
    enabled: () => !!selectedId.value,
  });

  /** A full PUT built from the loaded place, shown optimistically. */
  async function updatePlace(changes: Partial<EntityUpdate>) {
    const prev = place.value;
    if (!prev) return;
    const key = placeKey.value;
    queryClient.setQueryData(key, { ...prev, ...changes } as EntityOut);
    const { data, error } = await api.items.update(prev.id, toEntityUpdate(prev, changes));
    if (error) {
      queryClient.setQueryData(key, prev);
      toast.error(t("items.toast.failed_save"));
      return;
    }
    queryClient.setQueryData(key, data);
    // Name and parent show in the tree, the sidebar and other pickers.
    if ("name" in changes || "parentId" in changes) refreshPlaces();
  }

  function reloadPlace() {
    queryClient.invalidateQueries({ queryKey: placeKey.value });
  }

  /** The cover beside the name (the primary photo); the Details tab shows the rest. */
  const cover = computed(() => (place.value ? entityPhotos(place.value, path => api.authURL(path))[0] : undefined));
  function openAttachment(attachmentId: string) {
    const attachment = place.value?.attachments.find(a => a.id === attachmentId);
    if (!place.value || !attachment) return;
    openDialog(DialogID.Attachment, {
      params: { itemId: place.value.id, attachment, onChange: reloadPlace },
    });
  }

  const placeTags = computed(() => tagStore.withAncestors(place.value?.tags ?? []));
  const placeTagIds = computed({
    get: () => place.value?.tags.map(t => t.id) ?? [],
    set: tagIds => updatePlace({ tagIds }),
  });
  /** A place can't move inside itself or one of its sub-places. */
  const notAParent = computed(() => (selectedId.value ? subtreeIds(index.value, selectedId.value) : []));
  const parentPlace = computed(() => path.value.at(-1));

  const tab = useRouteQuery<string>("tab", "contents", { mode: "replace" });

  async function copyLink() {
    if (!selectedId.value) return;
    await navigator.clipboard.writeText(`${window.location.origin}/locations?place=${selectedId.value}`);
    toast.success(t("shell.item_page.link_copied"));
  }

  async function deletePlace(id: string) {
    const target = index.value.byId.get(id);
    const { isCanceled } = await confirm.open(t("locations.location_items_delete_confirm"));
    if (isCanceled) return;
    const { error } = await api.items.delete(id);
    if (error) {
      toast.error(t("locations.toast.failed_delete_location"));
      return;
    }
    toast.success(t("shell.places_page.deleted_place", { name: target?.name ?? "" }));
    // Land on the parent, or the first place when it was top level.
    if (id === selectedId.value) placeParam.value = index.value.parentOf.get(id) ?? "";
    refreshPlaces();
  }

  // ----- The selected place's contents (including its sub-places) -----

  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));
  const placeAndBelow = computed(() => (selectedId.value ? subtreeIds(index.value, selectedId.value) : []));
  const subPlaceCount = computed(() => Math.max(placeAndBelow.value.length - 1, 0));
  /** Value per place for the tree's Value column. */
  const values = computed(() => new Map((totals.value ?? []).map(x => [x.id, x.total])));

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

  const wide = useMediaQuery("(width >= 48rem)");
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

  function rename(name: string) {
    if (name) updatePlace({ name });
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
    if (action === "delete") {
      deletePlace(id);
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
    <AttachmentDialog />
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
      class="flex flex-col border-border/70 md:sticky md:top-(--header-height) md:h-[calc(100svh-var(--header-height)-0.5rem-2px)] md:border-r"
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
          @move="(id, parentId) => (parentId ? drop({ kind: 'place', id }, parentId) : moveToTopLevel(id))"
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

        <div class="flex flex-col items-start gap-4 sm:flex-row">
          <CoverPhoto
            v-if="place"
            :entity-id="place.id"
            :photo="cover"
            @uploaded="reloadPlace"
            @view="p => openAttachment(p.attachmentId)"
          />
          <div class="flex w-full min-w-0 flex-1 flex-col gap-1">
            <div class="flex flex-wrap items-center gap-3">
              <div class="min-w-0 flex-1">
                <InlineText
                  ref="title"
                  :value="place?.name ?? selected.name"
                  :label="t('shell.places_page.rename')"
                  wrap
                  class="-mx-1.5 text-2xl font-semibold tracking-tight"
                  @save="rename"
                />
              </div>
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
                  <DropdownMenuItem @select="copyLink">
                    <LinkIcon class="size-4" />
                    {{ t("shell.item_page.copy_link") }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deletePlace(selected.id)">
                    <Trash2 class="size-4" />
                    {{ t("shell.places_page.delete_place") }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div v-if="place" class="max-w-160">
              <InlineMarkdown
                :value="place.description"
                :label="$t('items.description')"
                :placeholder="t('shell.item_page.add_description')"
                @save="description => updatePlace({ description })"
              />
            </div>
          </div>
        </div>

        <template v-if="place">
          <!-- Properties, each edited where it sits -->
          <div class="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            <PlacePicker
              :current-id="parentPlace?.id"
              :exclude-ids="notAParent"
              allow-top
              @pick="p => updatePlace({ parentId: p.id })"
              @top="updatePlace({ parentId: null, locationId: null })"
            >
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-[7px] border border-border px-2 hover:bg-muted"
              >
                <span class="text-muted-foreground">{{ t("shell.places_page.inside") }}</span>
                <MapPin v-if="parentPlace" class="size-3.5 text-primary" aria-hidden="true" />
                <span class="font-medium">{{ parentPlace?.name ?? t("shell.places_page.top_level") }}</span>
              </button>
            </PlacePicker>
            <DropdownMenu v-if="entityTypeStore.locationTypes.length > 1">
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="flex h-7 items-center gap-1.5 rounded-[7px] border border-border px-2 hover:bg-muted"
                >
                  <span class="text-muted-foreground">{{ t("shell.places_page.type") }}</span>
                  <span class="font-medium">{{ place.entityType?.name }}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="w-48">
                <DropdownMenuItem
                  v-for="type in entityTypeStore.locationTypes"
                  :key="type.id"
                  :class="{ 'font-medium': type.id === place.entityType?.id }"
                  @select="type.id !== place.entityType?.id && updatePlace({ entityTypeId: type.id })"
                >
                  {{ type.name }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span
              class="flex h-7 items-center gap-1 rounded-[7px] border border-border pl-2 focus-within:ring-1 focus-within:ring-ring/40"
            >
              <span class="text-muted-foreground">{{ $t("items.asset_id") }}</span>
              <InlineText
                :value="place.assetId"
                :label="$t('items.asset_id')"
                class="min-w-10 py-0.5 font-mono font-medium focus-within:ring-0 hover:bg-transparent"
                @save="assetId => updatePlace({ assetId })"
              />
            </span>
            <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <TagChip v-for="tag in placeTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
            <TagPicker v-model="placeTagIds">
              <button
                type="button"
                class="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                :aria-label="t('shell.item_page.add_tags')"
              >
                <Plus class="size-3.5" />
                <span v-if="placeTags.length === 0">{{ t("shell.item_page.add_tags") }}</span>
              </button>
            </TagPicker>
          </div>
        </template>
      </header>

      <AppSubheader class="flex-nowrap gap-4 py-0 sm:px-5">
        <div role="tablist" :aria-label="t('shell.places_page.sections')" class="flex h-full items-stretch gap-4">
          <button
            v-for="tb in [
              { id: 'contents', label: t('shell.places_page.contents'), count: total },
              { id: 'details', label: t('shell.places_page.details'), count: undefined },
            ]"
            :key="tb.id"
            type="button"
            role="tab"
            :aria-selected="tab === tb.id"
            class="flex items-center gap-1.5 border-b-2 text-[13.5px] transition-colors"
            :class="
              tab === tb.id
                ? 'border-foreground font-semibold text-foreground'
                : 'border-transparent font-medium text-muted-foreground hover:text-foreground'
            "
            @click="tab = tb.id"
          >
            {{ tb.label }}
            <span v-if="tb.count !== undefined" class="text-xs font-normal text-muted-foreground tabular-nums">{{
              tb.count
            }}</span>
          </button>
        </div>
      </AppSubheader>

      <PlaceDetails
        v-if="tab === 'details' && place"
        :place="place"
        @update="updatePlace"
        @reload="reloadPlace"
        @open-attachment="openAttachment"
      />
      <template v-else-if="tab !== 'details'">
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
        </ItemList>
      </template>
    </section>
  </div>
</template>
