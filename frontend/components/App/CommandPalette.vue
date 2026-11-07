<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import fuzzysort from "fuzzysort";
  import { refDebounced } from "@vueuse/core";
  import { useQuery, useQueryClient } from "@tanstack/vue-query";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import {
    Box,
    Check,
    FileText,
    Hammer,
    House,
    Keyboard,
    MapPin,
    Package,
    Plus,
    Printer,
    ScanQrCode,
    Settings,
    Tags,
    User,
    Wrench,
  } from "@lucide/vue";
  import type { Component } from "vue";
  import ShortcutHint from "./ShortcutHint.vue";
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
  import { Kbd } from "@/components/ui/kbd";
  import { Button } from "@/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { useTagStore } from "~/stores/tags";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import { hasCommandTokens, parseCommand } from "~/lib/command-parser";
  import { toEntityUpdate } from "~/lib/entity-update";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";

  const emit = defineEmits<{ scan: [] }>();

  const { t } = useI18n();
  const api = useUserApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const preferences = useViewPreferences();
  const { activeDialog, openDialog, closeDialog, registerOpenDialogCallback } = useDialog();

  const tagStore = useTagStore();
  const entityTypeStore = useEntityTypeStore();
  const places = useFlatLocations();

  const open = computed(() => activeDialog.value === DialogID.CommandPalette);
  const query = ref("");
  const debouncedQuery = refDebounced(query, 150);

  // "Move items into a place" mode (opened from the Places page).
  const moveInto = ref<{ id: string; name: string } | null>(null);
  const picked = ref<Set<string>>(new Set());
  const moving = ref(false);

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.CommandPalette, params => {
      query.value = "";
      picked.value = new Set();
      moveInto.value = params?.moveInto ?? null;
    });
    onUnmounted(cleanup);
  });

  // ----- Quick add -----------------------------------------------------------

  const parsed = computed(() => parseCommand(query.value));
  const isQuickAdd = computed(() => !moveInto.value && hasCommandTokens(query.value) && parsed.value.name.length > 0);

  const resolvedPlace = computed(() => {
    const name = parsed.value.place;
    if (!name) return null;
    return fuzzysort.go(name, places.value, { key: "name", limit: 1, threshold: 0.3 })[0]?.obj ?? null;
  });

  const resolvedTags = computed(() =>
    parsed.value.tags.map(name => {
      const match = fuzzysort.go(name, tagStore.tags, { key: "name", limit: 1, threshold: 0.5 })[0]?.obj;
      return match ? { id: match.id, name: match.name, isNew: false } : { id: "", name, isNew: true };
    })
  );

  const addSummary = computed(() => {
    const parts: string[] = [];
    if (parsed.value.quantity && parsed.value.quantity > 1) {
      parts.push(t("shell.palette.add_summary_qty", { n: parsed.value.quantity }));
    }
    if (resolvedTags.value.length) {
      parts.push(
        t("shell.palette.add_summary_tags", {
          tags: resolvedTags.value
            .map(tag => (tag.isNew ? `${tag.name} (${t("shell.palette.new_tag")})` : tag.name))
            .join(", "),
        })
      );
    }
    if (parsed.value.price !== undefined) parts.push(`$${parsed.value.price.toFixed(2)}`);
    return parts.join(" · ");
  });

  async function quickAdd() {
    const place = resolvedPlace.value;
    const itemType = entityTypeStore.itemTypes[0];
    if (!place || !itemType) return;

    const tagIds: string[] = [];
    for (const tag of resolvedTags.value) {
      if (!tag.isNew) {
        tagIds.push(tag.id);
        continue;
      }
      const { data, error } = await api.tags.create({ name: tag.name, description: "", color: "", icon: "" });
      if (!error && data) tagIds.push(data.id);
    }

    const { data, error } = await api.items.create({
      name: parsed.value.name,
      description: "",
      parentId: place.id,
      quantity: parsed.value.quantity ?? 1,
      tagIds,
      entityTypeId: itemType.id,
    });
    if (error || !data) {
      toast.error(t("shell.palette.add_failed"));
      return;
    }

    // Create doesn't take a price, so set it with a follow-up update.
    if (parsed.value.price !== undefined) {
      await api.items.update(data.id, toEntityUpdate(data, { purchasePrice: parsed.value.price }));
    }

    queryClient.invalidateQueries({ queryKey: ["entities"] });
    toast.success(t("shell.palette.added", { name: data.name }), {
      action: { label: t("shell.view"), onClick: () => router.push(`/item/${data.id}`) },
    });
    query.value = "";
  }

  // ----- Search --------------------------------------------------------------

  const searchTerm = computed(() =>
    (moveInto.value ? debouncedQuery.value : parseCommand(debouncedQuery.value).name).trim()
  );
  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));

  const { data: itemResults } = useQuery({
    queryKey: computed(() => [
      "entities",
      "palette",
      preferences.value.collectionId,
      searchTerm.value,
      isQuickAdd.value ? resolvedPlace.value?.id : null,
    ]),
    queryFn: async () => {
      const { data } = await api.items.getAll({
        q: searchTerm.value,
        pageSize: moveInto.value ? 20 : 6,
        entityTypeIds: itemTypeIds.value,
        parentIds: isQuickAdd.value && resolvedPlace.value ? [resolvedPlace.value.id] : undefined,
      });
      return data?.items ?? [];
    },
    enabled: computed(() => open.value && (searchTerm.value.length > 0 || !!moveInto.value)),
    placeholderData: previous => previous,
  });

  const placeResults = computed(() => {
    if (moveInto.value || isQuickAdd.value || !searchTerm.value) return [];
    return fuzzysort.go(searchTerm.value, places.value, { key: "name", limit: 4, threshold: 0.3 }).map(r => r.obj);
  });

  // ----- Navigation and actions -----------------------------------------------

  type Action = {
    id: string;
    label: string;
    icon: Component;
    run: () => void;
    hotkey?: (typeof SHORTCUTS)[keyof typeof SHORTCUTS];
  };

  const go = (to: string) => () => router.push(to);
  const actions = computed<{ nav: Action[]; act: Action[] }>(() => ({
    nav: [
      { id: "home", label: t("menu.home"), icon: House, run: go("/home"), hotkey: SHORTCUTS.goHome },
      { id: "items", label: t("shell.items"), icon: Package, run: go("/items"), hotkey: SHORTCUTS.goItems },
      { id: "places", label: t("shell.places"), icon: MapPin, run: go("/locations"), hotkey: SHORTCUTS.goPlaces },
      { id: "tags", label: t("global.tags"), icon: Tags, run: go("/tags"), hotkey: SHORTCUTS.goTags },
      { id: "templates", label: t("menu.templates"), icon: FileText, run: go("/templates") },
      { id: "labels", label: t("menu.label_templates"), icon: Printer, run: go("/label-templates") },
      { id: "maintenance", label: t("menu.maintenance"), icon: Wrench, run: go("/maintenance") },
      { id: "profile", label: t("profile.user_profile"), icon: User, run: go("/profile") },
      { id: "collection", label: t("shell.collection_settings"), icon: Settings, run: go("/collection/members") },
      { id: "tools", label: t("collection.tabs.tools"), icon: Hammer, run: go("/collection/tools") },
    ],
    act: [
      {
        id: "new-item",
        label: t("shell.shortcuts.new_item"),
        icon: Plus,
        run: () => openDialog(DialogID.CreateEntity, { params: { baseType: "item" } }),
        hotkey: SHORTCUTS.newItem,
      },
      {
        id: "new-place",
        label: t("shell.shortcuts.new_place"),
        icon: MapPin,
        run: () => openDialog(DialogID.CreateEntity, { params: { baseType: "location" } }),
        hotkey: SHORTCUTS.newPlace,
      },
      { id: "new-tag", label: t("menu.create_tag"), icon: Tags, run: () => openDialog(DialogID.CreateTag) },
      {
        id: "scan",
        label: t("shell.shortcuts.scan"),
        icon: ScanQrCode,
        run: () => emit("scan"),
        hotkey: SHORTCUTS.scan,
      },
      {
        id: "shortcuts",
        label: t("shell.shortcuts.help"),
        icon: Keyboard,
        run: () => openDialog(DialogID.Shortcuts),
        hotkey: SHORTCUTS.help,
      },
    ],
  }));

  const filterActions = (list: Action[]) =>
    searchTerm.value ? fuzzysort.go(searchTerm.value, list, { key: "label", threshold: 0.4 }).map(r => r.obj) : list;
  const navResults = computed(() => (moveInto.value || isQuickAdd.value ? [] : filterActions(actions.value.nav)));
  const actResults = computed(() => (moveInto.value || isQuickAdd.value ? [] : filterActions(actions.value.act)));

  function run(fn: () => void) {
    closeDialog(DialogID.CommandPalette);
    fn();
  }

  const openEntity = (e: EntitySummary) => run(go(`/${e.entityType?.isLocation ? "location" : "item"}/${e.id}`));

  // ----- Move into a place -------------------------------------------------------

  function togglePick(e: EntitySummary) {
    const next = new Set(picked.value);
    if (next.has(e.id)) next.delete(e.id);
    else next.add(e.id);
    picked.value = next;
  }

  async function moveSelected() {
    const target = moveInto.value;
    if (!target || picked.value.size === 0 || moving.value) return;
    moving.value = true;
    const ids = [...picked.value];
    const results = await Promise.all(ids.map(id => api.items.patch(id, { id, parentId: target.id })));
    moving.value = false;
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    if (results.some(r => r.error)) {
      toast.error(t("shell.palette.move_failed"));
      return;
    }
    toast.success(t("shell.palette.moved", { n: ids.length, place: target.name }));
    closeDialog(DialogID.CommandPalette, { moved: ids.length });
  }

  useHotkey("Mod+Enter", moveSelected, {
    enabled: () => open.value && !!moveInto.value,
    ignoreInputs: false,
  });

  const placeholder = computed(() =>
    moveInto.value ? t("shell.palette.move_search", { place: moveInto.value.name }) : t("shell.palette.placeholder")
  );
</script>

<template>
  <Dialog :dialog-id="DialogID.CommandPalette">
    <DialogContent
      class="top-[12dvh] translate-y-0 gap-0 overflow-hidden p-0 shadow-2xl sm:max-w-xl [&>button:last-child]:hidden"
    >
      <DialogTitle class="sr-only">{{ placeholder }}</DialogTitle>
      <DialogDescription class="sr-only">{{ t("shell.shortcuts.command_palette") }}</DialogDescription>
      <Command :ignore-filter="true" class="rounded-none bg-popover">
        <div v-if="moveInto" class="px-3 pt-3">
          <span
            class="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
          >
            <MapPin class="size-3" aria-hidden="true" />
            {{ t("shell.palette.move_into", { place: moveInto.name }) }}
          </span>
        </div>
        <CommandInput v-model="query" :placeholder="placeholder" class="h-12 text-base" />
        <CommandList class="max-h-[min(60dvh,420px)] border-t border-border p-1.5">
          <CommandEmpty class="py-8 text-center text-sm text-muted-foreground">
            {{ t("shell.palette.no_results") }}
          </CommandEmpty>

          <!-- Quick add -->
          <CommandGroup v-if="isQuickAdd">
            <CommandItem value="quick-add" :disabled="!resolvedPlace" class="gap-3 py-2.5" @select.prevent="quickAdd">
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <Plus class="size-4" aria-hidden="true" />
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-medium">
                  {{
                    resolvedPlace
                      ? t("shell.palette.add_item_in", { name: parsed.name, place: resolvedPlace.name })
                      : t("shell.palette.add_item", { name: parsed.name })
                  }}
                </span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ resolvedPlace ? addSummary : t("shell.palette.add_needs_place") }}
                </span>
              </span>
              <Kbd class="ml-auto">↵</Kbd>
            </CommandItem>
            <CommandItem
              value="full-form"
              class="gap-3"
              @select="run(() => openDialog(DialogID.CreateEntity, { params: { baseType: 'item' } }))"
            >
              <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <Box class="size-4" aria-hidden="true" />
              </span>
              {{ t("shell.palette.full_form") }}
            </CommandItem>
          </CommandGroup>

          <!-- Items (search results, or the move picker's candidates) -->
          <CommandGroup
            v-if="itemResults?.length && (searchTerm || moveInto)"
            :heading="
              isQuickAdd && resolvedPlace
                ? t('shell.palette.already_in', { place: resolvedPlace.name })
                : t('shell.palette.items')
            "
          >
            <template v-if="moveInto">
              <CommandItem
                v-for="item in itemResults"
                :key="item.id"
                :value="item.id"
                :disabled="item.parent?.id === moveInto.id"
                class="gap-3"
                @select.prevent="togglePick(item)"
              >
                <span
                  class="flex size-4 shrink-0 items-center justify-center rounded border border-input"
                  :class="{ 'border-primary bg-primary text-primary-foreground': picked.has(item.id) }"
                  aria-hidden="true"
                >
                  <Check v-if="picked.has(item.id)" class="size-3" />
                </span>
                <span class="truncate">{{ item.name }}</span>
                <span class="ml-auto shrink-0 text-xs text-muted-foreground">
                  {{
                    item.parent?.id === moveInto.id
                      ? t("shell.palette.already_here")
                      : item.parent
                        ? t("shell.palette.from_place", { place: item.parent.name })
                        : ""
                  }}
                </span>
              </CommandItem>
            </template>
            <template v-else>
              <CommandItem
                v-for="item in itemResults"
                :key="item.id"
                :value="item.id"
                class="gap-3"
                @select="openEntity(item)"
              >
                <span class="shrink-0 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{{
                  item.assetId
                }}</span>
                <span class="truncate">{{ item.name }}</span>
                <span v-if="item.parent" class="ml-auto shrink-0 text-xs text-muted-foreground">{{
                  item.parent.name
                }}</span>
              </CommandItem>
            </template>
          </CommandGroup>

          <CommandGroup v-if="placeResults.length" :heading="t('shell.palette.places')">
            <CommandItem
              v-for="place in placeResults"
              :key="place.id"
              :value="`place-${place.id}`"
              class="gap-3"
              @select="run(go(`/location/${place.id}`))"
            >
              <MapPin class="size-4 text-muted-foreground" aria-hidden="true" />
              <span class="truncate">{{ place.name }}</span>
              <span v-if="place.treeString !== place.name" class="ml-auto truncate text-xs text-muted-foreground">
                {{ place.treeString }}
              </span>
            </CommandItem>
          </CommandGroup>

          <CommandGroup v-if="actResults.length" :heading="t('shell.palette.actions')">
            <CommandItem v-for="a in actResults" :key="a.id" :value="`act-${a.id}`" class="gap-3" @select="run(a.run)">
              <component :is="a.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
              {{ a.label }}
              <ShortcutHint v-if="a.hotkey" :hotkey="a.hotkey" class="ml-auto" />
            </CommandItem>
          </CommandGroup>

          <CommandGroup v-if="navResults.length" :heading="t('shell.palette.go_to')">
            <CommandItem v-for="a in navResults" :key="a.id" :value="`nav-${a.id}`" class="gap-3" @select="run(a.run)">
              <component :is="a.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
              {{ a.label }}
              <ShortcutHint v-if="a.hotkey" :hotkey="a.hotkey" class="ml-auto" />
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground"
        >
          <template v-if="moveInto">
            <span class="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> {{ t("shell.palette.navigate") }}</span>
            <span class="flex items-center gap-1"><Kbd>↵</Kbd> {{ t("shell.palette.select") }}</span>
            <Button size="sm" class="ml-auto h-7" :disabled="picked.size === 0 || moving" @click="moveSelected">
              {{ t("shell.palette.move_button", { n: picked.size }) }}
              <ShortcutHint hotkey="Mod+Enter" />
            </Button>
          </template>
          <template v-else>
            <span class="flex items-center gap-1"><Kbd>@</Kbd> {{ t("shell.palette.hint_place") }}</span>
            <span class="flex items-center gap-1"><Kbd>#</Kbd> {{ t("shell.palette.hint_tag") }}</span>
            <span class="flex items-center gap-1"><Kbd>×</Kbd> {{ t("shell.palette.hint_qty") }}</span>
            <span class="flex items-center gap-1"><Kbd>$</Kbd> {{ t("shell.palette.hint_price") }}</span>
          </template>
        </div>
      </Command>
    </DialogContent>
  </Dialog>
</template>
