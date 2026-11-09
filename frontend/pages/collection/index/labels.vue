<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ChevronRight, Download } from "@lucide/vue";
  import { Button } from "@/components/ui/button";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsRow from "~/components/Settings/Row.vue";

  /** Labels & reports: label templates, batch printing, asset ID sheets and the bill of materials. */
  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  const api = useUserApi();
  const prefs = useViewPreferences();

  const getBillOfMaterials = () => {
    window.open(api.reports.billOfMaterialsURL(prefs.value.collectionId ?? undefined), "_blank");
  };
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.labels')" :description="t('collection.settings.labels_sub')">
    <SettingsGroup :title="t('tools.labels')">
      <SettingsRow :title="t('tools.labels_set.templates')" :description="t('tools.labels_set.templates_sub')">
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/label-templates">{{ t("tools.labels_set.templates_button") }} <ChevronRight /></NuxtLink>
        </Button>
      </SettingsRow>
      <SettingsRow :title="t('tools.labels_set.batch')" :description="t('tools.labels_set.batch_sub')">
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/label-templates/batch">{{ t("tools.labels_set.batch_button") }} <ChevronRight /></NuxtLink>
        </Button>
      </SettingsRow>
      <SettingsRow :title="t('tools.reports_set.asset_labels')" :description="t('tools.reports_set.asset_labels_sub')">
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/reports/label-generator">
            {{ t("tools.reports_set.asset_labels_button") }} <ChevronRight />
          </NuxtLink>
        </Button>
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('tools.reports')">
      <SettingsRow
        :title="t('tools.reports_set.bill_of_materials')"
        :description="t('tools.reports_set.bill_of_materials_sub')"
      >
        <Button variant="outline" size="sm" @click="getBillOfMaterials">
          <Download /> {{ t("tools.reports_set.bill_of_materials_button") }}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
