<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Archive, Download, Plus, Trash2, Upload } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
  import { ServerEvent, onServerEvent } from "@/composables/use-server-events";
  import type { CollectionExport } from "@/lib/api/classes/backups";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsRow from "~/components/Settings/Row.vue";
  import SettingsListRow from "~/components/Settings/ListRow.vue";

  /** Backups: build a zip of the whole collection, download it, or restore one into an empty collection. */
  definePageMeta({ middleware: ["auth"] });

  const { t, locale } = useI18n();
  const api = useUserApi();
  const confirm = useConfirm();

  const backups = ref<CollectionExport[]>([]);
  const restoreInput = ref<HTMLInputElement | null>(null);

  async function refreshBackups() {
    const { data, error } = await api.backups.list();
    if (error || !data) return;
    backups.value = data.items ?? [];
  }

  // Initial fetch + live refresh on export/import lifecycle events.
  refreshBackups();
  onServerEvent(ServerEvent.ExportMutation, refreshBackups);
  onServerEvent(ServerEvent.ImportMutation, refreshBackups);

  const downloadUrl = (id: string) => api.backups.downloadURL(id);

  function formatBytes(n: number): string {
    if (!n) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  const formatCreated = (iso: string | Date) =>
    new Date(iso).toLocaleString(locale.value, { dateStyle: "medium", timeStyle: "short" });

  const statusLabel = (status: string) => {
    const key = `collection.settings.backup_status.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  function subtitle(b: CollectionExport) {
    if (b.status === "completed") return formatBytes(b.sizeBytes);
    if (b.status === "running") return `${b.progress}%`;
    if (b.status === "failed") return t("tools.backups_set.failed");
    return "";
  }

  async function startBackup() {
    const { error } = await api.backups.startExport();
    if (error) {
      toast.error(t("tools.toast.backup_start_failed"));
      return;
    }
    toast.success(t("tools.toast.backup_started"));
    await refreshBackups();
  }

  async function deleteBackup(id: string) {
    if ((await confirm.open(t("tools.backups_set.delete_confirm"))).isCanceled) return;
    const { error } = await api.backups.delete(id);
    if (error) {
      toast.error(t("tools.toast.backup_delete_failed"));
      return;
    }
    await refreshBackups();
  }

  async function onRestoreFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so the user can re-pick the same file later if needed.
    input.value = "";
    if (!file) return;
    const { error, status } = await api.backups.importZip(file);
    if (error) {
      // 409 = empty-group precondition failed.
      toast.error(status === 409 ? t("tools.toast.restore_requires_empty") : t("tools.toast.restore_failed"));
      return;
    }
    toast.success(t("tools.toast.restore_started"));
  }
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.backups')" :description="t('tools.backups_sub')">
    <template #actions>
      <Button size="sm" @click="startBackup"><Plus /> {{ t("tools.backups_set.create_button") }}</Button>
    </template>

    <SettingsGroup :title="t('collection.settings.recent_backups')">
      <p v-if="!backups.length" class="px-4 py-5 text-sm text-muted-foreground">
        {{ t("tools.backups_set.list_empty") }}
      </p>
      <SettingsListRow v-for="b in backups" :key="b.id" :title="formatCreated(b.createdAt)">
        <template #icon><Archive /></template>
        <template #subtitle>
          <span :class="{ 'font-mono': b.status === 'completed' }" :title="b.error || undefined">{{
            subtitle(b)
          }}</span>
        </template>
        <span
          class="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-medium"
          :class="{
            'bg-accent text-accent-foreground': b.status === 'completed',
            'bg-destructive/15 text-destructive-foreground': b.status === 'failed',
            'bg-muted text-muted-foreground': b.status !== 'completed' && b.status !== 'failed',
          }"
        >
          <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {{ statusLabel(b.status) }}
        </span>
        <Button v-if="b.status === 'completed'" variant="outline" size="sm" class="max-sm:hidden" as-child>
          <a :href="downloadUrl(b.id)" :download="`homebox-export-${b.id}.zip`">
            <Download /> {{ t("tools.backups_set.download") }}
          </a>
        </Button>
        <template #menu>
          <template v-if="b.status === 'completed'">
            <DropdownMenuItem as-child>
              <a :href="downloadUrl(b.id)" :download="`homebox-export-${b.id}.zip`">
                <Download /> {{ t("tools.backups_set.download") }}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </template>
          <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deleteBackup(b.id)">
            <Trash2 /> {{ t("global.delete") }}
          </DropdownMenuItem>
        </template>
      </SettingsListRow>
    </SettingsGroup>

    <SettingsGroup :title="t('collection.settings.restore')">
      <SettingsRow :title="t('tools.backups_set.restore')" :description="t('tools.backups_set.restore_sub')">
        <input ref="restoreInput" type="file" accept=".zip" class="hidden" @change="onRestoreFile" />
        <Button variant="outline" size="sm" @click="restoreInput?.click()">
          <Upload /> {{ t("tools.backups_set.restore_button") }}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
