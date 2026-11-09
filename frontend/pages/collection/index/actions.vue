<script setup lang="ts">
  import DOMPurify from "dompurify";
  import { useI18n } from "vue-i18n";
  import { Trash2 } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsRow from "~/components/Settings/Row.vue";

  /** Bulk actions: one-off fixes over the whole inventory, and wiping it. */
  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  const api = useUserApi();
  const confirm = useConfirm();
  const pubApi = usePublicApi();
  const { openDialog } = useDialog();
  const { data: status } = useAsyncData(async () => (await pubApi.status()).data);

  type Result = { error?: unknown; data?: { completed: number } | null };

  /** Asks first, runs the action and reports how many items it touched. */
  async function run(confirmKey: string, failedKey: string, action: () => Promise<Result>) {
    if ((await confirm.open(t(confirmKey))).isCanceled) return;
    const result = await action();
    if (result.error || !result.data) {
      toast.error(t(failedKey));
      return;
    }
    toast.success(t("tools.toast.asset_success", { results: result.data.completed }));
  }

  const actions = computed(() => [
    {
      id: "ensure_ids",
      title: t("tools.actions_set.ensure_ids"),
      sub: t("tools.actions_set.ensure_ids_sub"),
      run: () =>
        run("tools.actions_set.ensure_ids_confirm", "tools.toast.failed_ensure_ids", () =>
          api.actions.ensureAssetIDs()
        ),
    },
    {
      id: "ensure_import_refs",
      title: t("tools.actions_set.ensure_import_refs"),
      sub: t("tools.actions_set.ensure_import_refs_sub"),
      run: () =>
        run("tools.import_export_set.import_ref_confirm", "tools.toast.failed_ensure_import_refs", () =>
          api.actions.ensureImportRefs()
        ),
    },
    {
      id: "set_primary_photo",
      title: t("tools.actions_set.set_primary_photo"),
      sub: t("tools.actions_set.set_primary_photo_sub"),
      run: () =>
        run("tools.actions_set.set_primary_photo_confirm", "tools.toast.failed_set_primary_photos", () =>
          api.actions.setPrimaryPhotos()
        ),
    },
    {
      id: "create_missing_thumbnails",
      title: t("tools.actions_set.create_missing_thumbnails"),
      sub: t("tools.actions_set.create_missing_thumbnails_sub"),
      run: () =>
        run("tools.actions_set.create_missing_thumbnails_confirm", "tools.toast.failed_create_missing_thumbnails", () =>
          api.actions.createMissingThumbnails()
        ),
    },
    {
      id: "zero_datetimes",
      title: t("tools.actions_set.zero_datetimes"),
      sub: t("tools.actions_set.zero_datetimes_sub"),
      run: () =>
        run("tools.actions_set.zero_datetimes_confirm", "tools.toast.failed_zero_datetimes", () =>
          api.actions.resetItemDateTimes()
        ),
    },
  ]);

  async function wipeInventory() {
    if (status.value?.demo) {
      await confirm.open(t("tools.demo_mode_error.wipe_inventory"));
      return;
    }

    openDialog(DialogID.WipeInventory, {
      onClose: async result => {
        if (!result) return;

        const apiResult = await api.actions.wipeInventory({
          wipeTags: result.wipeTags,
          wipeLocations: result.wipeLocations,
          wipeMaintenance: result.wipeMaintenance,
        });

        if (apiResult.error) {
          toast.error(t("tools.toast.failed_wipe_inventory"));
          return;
        }

        toast.success(t("tools.toast.wipe_inventory_success", { results: apiResult.data.completed }));
      },
    });
  }
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.actions')" :description="t('collection.settings.actions_sub')">
    <SettingsGroup :title="t('collection.settings.maintenance')">
      <SettingsRow v-for="a in actions" :key="a.id" :title="a.title">
        <template #description>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="[&_a]:text-primary [&_a]:underline" v-html="DOMPurify.sanitize(a.sub)" />
        </template>
        <Button variant="outline" size="sm" @click="a.run">{{ t("collection.settings.run") }}</Button>
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('collection.settings.danger_zone')" :hint="t('collection.settings.owners_only')">
      <SettingsRow
        :title="t('tools.actions_set.wipe_inventory')"
        :description="t('tools.actions_set.wipe_inventory_sub')"
      >
        <Button variant="destructive" size="sm" @click="wipeInventory">
          <Trash2 /> {{ t("tools.actions_set.wipe_inventory_button") }}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
