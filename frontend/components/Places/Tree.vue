<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { TreeItem as TreeRow, TreeRoot } from "reka-ui";
  import type { FlattenedItem } from "reka-ui";
  import { ChevronRight, MapPin } from "@lucide/vue";
  import type { TreeItem } from "~/lib/api/types/data-contracts";
  import { vDragSource, vDropTarget, type DragData } from "~/lib/dnd";
  import { canNest, type PlaceIndex } from "~/lib/place-tree";
  import Currency from "~/components/global/Currency.vue";

  /**
   * The places tree: arrow keys move and open/close, Enter or a click selects.
   * Every row can be dragged onto another place, and accepts dropped places
   * and items (the page's drop monitor does the move).
   */
  const props = defineProps<{
    tree: TreeItem[];
    index: PlaceIndex;
    /** Item count per place, including what's in its sub-places. */
    counts: Map<string, number>;
    /** Total value per place, for the Value column. */
    values?: Map<string, number>;
    selectedId?: string;
    /** Place currently hovered by a drag. */
    dropActiveId?: string | null;
    /** Where an inline "new place" row is open: a place id, null for the top level, undefined for none. */
    addingIn?: string | null;
    /** Open every row (used while filtering). */
    expandAll?: boolean;
  }>();
  const emit = defineEmits<{
    select: [id: string];
    create: [name: string, parentId: string | null];
    cancelCreate: [];
  }>();

  const expanded = defineModel<string[]>("expanded", { default: () => [] });

  const { t } = useI18n();

  const allIds = computed(() => [...props.index.byId.keys()]);
  const expandedKeys = computed({
    get: () => (props.expandAll ? allIds.value : expanded.value),
    set: v => (expanded.value = v),
  });

  const selectedNode = computed(() => (props.selectedId ? props.index.byId.get(props.selectedId) : undefined));

  function onToggle(event: { detail: { originalEvent: Event }; preventDefault: () => void }, isExpanded: boolean) {
    // A click selects and opens a place but never closes it; the chevron closes.
    if (event.detail.originalEvent.type === "click" && isExpanded) event.preventDefault();
  }

  function dropRule(placeId: string) {
    return {
      data: { kind: "place" as const, id: placeId },
      canDrop: (source: DragData) => source.kind === "items" || canNest(props.index, source.id, placeId),
    };
  }

  // ----- Inline "new place" row -----

  const newName = ref("");
  const vAutofocus = { mounted: (el: HTMLElement) => el.focus() };

  watch(
    () => props.addingIn,
    adding => {
      newName.value = "";
      if (adding && !expanded.value.includes(adding)) expanded.value = [...expanded.value, adding];
    }
  );

  /** The flattened index after which the new row goes: after the parent's last visible descendant. */
  function insertAfter(flat: FlattenedItem<TreeItem>[]): number {
    if (props.addingIn === undefined) return -2;
    const at = props.addingIn ? flat.findIndex(f => f.value.id === props.addingIn) : -1;
    if (at < 0) return flat.length - 1;
    let end = at;
    while (end + 1 < flat.length && flat[end + 1]!.level > flat[at]!.level) end++;
    return end;
  }

  function newRowLevel(flat: FlattenedItem<TreeItem>[]): number {
    const parent = props.addingIn ? flat.find(f => f.value.id === props.addingIn) : undefined;
    return parent ? parent.level + 1 : 1;
  }

  function submit() {
    const name = newName.value.trim();
    if (name) emit("create", name, props.addingIn ?? null);
    else emit("cancelCreate");
  }

  const indent = (level: number) => ({ paddingLeft: `${(level - 1) * 18 + 16}px` });
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    v-model:expanded="expandedKeys"
    :items="tree"
    :get-key="node => node.id"
    :get-children="node => (node.children?.length ? node.children : undefined)"
    :model-value="selectedNode"
    as="div"
    class="flex flex-col text-sm select-none"
    @update:model-value="node => node && !Array.isArray(node) && emit('select', node.id)"
  >
    <template v-for="(item, i) in flattenItems" :key="item._id">
      <TreeRow
        v-slot="{ isExpanded, handleToggle }"
        v-drag-source="() => ({ kind: 'place', id: item.value.id })"
        v-drop-target="dropRule(item.value.id)"
        v-bind="item.bind"
        as="div"
        class="group grid h-[38px] cursor-pointer grid-cols-[minmax(0,1fr)_64px_84px] items-center border-b border-border/50 pr-4 outline-none hover:bg-muted/40 focus-visible:bg-muted/60 data-selected:bg-primary/10 data-selected:font-medium"
        :class="{ 'bg-primary/10 ring-2 ring-primary/60 ring-inset': dropActiveId === item.value.id }"
        @toggle="e => onToggle(e, expandedKeys.includes(item.value.id))"
      >
        <span class="flex min-w-0 items-center gap-1.5" :style="indent(item.level)">
          <button
            v-if="item.hasChildren"
            type="button"
            tabindex="-1"
            class="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:text-foreground"
            :aria-label="isExpanded ? t('shell.places_page.collapse') : t('shell.places_page.expand')"
            @click.stop="handleToggle()"
          >
            <ChevronRight class="size-3.5 transition-transform" :class="{ 'rotate-90 text-primary': isExpanded }" />
          </button>
          <span v-else class="w-4 shrink-0" />
          <MapPin
            class="size-3.5 shrink-0"
            :class="item.value.id === selectedId ? 'text-primary' : 'text-muted-foreground'"
            aria-hidden="true"
          />
          <span class="truncate" :class="{ 'text-muted-foreground': !counts.get(item.value.id) }">
            {{ item.value.name }}
          </span>
        </span>
        <span class="text-right text-[13px] text-muted-foreground tabular-nums">
          {{ counts.get(item.value.id) || "—" }}
        </span>
        <span class="truncate text-right text-[13px] text-muted-foreground tabular-nums">
          <Currency v-if="values?.get(item.value.id)" :amount="values.get(item.value.id)!" />
        </span>
      </TreeRow>

      <div
        v-if="i === insertAfter(flattenItems)"
        class="flex h-[38px] items-center gap-1.5 border-b border-border/50 bg-primary/5 pr-4"
        :style="indent(newRowLevel(flattenItems))"
      >
        <span class="w-4 shrink-0" />
        <MapPin class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <input
          v-model="newName"
          v-autofocus
          class="h-[26px] min-w-0 flex-1 rounded-[7px] border-[1.5px] border-primary bg-background px-2 text-sm ring-3 ring-primary/12 outline-none"
          :placeholder="t('shell.places_page.new_place_placeholder')"
          :aria-label="t('shell.places_page.new_place_placeholder')"
          @keydown.enter.stop.prevent="submit"
          @keydown.esc.stop.prevent="emit('cancelCreate')"
          @keydown.stop
          @blur="!newName.trim() && emit('cancelCreate')"
        />
        <span class="hidden text-[11px] whitespace-nowrap text-muted-foreground xl:inline">
          {{ t("shell.places_page.add_hint") }}
        </span>
      </div>
    </template>
    <div
      v-if="addingIn === null && flattenItems.length === 0"
      class="flex h-8 items-center gap-1.5 pr-2"
      :style="indent(1)"
    >
      <MapPin class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <input
        v-model="newName"
        v-autofocus
        class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none"
        :placeholder="t('shell.places_page.new_place_placeholder')"
        @keydown.enter.stop.prevent="submit"
        @keydown.esc.stop.prevent="emit('cancelCreate')"
        @keydown.stop
      />
    </div>
  </TreeRoot>
</template>
