<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import type { ItemAttachment } from "~~/lib/api/types/data-contracts";
  import { AttachmentTypes } from "~~/lib/api/types/non-generated";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Label } from "@/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import { useConfirm } from "@/composables/use-confirm";
  import FormTextField from "@/components/Form/TextField.vue";

  /**
   * Rename an attachment, change its type, make a photo the cover, or delete
   * it. Closes with the item's attachments after the change.
   */
  const { t } = useI18n();
  const api = useUserApi();
  const confirm = useConfirm();
  const { closeDialog, registerOpenDialogCallback } = useDialog();

  const itemId = ref("");
  const state = reactive({ id: "", title: "", type: "", primary: false, saving: false });

  const types = Object.entries(AttachmentTypes).map(([key, value]) => ({
    text: key[0]!.toUpperCase() + key.slice(1),
    value,
  }));

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.AttachmentEdit, params => {
      itemId.value = params.itemId;
      const a: ItemAttachment = params.attachment;
      Object.assign(state, { id: a.id, title: a.title, type: a.type, primary: a.primary, saving: false });
    });
    onUnmounted(cleanup);
  });

  async function save() {
    state.saving = true;
    const { data, error } = await api.items.attachments.update(itemId.value, state.id, {
      title: state.title,
      type: state.type,
      primary: state.type === AttachmentTypes.Photo && state.primary,
    });
    state.saving = false;
    if (error) {
      toast.error(t("items.toast.failed_save"));
      return;
    }
    toast.success(t("items.toast.attachment_updated"));
    closeDialog(DialogID.AttachmentEdit, { attachments: data.attachments });
  }

  async function remove() {
    const confirmed = await confirm.open(t("items.delete_attachment_confirm"));
    if (confirmed.isCanceled) return;

    const { error } = await api.items.attachments.delete(itemId.value, state.id);
    if (error) {
      toast.error(t("items.toast.failed_delete_attachment"));
      return;
    }
    toast.success(t("items.toast.attachment_deleted"));
    const { data } = await api.items.get(itemId.value);
    closeDialog(DialogID.AttachmentEdit, data ? { attachments: data.attachments } : undefined);
  }
</script>

<template>
  <Dialog :dialog-id="DialogID.AttachmentEdit">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("items.edit.edit_attachment_dialog.title") }}</DialogTitle>
      </DialogHeader>

      <form id="attachment-edit" class="flex flex-col gap-4" @submit.prevent="save">
        <FormTextField v-model="state.title" :label="$t('items.edit.edit_attachment_dialog.attachment_title')" />
        <div class="flex flex-col gap-1.5">
          <Label for="attachment-type">{{ $t("items.edit.edit_attachment_dialog.attachment_type") }}</Label>
          <Select id="attachment-type" v-model:model-value="state.type">
            <SelectTrigger>
              <SelectValue :placeholder="$t('items.edit.edit_attachment_dialog.select_type')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in types" :key="opt.value" :value="opt.value">{{ opt.text }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label v-if="state.type === AttachmentTypes.Photo" class="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox v-model="state.primary" class="mt-0.5" />
          <span>
            <span class="font-medium">{{ t("shell.item_page.use_as_cover") }}</span>
            <span class="block text-xs text-muted-foreground">{{ t("shell.item_page.use_as_cover_hint") }}</span>
          </span>
        </label>
      </form>

      <DialogFooter class="sm:justify-between">
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="remove">
          {{ $t("global.delete") }}
        </Button>
        <Button type="submit" form="attachment-edit" :disabled="state.saving">{{ $t("global.save") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
