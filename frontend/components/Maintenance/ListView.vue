<script setup lang="ts">
  import AppSubheader from "~/components/App/Subheader.vue";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import { useI18n } from "vue-i18n";
  import { Plus } from "@lucide/vue";
  import { MaintenanceFilterStatus } from "~~/lib/api/types/data-contracts";
  import MaintenanceEditModal from "~~/components/Maintenance/EditModal.vue";
  import ResourceList from "~/components/Resource/List.vue";
  import MaintenanceResource, { type MaintenanceRow } from "~/components/Resource/MaintenanceResource.vue";
  import SelectionBar from "~/components/Resource/SelectionBar.vue";
  import SelectionAction from "~/components/Resource/SelectionAction.vue";
  import Currency from "~/components/global/Currency.vue";
  import { Button } from "@/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toDateOnlyString } from "~/lib/datelib/dateOnly";

  /** Maintenance entries, for one item (`currentItemId`) or for everything. Click a row to edit it. */
  const props = defineProps<{ currentItemId?: string }>();

  const api = useUserApi();
  const { t } = useI18n();
  const confirm = useConfirm();
  const { openDialog } = useDialog();

  const status = ref(MaintenanceFilterStatus.MaintenanceFilterStatusScheduled);
  const statuses = computed(() => [
    { id: MaintenanceFilterStatus.MaintenanceFilterStatusScheduled, label: t("maintenance.filter.scheduled") },
    { id: MaintenanceFilterStatus.MaintenanceFilterStatusCompleted, label: t("maintenance.filter.completed") },
    { id: MaintenanceFilterStatus.MaintenanceFilterStatusBoth, label: t("maintenance.filter.both") },
  ]);

  const { data: entries, refresh } = useAsyncData(
    async (): Promise<MaintenanceRow[]> => {
      const { data } = props.currentItemId
        ? await api.items.maintenance.getLog(props.currentItemId, { status: status.value })
        : await api.maintenance.getAll({ status: status.value });
      return data ?? [];
    },
    { watch: [status] }
  );

  const totalCost = computed(() => (entries.value ?? []).reduce((sum, e) => sum + (Number.parseFloat(e.cost) || 0), 0));

  // ----- Actions -----

  // Always refresh: with "Create more" on, entries are added before the dialog closes without a result.
  const afterDialog = () => refresh();

  function create() {
    openDialog(DialogID.EditMaintenance, {
      params: { type: "create", itemId: props.currentItemId },
      onClose: afterDialog,
    });
  }
  function edit(entry: MaintenanceRow) {
    openDialog(DialogID.EditMaintenance, { params: { type: "update", maintenanceEntry: entry }, onClose: afterDialog });
  }
  function duplicate(entry: MaintenanceRow) {
    const itemId = entry.itemID ?? props.currentItemId;
    if (!itemId) return;
    openDialog(DialogID.EditMaintenance, {
      params: { type: "duplicate", maintenanceEntry: entry, itemId },
      onClose: afterDialog,
    });
  }

  async function complete(list: MaintenanceRow[]) {
    const results = await Promise.all(
      list.map(e =>
        api.maintenance.update(e.id, {
          name: e.name,
          // Local YYYY-MM-DD: a Date would serialise to UTC and shift the day east of UTC.
          completedDate: toDateOnlyString(new Date()),
          scheduledDate: (e.scheduledDate as string) ?? "",
          description: e.description,
          cost: e.cost,
        })
      )
    );
    if (results.some(r => r.error)) toast.error(t("maintenance.toast.failed_to_update"));
    refresh();
  }

  async function remove(list: MaintenanceRow[]) {
    if (!list.length) return;
    const { isCanceled } = await confirm.open(t("shell.maintenance_page.delete_confirm", { n: list.length }));
    if (isCanceled) return;
    const results = await Promise.all(list.map(e => api.maintenance.delete(e.id)));
    if (results.some(r => r.error)) toast.error(t("maintenance.toast.failed_to_delete"));
    refresh();
  }
</script>

<template>
  <section class="flex flex-col">
    <MaintenanceEditModal />

    <!-- Global list: the header CTA creates an entry instead of an item -->
    <AppHeaderActions v-if="!currentItemId">
      <Button size="sm" class="h-[30px] text-[13px]" @click="create">
        <Plus />
        {{ t("shell.maintenance_page.new_entry") }}
      </Button>
    </AppHeaderActions>

    <AppSubheader>
      <div class="flex rounded-lg bg-muted p-0.5 text-xs" role="tablist">
        <button
          v-for="s in statuses"
          :key="s.id"
          type="button"
          role="tab"
          :aria-selected="status === s.id"
          class="h-6 rounded-md px-2.5 font-medium text-muted-foreground"
          :class="{ 'bg-background text-foreground shadow-xs': status === s.id }"
          @click="status = s.id"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="grow" />
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ t("shell.maintenance_page.count", { n: entries?.length ?? 0 }) }}
        <template v-if="totalCost"> · <Currency :amount="totalCost" /> </template>
      </span>
      <Button v-if="currentItemId" size="sm" class="h-7 gap-1.5 px-2 text-xs" @click="create">
        <Plus class="size-3.5" />
        {{ t("maintenance.list.new") }}
      </Button>
    </AppSubheader>

    <ResourceList
      class="py-1.5"
      :items="entries ?? []"
      :get-key="e => e.id"
      :label="t('menu.maintenance')"
      @open="edit"
    >
      <template #default="{ item }">
        <MaintenanceResource
          :entry="item"
          :show-item="!currentItemId"
          @edit="edit"
          @duplicate="duplicate"
          @complete="complete"
          @delete="remove"
        />
      </template>
      <template #selection="{ items, clear }">
        <SelectionBar :count="items.length" @clear="clear">
          <SelectionAction @click="complete(items.filter(e => !validDate(e.completedDate))).then(clear)">
            {{ t("maintenance.list.complete") }}
          </SelectionAction>
          <SelectionAction destructive @click="remove(items).then(clear)">
            {{ t("maintenance.list.delete") }}
          </SelectionAction>
        </SelectionBar>
      </template>
    </ResourceList>

    <div
      v-if="entries && !entries.length"
      class="flex flex-col items-center gap-3 px-4 py-10 text-sm text-muted-foreground"
    >
      <p>{{ t("shell.maintenance_page.empty") }}</p>
      <Button variant="outline" size="sm" @click="create">
        {{ t("maintenance.list.create_first") }}
      </Button>
    </div>
  </section>
</template>
