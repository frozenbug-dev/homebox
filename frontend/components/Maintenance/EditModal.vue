<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { CalendarClock, CircleCheck, ChevronRight, DollarSign, Package } from "@lucide/vue";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { NumberField } from "@/components/ui/number-field";
  import { Calendar } from "@/components/ui/calendar";
  import CreateDialog from "~/components/Create/Dialog.vue";
  import CreateChip from "~/components/Create/Chip.vue";
  import OptionPicker, { type PickerOption } from "~/components/Create/OptionPicker.vue";
  import Currency from "~/components/global/Currency.vue";

  /** Create, edit or duplicate a maintenance entry, in the same shell as the "New …" dialogs. */
  const { closeDialog, registerOpenDialogCallback } = useDialog();
  const { t } = useI18n();
  const locale = useFormatLocale();
  const api = useUserApi();

  const loading = ref(false);
  const nameInput = ref<HTMLInputElement | null>(null);

  const entry = reactive({
    id: null as string | null,
    name: "",
    completedDate: "",
    scheduledDate: "",
    description: "",
    cost: null as number | null,
    itemIds: null as string[] | null,
  });

  const isEdit = computed(() => !!entry.id);

  // ----- Item (only when opened without one, e.g. from the global Maintenance page) -----

  const pickItem = ref(false);
  const picked = ref<{ id: string; name: string } | null>(null);
  const itemPickerOpen = ref(false);
  const { query, results, isLoading, triggerSearch } = useItemSearch(api);

  watch(itemPickerOpen, open => open && !results.value.length && triggerSearch());

  const itemOptions = computed<PickerOption[]>(() =>
    results.value.map(item => ({ id: item.id, name: item.name, hint: item.parent?.name }))
  );
  const itemId = computed<string | null>({
    get: () => picked.value?.id ?? null,
    set: id => {
      const hit = results.value.find(r => r.id === id);
      picked.value = hit ? { id: hit.id, name: hit.name } : null;
    },
  });

  // ----- Chip labels -----

  const formatDate = (iso: string) =>
    iso
      ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(locale.value, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

  // ----- Open / submit -----

  function reset(keepItem = false) {
    entry.name = "";
    entry.completedDate = "";
    entry.scheduledDate = "";
    entry.description = "";
    entry.cost = null;
    if (!keepItem) {
      picked.value = null;
      query.value = "";
    }
    loading.value = false;
  }

  const costString = () => (entry.cost ? String(entry.cost) : "0");

  async function submit(keepOpen: boolean) {
    if (!entry.name.trim()) {
      nameInput.value?.focus();
      return;
    }

    if (isEdit.value) {
      await editEntry();
      return;
    }

    const itemIds = pickItem.value ? (picked.value ? [picked.value.id] : []) : entry.itemIds;
    if (!itemIds?.length) {
      toast.error(t("maintenance.toast.item_required"));
      itemPickerOpen.value = true;
      return;
    }

    loading.value = true;
    const results = await Promise.all(
      itemIds.map(id =>
        api.items.maintenance.create(id, {
          name: entry.name,
          completedDate: entry.completedDate,
          scheduledDate: entry.scheduledDate,
          description: entry.description,
          cost: costString(),
        })
      )
    );
    loading.value = false;

    if (results.some(r => r.error)) {
      toast.error(t("maintenance.toast.failed_to_create"));
      return;
    }

    if (keepOpen) {
      // "Create more" keeps the item, so a run of entries for one thing is quick.
      reset(true);
      nameInput.value?.focus();
    } else {
      closeDialog(DialogID.EditMaintenance, true);
    }
  }

  async function editEntry() {
    if (!entry.id) return;
    loading.value = true;
    const { error } = await api.maintenance.update(entry.id, {
      name: entry.name,
      completedDate: entry.completedDate,
      scheduledDate: entry.scheduledDate,
      description: entry.description,
      cost: costString(),
    });
    loading.value = false;

    if (error) {
      toast.error(t("maintenance.toast.failed_to_update"));
      return;
    }
    closeDialog(DialogID.EditMaintenance, true);
  }

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.EditMaintenance, params => {
      reset();
      switch (params.type) {
        case "create":
          entry.id = null;
          entry.itemIds =
            params.itemId === undefined ? [] : typeof params.itemId === "string" ? [params.itemId] : params.itemId;
          pickItem.value = entry.itemIds.length === 0;
          break;
        case "update":
          entry.id = params.maintenanceEntry.id;
          entry.name = params.maintenanceEntry.name;
          // Backend already returns YYYY-MM-DD via types.Date — keep as string
          // so JSON.stringify never converts to a UTC instant.
          entry.completedDate = (params.maintenanceEntry.completedDate as string) ?? "";
          entry.scheduledDate = (params.maintenanceEntry.scheduledDate as string) ?? "";
          entry.description = params.maintenanceEntry.description;
          entry.cost = Number.parseFloat(params.maintenanceEntry.cost) || null;
          entry.itemIds = null;
          pickItem.value = false;
          break;
        case "duplicate":
          entry.id = null;
          entry.name = params.maintenanceEntry.name;
          entry.description = params.maintenanceEntry.description;
          entry.cost = Number.parseFloat(params.maintenanceEntry.cost) || null;
          entry.itemIds = [params.itemId];
          pickItem.value = false;
          break;
      }
      nextTick(() => nameInput.value?.focus());
    });

    onUnmounted(cleanup);
  });
</script>

<template>
  <CreateDialog
    :dialog-id="DialogID.EditMaintenance"
    :title="isEdit ? t('maintenance.modal.edit_title') : t('maintenance.modal.new_title')"
    :submit-label="isEdit ? t('maintenance.modal.edit_action') : t('maintenance.modal.new_action')"
    :loading="loading"
    :allow-create-more="!isEdit"
    size="sm"
    @submit="submit"
  >
    <template #crumb>
      <span class="text-[13px] text-muted-foreground">{{ t("menu.maintenance") }}</span>
      <ChevronRight class="size-3.5 text-muted-foreground/60" aria-hidden="true" />
      <span class="text-[13px] text-muted-foreground">
        {{ isEdit ? t("maintenance.modal.edit_title") : t("maintenance.modal.new_title") }}
      </span>
    </template>

    <input
      ref="nameInput"
      v-model="entry.name"
      :placeholder="t('maintenance.modal.name_placeholder')"
      :aria-label="t('maintenance.modal.entry_name')"
      maxlength="255"
      class="h-[30px] w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-[-0.01em] caret-primary outline-none placeholder:text-muted-foreground/80 max-md:text-[22px]"
    />
    <textarea
      v-model="entry.description"
      :placeholder="t('maintenance.modal.notes_placeholder')"
      :aria-label="t('maintenance.modal.notes')"
      maxlength="2500"
      rows="2"
      class="field-sizing-content max-h-48 min-h-[42px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-normal outline-none placeholder:text-muted-foreground/80 max-md:text-base"
    />

    <template #chips>
      <CreateChip
        v-if="pickItem"
        v-model:open="itemPickerOpen"
        :label="t('maintenance.modal.item')"
        :icon="Package"
        icon-class="text-primary"
        :value="picked?.name"
        content-class="w-72"
      >
        <template #default="{ close }">
          <OptionPicker
            v-model="itemId"
            v-model:search="query"
            :options="itemOptions"
            :loading="isLoading"
            remote
            @close="close"
          />
        </template>
      </CreateChip>

      <CreateChip
        :label="t('maintenance.modal.scheduled')"
        :icon="CalendarClock"
        :value="formatDate(entry.scheduledDate)"
        :prefix="t('maintenance.modal.scheduled_prefix')"
        content-class="w-auto p-2.5"
      >
        <template #default="{ close }">
          <Calendar v-model="entry.scheduledDate" @pick="v => v && close()">
            <template #footer="{ today, clear }">
              <div class="mt-2 flex justify-between border-t border-border pt-2">
                <button type="button" class="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted" @click="today">
                  {{ t("global.today") }}
                </button>
                <button
                  v-if="entry.scheduledDate"
                  type="button"
                  class="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  @click="clear"
                >
                  {{ t("global.clear") }}
                </button>
              </div>
            </template>
          </Calendar>
        </template>
      </CreateChip>

      <CreateChip
        :label="t('maintenance.modal.completed')"
        :icon="CircleCheck"
        :value="formatDate(entry.completedDate)"
        :prefix="t('maintenance.modal.completed_prefix')"
        content-class="w-auto p-2.5"
      >
        <template #default="{ close }">
          <Calendar v-model="entry.completedDate" @pick="v => v && close()">
            <template #footer="{ today, clear }">
              <div class="mt-2 flex justify-between border-t border-border pt-2">
                <button type="button" class="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted" @click="today">
                  {{ t("global.today") }}
                </button>
                <button
                  v-if="entry.completedDate"
                  type="button"
                  class="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  @click="clear"
                >
                  {{ t("global.clear") }}
                </button>
              </div>
            </template>
          </Calendar>
        </template>
      </CreateChip>

      <CreateChip
        :label="t('maintenance.modal.cost')"
        :icon="DollarSign"
        :filled="!!entry.cost"
        content-class="w-56 p-2"
      >
        <template #value><Currency :amount="entry.cost ?? 0" /></template>
        <template #default="{ close }">
          <label class="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {{ t("maintenance.modal.cost") }}
            <NumberField
              :model-value="entry.cost ?? undefined"
              :min="0"
              :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }"
              placeholder="0.00"
              @update:model-value="v => (entry.cost = v ?? null)"
              @enter="close"
            />
          </label>
        </template>
      </CreateChip>
    </template>
  </CreateDialog>
</template>
