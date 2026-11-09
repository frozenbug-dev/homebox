<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Camera, ImagePlus, Loader2, Maximize2 } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { AttachmentTypes } from "~~/lib/api/types/non-generated";
  import type { EntityPhoto } from "~/lib/entity-photos";

  /**
   * The cover photo beside an item's or place's title. Click it to upload a new
   * cover (it becomes the primary photo); the corner button opens it large.
   */
  const props = defineProps<{ entityId: string; photo?: EntityPhoto }>();
  const emit = defineEmits<{ uploaded: []; view: [photo: EntityPhoto] }>();

  const { t } = useI18n();
  const api = useUserApi();
  const input = useTemplateRef<HTMLInputElement>("input");
  const uploading = ref(false);

  async function upload(e: Event) {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = "";
    if (!file) return;
    uploading.value = true;
    const { error, status } = await api.items.attachments.add(
      props.entityId,
      file,
      file.name,
      AttachmentTypes.Photo,
      true
    );
    uploading.value = false;
    if (error) {
      toast.error(status === 413 ? t("items.toast.attachment_too_large") : t("items.toast.failed_upload_attachment"));
      return;
    }
    emit("uploaded");
  }
</script>

<template>
  <div class="group/cover relative size-16 shrink-0 sm:size-[84px]">
    <button
      type="button"
      class="size-full overflow-hidden rounded-xl"
      :class="
        photo
          ? 'border border-border bg-muted'
          : 'border-[1.5px] border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
      "
      :disabled="uploading"
      :aria-label="photo ? t('shell.item_page.change_cover') : t('shell.item_page.add_photo')"
      @click="input?.click()"
    >
      <img v-if="photo" class="size-full object-cover" :src="photo.thumbnailSrc" :alt="$t('items.photo')" />
      <span v-else class="flex size-full items-center justify-center">
        <ImagePlus class="size-5" aria-hidden="true" />
      </span>
      <span
        v-if="photo || uploading"
        class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-white transition-opacity"
        :class="uploading ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'"
        aria-hidden="true"
      >
        <Loader2 v-if="uploading" class="size-5 animate-spin" />
        <Camera v-else class="size-5" />
      </span>
    </button>
    <button
      v-if="photo && !uploading"
      type="button"
      class="absolute right-1 bottom-1 flex size-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 hover:bg-black/70 focus-visible:opacity-100 pointer-coarse:opacity-100"
      :aria-label="t('shell.item_page.view_photo')"
      @click="emit('view', photo)"
    >
      <Maximize2 class="size-3.5" />
    </button>
    <input ref="input" type="file" accept="image/*" class="hidden" @change="upload" />
  </div>
</template>
