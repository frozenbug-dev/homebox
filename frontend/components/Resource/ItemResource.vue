<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import {
    Banknote,
    ChevronLeft,
    Copy,
    ExternalLink,
    FolderInput,
    Hash,
    Link,
    MapPin,
    Plus,
    Printer,
    Tags,
    Trash2,
    X,
  } from "@lucide/vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import ResourceRow from "./Row.vue";
  import { resourceChangedKey, useResourceListContext } from "./context";
  import PlaceCell from "~/components/Items/PlaceCell.vue";
  import NumberPill from "~/components/Items/NumberPill.vue";
  import TagPicker from "~/components/Item/Inline/TagPicker.vue";
  import { Pill } from "@/components/ui/pill";
  import { getIconComponent } from "~/lib/icons";
  import Currency from "~/components/global/Currency.vue";
  import ActionMenuBody from "~/components/App/ActionMenu/ActionMenuBody.vue";
  import type { ActionMenuEntry } from "~/components/App/ActionMenu/types";
  import { useTagStore } from "~/stores/tags";

  export type ItemColumn = "asset" | "place" | "tags" | "quantity" | "price" | "added";

  /**
   * An item as a list row: asset ID and name (and, for an item inside another
   * item, that parent) on the left; tags, place, quantity, price and date as
   * right-aligned pills on the right (each a fixed width so they line up
   * between rows). Tags, place, quantity and price can be changed in the row.
   */
  const props = defineProps<{
    item: EntitySummary;
    columns: Record<ItemColumn, boolean>;
    /** Ids of all places, to tell an item in a place from one inside another item. */
    placeIds: Set<string>;
    draggable?: boolean;
  }>();

  const { t, locale } = useI18n();
  const list = useResourceListContext();
  const actions = useItemActions({ clear: list.clear, changed: inject(resourceChangedKey, undefined) });

  const show = (c: ItemColumn) => props.columns[c];
  const dragData = () => {
    const targets = list.targetsFor(props.item.id) as EntitySummary[];
    return { kind: "items" as const, ids: targets.map(i => i.id) };
  };
  const places = useFlatLocations();
  const tagStore = useTagStore();

  /** Inside another item rather than a place: show that item next to the name. */
  const container = computed(() =>
    props.item.parent && !props.placeIds.has(props.item.parent.id) ? props.item.parent : undefined
  );

  const VISIBLE_TAGS = 3;
  const tagsOpen = ref(false);
  const tagIds = computed({
    get: () => props.item.tags.map(x => x.id),
    set: ids => {
      const known = new Map([...tagStore.tags, ...props.item.tags].map(x => [x.id, x]));
      actions.setTags(
        props.item,
        ids.map(id => known.get(id)).filter(x => !!x)
      );
    },
  });

  /** The right-click menu. Read live (not from the menu's snapshot) so tag checks update as you toggle. */
  const menu = computed<ActionMenuEntry[]>(() => {
    const items = list.targetsFor(props.item.id) as EntitySummary[];
    const one = items.length === 1 ? items[0]! : undefined;
    const has = (tagId: string) => items.length > 0 && items.every(i => i.tags.some(x => x.id === tagId));
    return [
      ...(one
        ? ([
            {
              id: "open",
              label: t("shell.resource.open"),
              icon: ExternalLink,
              onSelect: () => navigateTo(`/item/${one.id}`),
            },
            { kind: "separator" },
          ] satisfies ActionMenuEntry[])
        : []),
      {
        kind: "sub",
        id: "move",
        label: t("shell.resource.move_to"),
        icon: FolderInput,
        entries: places.value.map(p => ({
          id: p.id,
          label: p.name,
          icon: MapPin,
          hint: p.treeString !== p.name ? p.treeString : undefined,
          onSelect: () => actions.moveAllTo(items, p),
        })),
      },
      {
        kind: "sub",
        id: "tags",
        label: t("global.tags"),
        icon: Tags,
        entries: tagStore.tags.map(tag => ({
          id: tag.id,
          label: tag.name,
          color: tag.color,
          checked: has(tag.id),
          keepOpen: true,
          onSelect: () => actions.toggleTag(items, tag),
        })),
      },
      ...(one
        ? ([
            {
              id: "quantity",
              label: t("shell.resource.change_quantity"),
              icon: Hash,
              onSelect: () => actions.editNumber(one, "quantity"),
            },
            {
              id: "price",
              label: t("shell.resource.change_price"),
              icon: Banknote,
              onSelect: () => actions.editNumber(one, "purchasePrice"),
            },
          ] satisfies ActionMenuEntry[])
        : []),
      {
        id: "print",
        label: t("shell.resource.print_labels", { n: items.length }),
        icon: Printer,
        hotkey: SHORTCUTS.selectionPrint,
        onSelect: () => actions.print(items),
      },
      ...(one
        ? ([
            {
              id: "duplicate",
              label: t("shell.item_page.duplicate"),
              icon: Copy,
              onSelect: () => actions.duplicate(one),
            },
            {
              id: "copy-link",
              label: t("shell.resource.copy_link"),
              icon: Link,
              onSelect: () => actions.copyLink(one),
            },
          ] satisfies ActionMenuEntry[])
        : []),
      { kind: "separator" },
      {
        id: "delete",
        label: t("shell.resource.delete", { n: items.length }),
        icon: Trash2,
        destructive: true,
        onSelect: () => actions.remove(items),
      },
    ];
  });

  /** "Nov 7", or "Nov 7, 2024" for another year. */
  const added = computed(() => {
    const d = new Date(props.item.createdAt);
    if (Number.isNaN(d.getTime())) return "";
    const thisYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(locale.value, {
      month: "short",
      day: "numeric",
      year: thisYear ? undefined : "numeric",
    });
  });
</script>

<template>
  <ResourceRow :id="item.id" :drag-data="draggable ? dragData : undefined">
    <template #left>
      <span v-if="show('asset') && item.assetId" class="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        {{ item.assetId }}
      </span>
      <span class="min-w-0 truncate font-medium">{{ item.name }}</span>
      <template v-if="container">
        <ChevronLeft class="-mx-1.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <NuxtLink
          :to="`/item/${container.id}`"
          class="min-w-0 shrink-3 truncate font-normal text-muted-foreground/80 hover:text-foreground hover:underline"
          @click.stop
        >
          {{ container.name }}
        </NuxtLink>
      </template>
      <span v-if="item.archived" class="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
        {{ t("items.archived") }}
      </span>
    </template>

    <template #right>
      <span class="flex min-w-0 items-center justify-end gap-1">
        <TagPicker v-if="show('tags')" v-model="tagIds" v-model:open="tagsOpen" align="end">
          <button
            type="button"
            class="hidden max-w-72 min-w-0 cursor-pointer items-center justify-end gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :class="item.tags.length || tagsOpen ? 'lg:flex' : 'lg:group-hover/row:flex lg:focus-visible:flex'"
            :aria-label="t('global.tags')"
            @click.stop
          >
            <template v-if="item.tags.length">
              <Pill
                v-for="tag in item.tags.slice(0, VISIBLE_TAGS)"
                :key="tag.id"
                :color="tag.color || undefined"
                :icon="getIconComponent(tag.icon)"
                class="min-w-0 shrink hover:brightness-95 dark:hover:brightness-125"
              >
                {{ tag.name }}
              </Pill>
              <Pill v-if="item.tags.length > VISIBLE_TAGS">+{{ item.tags.length - VISIBLE_TAGS }}</Pill>
            </template>
            <Pill v-else dashed :icon="Plus">{{ t("global.tags") }}</Pill>
          </button>
        </TagPicker>
        <PlaceCell v-if="show('place')" :item="item" :place-ids="placeIds" @move="p => actions.moveTo(item, p)" />
        <NumberPill
          v-if="show('quantity')"
          :value="item.quantity"
          :icon="X"
          :label="t('global.quantity')"
          @commit="n => actions.setQuantity(item, Math.round(n))"
        >
          {{ item.quantity }}
        </NumberPill>
        <NumberPill
          v-if="show('price') && item.purchasePrice"
          :value="item.purchasePrice"
          :label="t('items.purchase_price')"
          @commit="n => actions.setPrice(item, n)"
        >
          <Currency :amount="item.purchasePrice" />
        </NumberPill>
      </span>
      <span
        v-if="show('added')"
        class="w-16 text-right text-xs whitespace-nowrap"
        :title="new Date(item.createdAt).toLocaleString(locale)"
      >
        {{ added }}
      </span>
    </template>

    <template #menu>
      <ActionMenuBody :entries="menu" />
    </template>
  </ResourceRow>
</template>
