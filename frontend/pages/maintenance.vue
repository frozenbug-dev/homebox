<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import MaintenanceListView from "~/components/Maintenance/ListView.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("menu.maintenance")}` });
  usePageHeader(() => [{ label: t("menu.maintenance") }]);
</script>

<template>
  <MaintenanceListView class="flex-1" />
</template>
