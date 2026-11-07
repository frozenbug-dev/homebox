<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Copy, ExternalLink, FolderInput, Link, Minus, Plus, Printer, Tags, Trash2 } from "@lucide/vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import ResourceRow from "./Row.vue";
  import { resourceChangedKey, useResourceListContext } from "./context";
  import PlaceCell from "~/components/Items/PlaceCell.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import Currency from "~/components/global/Currency.vue";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  export type ItemColumn = "asset" | "place" | "tags" | "quantity" | "price" | "added";

  /**
   * An item as a list row: asset ID and name on the left; tags, place,
   * quantity, price and date on the right (each a fixed width so they line
   * up between rows). Place and quantity can be changed in the row.
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
  const asItems = (targets: unknown[]) => targets as EntitySummary[];

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
      <NuxtLink :to="`/item/${item.id}`" class="truncate font-medium" tabindex="-1">{{ item.name }}</NuxtLink>
      <span v-if="item.archived" class="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
        {{ t("items.archived") }}
      </span>
    </template>

    <template #right>
      <span v-if="show('tags') && item.tags.length" class="hidden max-w-56 gap-1 overflow-hidden lg:flex">
        <span
          v-for="tag in item.tags.slice(0, 3)"
          :key="tag.id"
          class="truncate rounded-full border border-border px-2 py-px text-xs text-foreground/80"
        >
          {{ tag.name }}
        </span>
        <span v-if="item.tags.length > 3" class="text-xs">+{{ item.tags.length - 3 }}</span>
      </span>
      <span v-if="show('place')" class="flex w-28 min-w-0 sm:w-40">
        <PlaceCell :item="item" :place-ids="placeIds" @move="p => actions.moveTo(item, p)" />
      </span>
      <span v-if="show('quantity')" class="flex w-20 items-center justify-end gap-0.5 tabular-nums">
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded opacity-0 group-hover/row:opacity-100 hover:bg-accent focus-visible:opacity-100"
          :aria-label="t('shell.items_page.decrease')"
          @click="actions.setQuantity(item, item.quantity - 1)"
        >
          <Minus class="size-3" />
        </button>
        <span class="min-w-5 text-center text-foreground/80">{{ item.quantity }}</span>
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded opacity-0 group-hover/row:opacity-100 hover:bg-accent focus-visible:opacity-100"
          :aria-label="t('shell.items_page.increase')"
          @click="actions.setQuantity(item, item.quantity + 1)"
        >
          <Plus class="size-3" />
        </button>
      </span>
      <span v-if="show('price')" class="w-20 truncate text-right tabular-nums">
        <Currency v-if="item.purchasePrice" :amount="item.purchasePrice" />
      </span>
      <span
        v-if="show('added')"
        class="w-20 text-right text-xs whitespace-nowrap"
        :title="new Date(item.createdAt).toLocaleString(locale)"
      >
        {{ added }}
      </span>
    </template>

    <template #menu="{ targets }">
      <template v-if="asItems(targets).length === 1">
        <ContextMenuItem class="gap-2" @select="navigateTo(`/item/${asItems(targets)[0]!.id}`)">
          <ExternalLink class="size-4" /> {{ t("shell.resource.open") }}
        </ContextMenuItem>
        <ContextMenuSeparator />
      </template>
      <ContextMenuItem class="gap-2" @select="actions.move(asItems(targets))">
        <FolderInput class="size-4" /> {{ t("shell.resource.move_to") }}
        <ShortcutHint :hotkey="SHORTCUTS.selectionMove" class="ml-auto" />
      </ContextMenuItem>
      <ContextMenuItem class="gap-2" @select="actions.tag(asItems(targets))">
        <Tags class="size-4" /> {{ t("shell.resource.add_tags") }}
        <ShortcutHint :hotkey="SHORTCUTS.selectionTag" class="ml-auto" />
      </ContextMenuItem>
      <ContextMenuItem class="gap-2" @select="actions.print(asItems(targets))">
        <Printer class="size-4" /> {{ t("shell.resource.print_labels", { n: targets.length }) }}
        <ShortcutHint :hotkey="SHORTCUTS.selectionPrint" class="ml-auto" />
      </ContextMenuItem>
      <template v-if="asItems(targets).length === 1">
        <ContextMenuItem class="gap-2" @select="actions.duplicate(asItems(targets)[0]!)">
          <Copy class="size-4" /> {{ t("shell.item_page.duplicate") }}
        </ContextMenuItem>
        <ContextMenuItem class="gap-2" @select="actions.copyLink(asItems(targets)[0]!)">
          <Link class="size-4" /> {{ t("shell.resource.copy_link") }}
        </ContextMenuItem>
      </template>
      <ContextMenuSeparator />
      <ContextMenuItem class="gap-2 text-destructive focus:text-destructive" @select="actions.remove(asItems(targets))">
        <Trash2 class="size-4" /> {{ t("shell.resource.delete", { n: targets.length }) }}
      </ContextMenuItem>
    </template>
  </ResourceRow>
</template>
