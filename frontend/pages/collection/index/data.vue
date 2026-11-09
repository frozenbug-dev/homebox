<script setup lang="ts">
  import DOMPurify from "dompurify";
  import { useI18n } from "vue-i18n";
  import { Download, Upload } from "@lucide/vue";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import AppImportDialog from "@/components/App/ImportDialog.vue";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsRow from "~/components/Settings/Row.vue";

  /** Import & export: items in and out as Homebox CSV. */
  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  const api = useUserApi();
  const prefs = useViewPreferences();
  const { openDialog } = useDialog();

  const getExportCSV = () => {
    window.open(api.items.exportURL(prefs.value.collectionId ?? undefined), "_blank");
  };
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.data')" :description="t('collection.settings.data_sub')">
    <AppImportDialog />
    <SettingsGroup>
      <SettingsRow :title="t('tools.import_export_set.import')">
        <template #description>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="DOMPurify.sanitize(t('tools.import_export_set.import_sub'))" />
        </template>
        <Button variant="outline" size="sm" @click="openDialog(DialogID.Import)">
          <Upload /> {{ t("tools.import_export_set.import_button") }}
        </Button>
      </SettingsRow>
      <SettingsRow :title="t('tools.import_export_set.export')" :description="t('tools.import_export_set.export_sub')">
        <Button variant="outline" size="sm" @click="getExportCSV">
          <Download /> {{ t("tools.import_export_set.export_button") }}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
