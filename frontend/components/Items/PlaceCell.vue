<script setup lang="ts">
  import { MapPin } from "@lucide/vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";

  /**
   * The Place cell: click to move the item to another place. Only offered when
   * the item sits directly in a place; an item inside another item keeps its
   * container, so moving it goes through the full edit form.
   */
  const props = defineProps<{ item: EntitySummary; placeIds: Set<string> }>();
  const emit = defineEmits<{ move: [place: FlatTreeItem] }>();

  const open = defineModel<boolean>("open", { default: false });
  const editable = computed(() => !props.item.parent || props.placeIds.has(props.item.parent.id));
</script>

<template>
  <PlacePicker v-if="editable" v-model:open="open" :current-id="item.parent?.id" @pick="p => emit('move', p)">
    <button
      type="button"
      class="inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground/80 hover:bg-accent hover:text-foreground"
      @click.stop
    >
      <MapPin class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="truncate">{{ item.parent?.name ?? "—" }}</span>
    </button>
  </PlacePicker>
  <NuxtLink
    v-else-if="item.parent"
    :to="`/item/${item.parent.id}`"
    class="inline-flex max-w-full items-center gap-1.5 px-1.5 text-sm text-muted-foreground hover:underline"
    @click.stop
  >
    <span class="truncate">{{ item.parent.name }}</span>
  </NuxtLink>
</template>
