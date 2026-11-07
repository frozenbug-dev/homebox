<template>
  <Card class="transition-colors hover:border-ring/50">
    <NuxtLink
      :to="`/location/${location.id}`"
      class="flex items-center gap-3 rounded-lg"
      :class="{
        'p-4': !dense,
        'px-3 py-2': dense,
      }"
    >
      <MdiMapMarkerOutline class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="truncate font-medium">{{ location.name }}</span>
      <span class="ml-auto text-sm text-muted-foreground tabular-nums" :class="{ 'opacity-0': !hasCount }">
        {{ count }}
      </span>
    </NuxtLink>
  </Card>
</template>

<script lang="ts" setup>
  import type { EntityOut, EntitySummary } from "~~/lib/api/types/data-contracts";
  import MdiMapMarkerOutline from "~icons/mdi/map-marker-outline";
  import { Card } from "@/components/ui/card";

  const props = defineProps({
    location: {
      type: Object as () => EntitySummary | EntityOut,
      required: true,
    },
    dense: {
      type: Boolean,
      default: false,
    },
  });

  const hasCount = computed(() => {
    return !!(props.location as EntitySummary).itemCount;
  });

  const count = computed(() => {
    return hasCount.value ? (props.location as EntitySummary).itemCount : undefined;
  });
</script>
