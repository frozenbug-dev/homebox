<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import type {
    EntityTypeCreate,
    EntityTypeSummary,
    EntityTypeUpdate,
    EntityTemplateSummary,
  } from "~~/lib/api/types/data-contracts";
  import { MapPin, Package, Pencil, Plus, Trash2 } from "@lucide/vue";
  import { Button } from "@/components/ui/button";
  import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsListRow from "~/components/Settings/ListRow.vue";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import FormTextField from "~/components/Form/TextField.vue";
  import FormCheckbox from "~/components/Form/Checkbox.vue";
  import TemplateSelector from "~/components/Template/Selector.vue";
  import { useEntityTypeStore } from "~/stores/entityTypes";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();

  const api = useUserApi();
  const confirm = useConfirm();
  const { openDialog, closeDialog } = useDialog();
  const entityTypeStore = useEntityTypeStore();

  const entityTypes = computed(() => entityTypeStore.allTypes);

  // Create form
  const createForm = reactive({
    name: "",
    icon: "",
    isLocation: false,
  });
  const createTemplate = ref<EntityTemplateSummary | null>(null);

  function resetCreateForm() {
    createForm.name = "";
    createForm.icon = "";
    createForm.isLocation = false;
    createTemplate.value = null;
  }

  async function create() {
    if (!createForm.name.trim()) {
      toast.error(t("components.entityTypes.toasts.name_required"));
      return;
    }

    const payload = {
      name: createForm.name,
      icon: createForm.icon,
      isLocation: createForm.isLocation,
      ...(createTemplate.value?.id ? { defaultTemplateId: createTemplate.value.id } : {}),
    } as EntityTypeCreate;

    const { error } = await api.entityTypes.create(payload);
    if (error) {
      toast.error(t("components.entityTypes.toasts.create_failed"));
      return;
    }

    toast.success(t("components.entityTypes.toasts.create_success"));
    resetCreateForm();
    closeDialog(DialogID.CreateEntityType);
    entityTypeStore.refresh();
  }

  // Update form
  const updateForm = reactive({
    id: "",
    name: "",
    icon: "",
    isLocation: false,
    originalIsItem: false,
  });
  const updateTemplate = ref<EntityTemplateSummary | null>(null);

  function openEdit(et: EntityTypeSummary) {
    updateForm.id = et.id;
    updateForm.name = et.name;
    updateForm.icon = et.icon;
    updateForm.isLocation = et.isLocation;
    updateForm.originalIsItem = !et.isLocation;
    updateTemplate.value = et.defaultTemplate
      ? ({
          id: et.defaultTemplate.id,
          name: et.defaultTemplate.name,
          description: et.defaultTemplate.description,
        } as EntityTemplateSummary)
      : null;
    openDialog(DialogID.UpdateEntityType);
  }

  async function update() {
    if (!updateForm.name.trim()) {
      toast.error(t("components.entityTypes.toasts.name_required"));
      return;
    }

    const payload = {
      id: updateForm.id,
      name: updateForm.name,
      icon: updateForm.icon,
      isLocation: updateForm.isLocation,
      ...(updateTemplate.value?.id ? { defaultTemplateId: updateTemplate.value.id } : {}),
    } as EntityTypeUpdate;

    if (updateForm.originalIsItem && updateForm.isLocation) {
      const { isCanceled } = await confirm.open(t("components.entityTypes.confirm.convert_item_to_location"));
      if (isCanceled) return;
    }

    const { error } = await api.entityTypes.update(updateForm.id, payload);
    if (error) {
      toast.error(t("components.entityTypes.toasts.update_failed"));
      return;
    }

    toast.success(t("components.entityTypes.toasts.update_success"));
    closeDialog(DialogID.UpdateEntityType);
    entityTypeStore.refresh();
  }

  async function deleteEntityType(et: EntityTypeSummary) {
    const { isCanceled } = await confirm.open(
      t("components.entityTypes.confirm.delete_entity_type", { name: t(et.name) })
    );
    if (isCanceled) return;

    const { error } = await api.entityTypes.delete(et.id);
    if (error) {
      toast.error(t("components.entityTypes.toasts.delete_confirm_failed"));
      return;
    }

    toast.success(t("components.entityTypes.toasts.delete_success"));
    entityTypeStore.refresh();
  }
</script>

<template>
  <SettingsSection
    :title="t('collection.settings.nav.entity_types')"
    :description="t('collection.settings.entity_types_sub')"
  >
    <template #actions>
      <Button size="sm" @click="openDialog(DialogID.CreateEntityType)">
        <Plus /> {{ t("components.entityTypes.page.empty_button") }}
      </Button>
    </template>

    <!-- Create Dialog -->
    <Dialog :dialog-id="DialogID.CreateEntityType">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("components.entityTypes.create_dialog.title") }}</DialogTitle>
        </DialogHeader>
        <form class="flex flex-col gap-3" @submit.prevent="create">
          <FormTextField
            v-model="createForm.name"
            :autofocus="true"
            :label="t('components.entityTypes.create_dialog.name_label')"
            :max-length="255"
            :min-length="1"
          />
          <FormCheckbox
            v-model="createForm.isLocation"
            :label="t('components.entityTypes.create_dialog.is_container_location_type_label')"
          />
          <TemplateSelector v-if="!createForm.isLocation" v-model="createTemplate" />

          <DialogFooter>
            <Button type="submit">{{ t("components.entityTypes.create_dialog.button") }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Update Dialog -->
    <Dialog :dialog-id="DialogID.UpdateEntityType">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("components.entityTypes.update_dialog.title") }}</DialogTitle>
        </DialogHeader>
        <form class="flex flex-col gap-3" @submit.prevent="update">
          <FormTextField
            v-model="updateForm.name"
            :autofocus="true"
            :label="t('components.entityTypes.update_dialog.name_label')"
            :max-length="255"
            :min-length="1"
          />
          <FormCheckbox
            v-model="updateForm.isLocation"
            :label="t('components.entityTypes.update_dialog.is_container_location_type_label')"
          />
          <TemplateSelector v-if="!updateForm.isLocation" v-model="updateTemplate" />

          <DialogFooter>
            <Button type="submit">{{ t("components.entityTypes.update_dialog.button") }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <SettingsGroup v-if="entityTypes && entityTypes.length > 0">
      <SettingsListRow
        v-for="et in entityTypes"
        :key="et.id"
        :title="t(et.name)"
        :subtitle="
          et.defaultTemplate && !et.isLocation
            ? t('components.entityTypes.card.default_template', { name: et.defaultTemplate.name })
            : undefined
        "
      >
        <template #icon>
          <MapPin v-if="et.isLocation" />
          <Package v-else />
        </template>
        <span
          v-if="et.isLocation"
          class="inline-flex h-[22px] items-center rounded-full bg-accent px-2 text-xs font-medium text-accent-foreground"
        >
          {{ t("components.entityTypes.card.badge_container") }}
        </span>
        <template #menu>
          <DropdownMenuItem @select="openEdit(et)">
            <Pencil /> {{ t("components.entityTypes.card.tooltip.edit") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deleteEntityType(et)">
            <Trash2 /> {{ t("components.entityTypes.card.tooltip.delete") }}
          </DropdownMenuItem>
        </template>
      </SettingsListRow>
    </SettingsGroup>

    <div v-else class="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
      <p class="mb-4 text-sm text-muted-foreground">{{ t("components.entityTypes.page.empty_title") }}</p>
      <Button size="sm" @click="openDialog(DialogID.CreateEntityType)">
        <Plus /> {{ t("components.entityTypes.page.empty_button") }}
      </Button>
    </div>
  </SettingsSection>
</template>
