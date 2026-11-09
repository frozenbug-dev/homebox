<script setup lang="ts">
  import { MapPin } from "@lucide/vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";
  import { Pill } from "@/components/ui/pill";

  /** Places have no color of their own, so they all share one tint. */
  const PLACE_COLOR = "#0284c7";

  /**
   * The Place cell, as a pill: click to move the item to another place. Only
   * offered when the item sits directly in a place (or nowhere); an item
   * inside another item shows that parent next to its name instead.
   */
  const props = defineProps<{ item: EntitySummary; placeIds: Set<string> }>();
  const emit = defineEmits<{ move: [place: FlatTreeItem] }>();

  const open = defineModel<boolean>("open", { default: false });
  const editable = computed(() => !props.item.parent || props.placeIds.has(props.item.parent.id));
</script>

<template>
  <PlacePicker
    v-if="editable"
    v-model:open="open"
    align="end"
    :current-id="item.parent?.id"
    @pick="p => emit('move', p)"
  >
    <Pill v-if="item.parent" as="button" :color="PLACE_COLOR" :icon="MapPin" :title="item.parent.name" @click.stop>
      {{ item.parent.name }}
    </Pill>
    <Pill
      v-else
      as="button"
      dashed
      :icon="MapPin"
      :aria-label="$t('global.location')"
      :class="[
        'hidden group-hover/row:inline-flex focus-visible:inline-flex pointer-coarse:inline-flex',
        open && 'inline-flex',
      ]"
      @click.stop
    />
  </PlacePicker>
</template>
