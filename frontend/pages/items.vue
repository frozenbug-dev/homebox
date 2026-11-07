<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useRouteQuery } from "@vueuse/router";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { ListFilter, Plus, Search, SlidersHorizontal } from "@lucide/vue";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { useTagStore } from "~/stores/tags";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import ListTable, { type ItemColumn } from "~/components/Items/ListTable.vue";
  import FilterChip from "~/components/Items/FilterChip.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import { Button } from "@/components/ui/button";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("shell.items")}` });
  usePageHeader(() => [{ label: t("shell.items") }]);

  const tagStore = useTagStore();
  const { openDialog } = useDialog();
  const entityTypeStore = useEntityTypeStore();
  const places = useFlatLocations();

  // ----- Filters live in the URL so a filtered list can be bookmarked or shared -----

  const asArray = (v: unknown) =>
    v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v.map(String) : [String(v)];
  const opts = { mode: "replace" as const };

  const q = useRouteQuery<string>("q", "", opts);
  const placeIds = useRouteQuery<string[]>("places", [], { ...opts, transform: asArray });
  const tagIds = useRouteQuery<string[]>("tags", [], { ...opts, transform: asArray });
  const photo = useRouteQuery<string>("photo", "", opts);
  const archived = useRouteQuery<string>("archived", "", opts);
  const sort = useRouteQuery<string>("sort", "createdAt", opts);
  const dir = useRouteQuery<string>("dir", "desc", opts);

  const search = ref(q.value);
  const debouncedSearch = refDebounced(search, 250);
  watch(debouncedSearch, v => (q.value = v));

  // A chip can exist before it has values (it was just added and its picker is open).
  const showPlaceChip = ref(placeIds.value.length > 0);
  const showTagChip = ref(tagIds.value.length > 0);
  const placePickerOpen = ref(false);
  const tagPickerOpen = ref(false);

  const filtered = computed(
    () => !!q.value || placeIds.value.length > 0 || tagIds.value.length > 0 || !!photo.value || !!archived.value
  );

  function clearFilters() {
    search.value = "";
    q.value = "";
    placeIds.value = [];
    tagIds.value = [];
    photo.value = "";
    archived.value = "";
    showPlaceChip.value = false;
    showTagChip.value = false;
  }

  // Open the new chip's picker once the filter menu has finished closing,
  // otherwise the menu's focus return closes it again.
  function addPlaceFilter() {
    showPlaceChip.value = true;
    setTimeout(() => (placePickerOpen.value = true));
  }
  function addTagFilter() {
    showTagChip.value = true;
    setTimeout(() => (tagPickerOpen.value = true));
  }

  const searchInput = useTemplateRef<HTMLInputElement>("searchInput");
  useHotkey("/", () => searchInput.value?.focus(), {
    meta: { name: t("shell.items_page.focus_search"), group: "list" },
  });

  const filterMenuOpen = ref(false);
  useHotkey("F", () => (filterMenuOpen.value = true), {
    meta: { name: t("shell.items_page.add_filter"), group: "list" },
  });

  // ----- Data -----

  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));

  const query = computed(() => ({
    q: q.value || undefined,
    parentIds: placeIds.value.length ? placeIds.value : undefined,
    tags: tagIds.value.length ? tagIds.value : undefined,
    onlyWithoutPhoto: photo.value === "without" || undefined,
    onlyWithPhoto: photo.value === "with" || undefined,
    includeArchived: archived.value === "1" || undefined,
    orderBy: sort.value,
    orderDirection: dir.value,
    entityTypeIds: itemTypeIds.value,
  }));

  const { rows, total, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage } = useEntityList(
    query,
    () => itemTypeIds.value.length > 0
  );

  // ----- Display options (per browser) -----

  const columns = useLocalStorage<Record<ItemColumn, boolean>>("homebox/items/columns", {
    asset: true,
    place: true,
    tags: true,
    quantity: true,
    price: true,
    added: true,
  });
  const wide = useMediaQuery("(min-width: 768px)");
  const visibleColumns = computed<Record<ItemColumn, boolean>>(() =>
    wide.value
      ? columns.value
      : { asset: false, place: columns.value.place, tags: false, quantity: false, price: false, added: false }
  );

  const columnOptions = computed<{ id: ItemColumn; label: string }[]>(() => [
    { id: "asset", label: t("items.asset_id") },
    { id: "place", label: t("shell.items_page.filter_place") },
    { id: "tags", label: t("global.tags") },
    { id: "quantity", label: t("items.quantity") },
    { id: "price", label: t("items.purchase_price") },
    { id: "added", label: t("shell.items_page.col_added") },
  ]);
  const sortOptions = computed(() => [
    { id: "createdAt", label: t("items.created_at") },
    { id: "updatedAt", label: t("items.updated_at") },
    { id: "name", label: t("items.name") },
    { id: "assetId", label: t("items.asset_id") },
    { id: "purchasePrice", label: t("items.purchase_price") },
    { id: "quantity", label: t("items.quantity") },
  ]);
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
      <label class="flex h-7 w-full items-center gap-1.5 text-[13px] text-muted-foreground sm:w-64">
        <span class="sr-only">{{ t("shell.items_page.filter_placeholder") }}</span>
        <Search class="size-3.5 shrink-0" aria-hidden="true" />
        <input
          ref="searchInput"
          v-model="search"
          :placeholder="t('shell.items_page.filter_placeholder')"
          class="h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          @keydown.esc="($event.target as HTMLInputElement).blur()"
        />
        <ShortcutHint v-if="!search" hotkey="/" />
      </label>

      <FilterChip
        v-if="showPlaceChip"
        v-model="placeIds"
        v-model:open="placePickerOpen"
        :label="t('shell.items_page.place_is')"
        :options="places"
        @remove="((placeIds = []), (showPlaceChip = false))"
      />
      <FilterChip
        v-if="showTagChip"
        v-model="tagIds"
        v-model:open="tagPickerOpen"
        :label="t('shell.items_page.tag_is')"
        :options="tagStore.tags"
        @remove="((tagIds = []), (showTagChip = false))"
      />
      <span
        v-for="chip in [
          photo === 'without' && {
            key: 'photo',
            label: t('shell.items_page.photo_missing'),
            clear: () => (photo = ''),
          },
          photo === 'with' && { key: 'photo', label: t('shell.items_page.photo_set'), clear: () => (photo = '') },
          archived === '1' && {
            key: 'archived',
            label: t('shell.items_page.archived_included'),
            clear: () => (archived = ''),
          },
        ].filter(Boolean) as { key: string; label: string; clear: () => void }[]"
        :key="chip.key"
        class="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs"
      >
        <span class="px-2 font-medium">{{ chip.label }}</span>
        <button
          type="button"
          class="flex h-full items-center rounded-r-md px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          :aria-label="t('shell.items_page.remove_filter', { label: chip.label })"
          @click="chip.clear()"
        >
          ×
        </button>
      </span>

      <DropdownMenu v-model:open="filterMenuOpen">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
            <ListFilter class="size-3.5" />
            {{ t("shell.items_page.add_filter") }}
            <ShortcutHint hotkey="F" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-52" @close-auto-focus.prevent>
          <DropdownMenuItem @select="addPlaceFilter">{{ t("shell.items_page.filter_place") }}…</DropdownMenuItem>
          <DropdownMenuItem @select="addTagFilter">{{ t("shell.items_page.filter_tag") }}…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="photo = 'without'">{{
            t("shell.items_page.filter_photo_missing")
          }}</DropdownMenuItem>
          <DropdownMenuItem @select="photo = 'with'">{{ t("shell.items_page.filter_photo_set") }}</DropdownMenuItem>
          <DropdownMenuItem @select="archived = '1'">{{ t("shell.items_page.filter_archived") }}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="grow" />
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ t("shell.items_page.count", { n: total }) }}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="h-7 gap-1.5 px-2 text-xs">
            <SlidersHorizontal class="size-3.5" />
            {{ t("shell.items_page.display") }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuLabel class="text-xs text-muted-foreground">{{
            t("shell.items_page.sort_by")
          }}</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="sort">
            <DropdownMenuRadioItem v-for="o in sortOptions" :key="o.id" :value="o.id">{{
              o.label
            }}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup v-model="dir">
            <DropdownMenuRadioItem value="asc">{{ t("shell.items_page.ascending") }}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">{{ t("shell.items_page.descending") }}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel class="text-xs text-muted-foreground">{{
            t("shell.items_page.columns")
          }}</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            v-for="c in columnOptions"
            :key="c.id"
            :model-value="columns[c.id]"
            @select.prevent
            @update:model-value="v => (columns = { ...columns, [c.id]: !!v })"
          >
            {{ c.label }}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child>
            <NuxtLink to="/search">{{ t("shell.items_page.advanced_search") }}</NuxtLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <ListTable
      :rows="rows"
      :total="total"
      :has-next-page="!!hasNextPage"
      :is-fetching-next-page="isFetchingNextPage"
      :is-loading="isLoading"
      :columns="visibleColumns"
      :filtered="filtered"
      @load-more="fetchNextPage()"
      @clear-filters="clearFilters"
    >
      <template #append>
        <button
          type="button"
          class="flex h-10 w-full items-center gap-2 border-b border-border/60 px-4 text-left text-sm text-muted-foreground hover:bg-muted/40"
          @click="openDialog(DialogID.CreateEntity, { params: { baseType: 'item' } })"
        >
          <Plus class="size-4 text-primary" aria-hidden="true" />
          {{ t("shell.items_page.add_item_row") }}
          <ShortcutHint :hotkey="SHORTCUTS.newItem" />
        </button>
      </template>
    </ListTable>
  </div>
</template>
