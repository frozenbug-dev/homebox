<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import ResourceList from "~/components/Resource/List.vue";
  import ItemResource, { type ItemColumn } from "~/components/Resource/ItemResource.vue";
  import SelectionBar from "~/components/Resource/SelectionBar.vue";
  import SelectionAction from "~/components/Resource/SelectionAction.vue";
  import { resourceChangedKey } from "~/components/Resource/context";
  import { Button } from "@/components/ui/button";

  export type { ItemColumn };

  /**
   * A list of items: rows, a floating bar for the selection, and the M / T / P
   * shortcuts acting on the selection (or the focused row).
   */
  const props = withDefaults(
    defineProps<{
      rows: EntitySummary[];
      total: number;
      columns: Record<ItemColumn, boolean>;
      hasNextPage?: boolean;
      isFetchingNextPage?: boolean;
      isLoading?: boolean;
      filtered?: boolean;
      /** Window-scroll virtualization (for the long Items list). */
      virtual?: boolean;
      /** Rows can be dragged onto places. */
      draggableRows?: boolean;
      hotkeys?: boolean;
      /** Hide the "N items loaded" footer and empty text (for short embedded lists). */
      bare?: boolean;
    }>(),
    { hotkeys: true }
  );
  const emit = defineEmits<{
    loadMore: [];
    clearFilters: [];
    /** Something in the list changed (for lists loaded outside the query cache). */
    changed: [];
  }>();

  const { t } = useI18n();
  const places = useFlatLocations();
  const placeIds = computed(() => new Set(places.value.map(p => p.id)));

  const list = useTemplateRef<{ target: () => EntitySummary[]; clear: () => void }>("list");
  const target = () => list.value?.target() ?? [];
  const changed = () => emit("changed");
  provide(resourceChangedKey, changed);
  const actions = useItemActions({ clear: () => list.value?.clear(), changed });

  const listMeta = (name: string) => ({ meta: { name: t(name), group: "list" as const } });
  const hasTarget = () => props.hotkeys && target().length > 0;
  useHotkey(SHORTCUTS.selectionMove, () => actions.move(target()), {
    ...listMeta("shell.shortcuts.selection_move"),
    enabled: hasTarget,
  });
  useHotkey(SHORTCUTS.selectionTag, () => actions.tag(target()), {
    ...listMeta("shell.shortcuts.selection_tag"),
    enabled: hasTarget,
  });
  useHotkey(SHORTCUTS.selectionPrint, () => actions.print(target()), {
    ...listMeta("shell.shortcuts.selection_print"),
    enabled: hasTarget,
  });

  /** Whether M / T / P would act on something (a selection or the focused row). */
  defineExpose({ hasTarget: computed(() => target().length > 0) });
</script>

<template>
  <div class="py-1.5">
    <ResourceList
      ref="list"
      :items="rows"
      :get-key="i => i.id"
      :to="i => `/item/${i.id}`"
      :label="t('shell.items')"
      auto-height
      :virtual="virtual"
      :hotkeys="hotkeys"
      :has-next-page="hasNextPage"
      :is-fetching-next-page="isFetchingNextPage"
      @load-more="emit('loadMore')"
    >
      <template #default="{ item }">
        <ItemResource :item="item" :columns="columns" :place-ids="placeIds" :draggable="draggableRows" />
      </template>
      <template #selection="{ items, clear }">
        <SelectionBar :count="items.length" @clear="clear">
          <SelectionAction :hotkey="SHORTCUTS.selectionMove" @click="actions.move(items)">
            {{ t("shell.items_page.move") }}
          </SelectionAction>
          <SelectionAction :hotkey="SHORTCUTS.selectionTag" @click="actions.tag(items)">
            {{ t("shell.items_page.tag") }}
          </SelectionAction>
          <SelectionAction :hotkey="SHORTCUTS.selectionPrint" @click="actions.print(items)">
            {{ t("shell.items_page.print") }}
          </SelectionAction>
          <SelectionAction destructive @click="actions.remove(items)">
            {{ t("shell.items_page.delete") }}
          </SelectionAction>
        </SelectionBar>
      </template>
    </ResourceList>

    <div v-if="!bare" class="flex flex-col items-center gap-3 px-4 py-6 text-center text-sm text-muted-foreground">
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
  </div>
</template>
