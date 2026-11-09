<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Dialog, DialogContent } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import { useConfirm } from "@/composables/use-confirm";
  import { toast } from "@/components/ui/sonner";
  import MdiClose from "~icons/mdi/close";
  import MdiDownload from "~icons/mdi/download";
  import MdiDelete from "~icons/mdi/delete";
  import MdiPencil from "~icons/mdi/pencil";

  const { t } = useI18n();
  const confirm = useConfirm();

  const { closeDialog, registerOpenDialogCallback } = useDialog();

  const api = useUserApi();

  const image = reactive<{
    attachmentId: string;
    itemId: string;
    originalSrc: string;
    originalType?: string;
    thumbnailSrc?: string;
  }>({
    attachmentId: "",
    itemId: "",
    originalSrc: "",
  });

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.ItemImage, params => {
      image.attachmentId = params.attachmentId;
      image.itemId = params.itemId;
      if (params.type === "preloaded") {
        image.originalSrc = params.originalSrc;
        image.originalType = params.originalType;
        image.thumbnailSrc = params.thumbnailSrc;
      } else if (params.type === "attachment") {
        image.originalSrc = api.authURL(`/entities/${params.itemId}/attachments/${params.attachmentId}`);
        image.originalType = params.mimeType;
        image.thumbnailSrc = params.thumbnailId
          ? api.authURL(`/entities/${params.itemId}/attachments/${params.thumbnailId}`)
          : image.originalSrc;
      }
    });

    onUnmounted(cleanup);
  });

  async function deleteAttachment() {
    const confirmed = await confirm.open(t("items.delete_attachment_confirm"));

    if (confirmed.isCanceled) {
      return;
    }

    const { error } = await api.items.attachments.delete(image.itemId, image.attachmentId);

    if (error) {
      toast.error(t("items.toast.failed_delete_attachment"));
      return;
    }

    closeDialog(DialogID.ItemImage, {
      action: "delete",
      id: image.attachmentId,
    });
    toast.success(t("items.toast.attachment_deleted"));
  }
</script>

<template>
  <Dialog :dialog-id="DialogID.ItemImage">
    <DialogContent
      class="flex max-h-[90svh] w-auto max-w-[min(calc(100vw-1rem),32rem)] flex-col items-center gap-3 border-transparent bg-transparent p-0 shadow-none md:max-w-lg"
      disable-close
    >
      <picture class="min-h-0 overflow-hidden rounded-lg">
        <source :srcset="image.originalSrc" :type="image.originalType" />
        <img
          :src="image.thumbnailSrc"
          alt="attachment image"
          class="max-h-[calc(90svh-4rem)] max-w-[min(calc(100vw-1rem),32rem)] min-w-64 object-contain md:w-auto md:max-w-lg"
        />
      </picture>

      <div
        class="flex shrink-0 items-center gap-0.5 rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80"
      >
        <Button
          variant="ghost"
          size="icon"
          class="rounded-full"
          :title="$t('global.edit')"
          :aria-label="$t('global.edit')"
          @click="closeDialog(DialogID.ItemImage, { action: 'edit', id: image.attachmentId })"
        >
          <MdiPencil />
        </Button>
        <Button
          as="a"
          variant="ghost"
          size="icon"
          class="rounded-full"
          :href="image.originalSrc"
          :title="$t('components.item.attachments_list.download')"
          :aria-label="$t('components.item.attachments_list.download')"
          download
        >
          <MdiDownload />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="rounded-full text-red-600 hover:bg-red-600/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-400/15 dark:hover:text-red-300"
          :title="$t('global.delete')"
          :aria-label="$t('global.delete')"
          @click="deleteAttachment"
        >
          <MdiDelete />
        </Button>
        <div class="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          class="rounded-full"
          :title="$t('global.close')"
          :aria-label="$t('global.close')"
          @click="
            closeDialog(DialogID.ItemImage);
            image.originalSrc = '';
          "
        >
          <MdiClose />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
