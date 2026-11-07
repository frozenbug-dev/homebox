<script setup lang="ts">
  import type { EntityOut } from "~~/lib/api/types/data-contracts";
  import MaintenanceListView from "~/components/Maintenance/ListView.vue";

  const props = defineProps<{
    item: EntityOut;
  }>();
</script>

<template>
  <MaintenanceListView :current-item-id="props.item.id" class="-mx-3 -my-4 sm:-mx-6" />
</template>
