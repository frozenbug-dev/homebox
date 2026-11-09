<script setup lang="ts">
  import { Check, ChevronDown, Download, ExternalLink, ImageUp, Loader2, Trash2, X } from "@lucide/vue";
  import { useI18n } from "vue-i18n";
  import type { ItemAttachment } from "~~/lib/api/types/data-contracts";
  import { AttachmentTypes } from "~~/lib/api/types/non-generated";
  import { attachmentIcon } from "~~/lib/attachment-icon";
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import { useConfirm } from "@/composables/use-confirm";
  import { toast } from "@/components/ui/sonner";
  import InlineText from "~/components/Item/Inline/Text.vue";

  /**
   * View an attachment and edit it in place: the title is editable top-left,
   * the type and "use as cover" sit top-right. Every change is saved right
   * away and handed to the opener through `onChange`.
   */
  const { t } = useI18n();
  const confirm = useConfirm();
  const api = useUserApi();
  const { activeDialog, closeDialog, registerOpenDialogCallback } = useDialog();

  const itemId = ref("");
  const attachment = ref<ItemAttachment | null>(null);
  const saving = ref(false);
  let onChange: ((attachments: ItemAttachment[]) => void) | undefined;

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.Attachment, params => {
      itemId.value = params.itemId;
      attachment.value = params.attachment;
      onChange = params.onChange;
    });
    onUnmounted(cleanup);
  });

  const types = computed(() =>
    [
      AttachmentTypes.Photo,
      AttachmentTypes.Attachment,
      AttachmentTypes.Manual,
      AttachmentTypes.Warranty,
      AttachmentTypes.Receipt,
    ].map(value => ({ value, label: t(`items.${value}`) }))
  );
  const typeLabel = computed(() => types.value.find(o => o.value === attachment.value?.type)?.label ?? "");

  const url = (id: string) => api.authURL(`/entities/${itemId.value}/attachments/${id}`);
  const isExternal = computed(() => {
    const a = attachment.value;
    return !!a && (a.mimeType === "link/url" || a.path.startsWith("http://") || a.path.startsWith("https://"));
  });
  const href = computed(() =>
    attachment.value ? (isExternal.value ? attachment.value.path : url(attachment.value.id)) : ""
  );
  /**
   * Photos always preview as images: the stored mime type is sniffed on upload,
   * which reports SVGs as text/xml (they're still served as image/svg+xml).
   */
  const isImage = computed(
    () =>
      !isExternal.value &&
      (attachment.value?.type === AttachmentTypes.Photo || !!attachment.value?.mimeType.startsWith("image/"))
  );
  const thumbnailSrc = computed(() => (attachment.value?.thumbnail ? url(attachment.value.thumbnail.id) : href.value));
  const isPhoto = computed(() => attachment.value?.type === AttachmentTypes.Photo);
  const isPdf = computed(
    () =>
      !isExternal.value &&
      (attachment.value?.mimeType === "application/pdf" || !!attachment.value?.title.toLowerCase().endsWith(".pdf"))
  );

  /**
   * The server sends attachments with X-Frame-Options: DENY and a sandboxing
   * CSP, so a PDF can't be framed by URL. Fetch it and frame a blob URL instead.
   */
  const pdfSrc = ref("");
  const pdfFailed = ref(false);
  function releasePdf() {
    if (pdfSrc.value) URL.revokeObjectURL(pdfSrc.value);
    pdfSrc.value = "";
  }
  watch(
    [() => attachment.value?.id, isPdf, () => activeDialog.value === DialogID.Attachment],
    async ([id, pdf, open], _, onCleanup) => {
      releasePdf();
      pdfFailed.value = false;
      if (!id || !pdf || !open) return;
      let stale = false;
      onCleanup(() => (stale = true));
      try {
        const res = await fetch(href.value);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (stale) return;
        pdfSrc.value = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      } catch {
        if (!stale) pdfFailed.value = true;
      }
    }
  );
  onUnmounted(releasePdf);

  async function save(changes: Partial<Pick<ItemAttachment, "title" | "type" | "primary">>) {
    const a = attachment.value;
    if (!a) return;
    const next = { title: a.title, type: a.type, primary: a.primary, ...changes };
    // Only photos can be the cover.
    next.primary = next.type === AttachmentTypes.Photo && next.primary;

    const previous = a;
    attachment.value = { ...a, ...next };
    saving.value = true;
    const { data, error } = await api.items.attachments.update(itemId.value, a.id, next);
    saving.value = false;
    if (error) {
      attachment.value = previous;
      toast.error(t("items.toast.failed_save"));
      return;
    }
    attachment.value = data.attachments.find(x => x.id === a.id) ?? attachment.value;
    onChange?.(data.attachments);
  }

  function saveTitle(title: string) {
    if (!title) return; // an attachment always has a name
    save({ title });
  }

  async function remove() {
    const a = attachment.value;
    if (!a) return;
    const confirmed = await confirm.open(t("items.delete_attachment_confirm"));
    if (confirmed.isCanceled) return;

    const { error } = await api.items.attachments.delete(itemId.value, a.id);
    if (error) {
      toast.error(t("items.toast.failed_delete_attachment"));
      return;
    }
    toast.success(t("items.toast.attachment_deleted"));
    const { data } = await api.items.get(itemId.value);
    if (data) onChange?.(data.attachments);
    closeDialog(DialogID.Attachment);
  }
</script>

<template>
  <Dialog :dialog-id="DialogID.Attachment">
    <DialogContent
      class="flex max-h-[90svh] w-[min(calc(100vw-1rem),48rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0"
      disable-close
      @open-auto-focus.prevent
    >
      <template v-if="attachment">
        <header class="flex items-center gap-2 border-b py-2 pr-2 pl-2.5">
          <DialogTitle class="sr-only">{{ attachment.title }}</DialogTitle>
          <DialogDescription class="sr-only">{{ typeLabel }}</DialogDescription>
          <!-- InlineText puts its class on an inner element, so the wrapper takes the free space -->
          <div class="min-w-0 flex-1">
            <InlineText
              class="text-[15px] font-semibold"
              :value="attachment.title"
              :label="$t('items.edit.edit_attachment_dialog.attachment_title')"
              @save="saveTitle"
            />
          </div>

          <Button
            v-if="isPhoto && attachment.primary"
            variant="ghost"
            size="sm"
            class="pointer-events-none text-muted-foreground max-sm:px-2"
            tabindex="-1"
          >
            <Check />
            <span class="max-sm:sr-only">{{ $t("shell.item_page.is_cover") }}</span>
          </Button>
          <Button
            v-else-if="isPhoto"
            variant="outline"
            size="sm"
            class="max-sm:px-2"
            :disabled="saving"
            :title="$t('shell.item_page.use_as_cover_hint')"
            @click="save({ primary: true })"
          >
            <ImageUp />
            <span class="max-sm:sr-only">{{ $t("shell.item_page.use_as_cover") }}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                :disabled="saving"
                :aria-label="$t('items.edit.edit_attachment_dialog.attachment_type')"
              >
                {{ typeLabel }}
                <ChevronDown class="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-40">
              <DropdownMenuRadioGroup
                :model-value="attachment.type"
                @update:model-value="type => type !== attachment!.type && save({ type: type as string })"
              >
                <DropdownMenuRadioItem v-for="opt in types" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div class="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :title="$t('global.close')"
            :aria-label="$t('global.close')"
            @click="closeDialog(DialogID.Attachment)"
          >
            <X />
          </Button>
        </header>

        <div class="flex min-h-0 flex-1 items-center justify-center bg-muted/50">
          <picture v-if="isImage" class="flex min-h-0 justify-center">
            <source v-if="attachment.mimeType.startsWith('image/')" :srcset="href" :type="attachment.mimeType" />
            <img :src="thumbnailSrc" :alt="attachment.title" class="max-h-[calc(90svh-7rem)] min-w-64 object-contain" />
          </picture>
          <template v-else-if="isPdf && !pdfFailed">
            <iframe
              v-if="pdfSrc"
              :src="pdfSrc"
              :title="attachment.title"
              class="h-[calc(90svh-7rem)] w-full border-0 bg-background"
            />
            <div v-else class="flex h-[calc(90svh-7rem)] items-center justify-center text-muted-foreground">
              <Loader2 class="size-5 animate-spin" aria-hidden="true" />
            </div>
          </template>
          <div v-else class="flex flex-col items-center gap-3 px-6 py-14 text-muted-foreground">
            <div class="flex size-14 items-center justify-center rounded-xl bg-background">
              <component :is="attachmentIcon(attachment)" class="size-6" aria-hidden="true" />
            </div>
            <Button as="a" variant="outline" size="sm" :href="href" target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {{ $t("components.item.attachments_list.open_new_tab") }}
            </Button>
          </div>
        </div>

        <footer class="flex items-center justify-between gap-2 border-t p-2">
          <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="remove">
            <Trash2 />
            {{ $t("global.delete") }}
          </Button>
          <div class="flex items-center gap-1">
            <Button
              v-if="isPdf || isImage"
              as="a"
              variant="ghost"
              size="sm"
              :href="href"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              <span class="max-sm:sr-only">{{ $t("components.item.attachments_list.open_new_tab") }}</span>
            </Button>
            <Button v-if="!isExternal" as="a" variant="ghost" size="sm" :href="href" :download="attachment.title">
              <Download />
              <span class="max-sm:sr-only">{{ $t("components.item.attachments_list.download") }}</span>
            </Button>
          </div>
        </footer>
      </template>
    </DialogContent>
  </Dialog>
</template>
