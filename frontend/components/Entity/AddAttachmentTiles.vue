<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ImagePlus, Loader2, Paperclip } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { AttachmentTypes } from "~~/lib/api/types/non-generated";

  type Kind = "photo" | "file";

  /**
   * "Add photo" and "Attach file" tiles that upload straight to an item or place.
   * Several files can be picked at once; `uploaded` fires once after any succeed,
   * so the page can reload the entity (the upload response may not list the new
   * attachment yet).
   */
  const props = withDefaults(
    defineProps<{
      entityId: string;
      /** Which tiles to show; with none, only the hidden inputs render and `pick()` opens them. */
      kinds?: Kind[];
    }>(),
    { kinds: () => ["photo", "file"] }
  );
  const emit = defineEmits<{ uploaded: [] }>();

  const { t } = useI18n();
  const api = useUserApi();

  const photoInput = useTemplateRef<HTMLInputElement>("photoInput");
  const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
  const uploading = ref<Kind | null>(null);

  const tiles = computed(() =>
    [
      { key: "photo" as const, label: t("shell.item_page.add_photo"), icon: ImagePlus },
      { key: "file" as const, label: t("shell.item_page.attach_file"), icon: Paperclip },
    ].filter(tile => props.kinds.includes(tile.key))
  );

  function pick(kind: Kind) {
    if (uploading.value) return;
    (kind === "photo" ? photoInput : fileInput).value?.click();
  }

  defineExpose({ pick, uploading });

  async function upload(kind: Kind, e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;

    uploading.value = kind;
    const type = kind === "photo" ? AttachmentTypes.Photo : AttachmentTypes.Attachment;
    let added = 0;
    for (const file of files) {
      const { error, status } = await api.items.attachments.add(props.entityId, file, file.name, type);
      if (error) {
        toast.error(status === 413 ? t("items.toast.attachment_too_large") : t("items.toast.failed_upload_attachment"));
        continue;
      }
      added++;
    }
    uploading.value = null;
    if (added) {
      toast.success(t("items.toast.attachment_uploaded"));
      emit("uploaded");
    }
  }
</script>

<template>
  <button
    v-for="tile in tiles"
    :key="tile.key"
    type="button"
    :disabled="!!uploading"
    class="flex h-[90px] w-30 flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
    @click="pick(tile.key)"
  >
    <Loader2 v-if="uploading === tile.key" class="size-4 animate-spin" aria-hidden="true" />
    <component :is="tile.icon" v-else class="size-4" aria-hidden="true" />
    {{ uploading === tile.key ? t("shell.item_page.uploading") : tile.label }}
  </button>
  <input ref="photoInput" type="file" accept="image/*" multiple class="hidden" @change="upload('photo', $event)" />
  <input ref="fileInput" type="file" multiple class="hidden" @change="upload('file', $event)" />
</template>
