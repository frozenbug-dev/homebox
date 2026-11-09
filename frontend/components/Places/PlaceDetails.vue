<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import type { EntityOut, EntityUpdate } from "~/lib/api/types/data-contracts";
  import InlineMarkdown from "~/components/Item/Inline/Markdown.vue";
  import FieldsEditor from "~/components/Item/FieldsEditor.vue";
  import ItemAttachmentsList from "~/components/Item/AttachmentsList.vue";
  import AddAttachmentTiles from "~/components/Entity/AddAttachmentTiles.vue";
  import { entityPhotos } from "~/lib/entity-photos";

  /**
   * The place pane's Details tab: notes, photos, custom fields and files, all
   * edited in place. Changes go up as `update` (a full PUT), uploads and photo
   * deletions as `reload`.
   */
  const props = defineProps<{ place: EntityOut }>();
  const emit = defineEmits<{
    update: [changes: Partial<EntityUpdate>];
    reload: [];
    openAttachment: [attachmentId: string];
  }>();

  const { t } = useI18n();
  const api = useUserApi();

  const fieldsEditor = useTemplateRef<InstanceType<typeof FieldsEditor>>("fieldsEditor");

  /** The first (primary) photo is the cover in the pane's header; the rest are here. */
  const photos = computed(() => entityPhotos(props.place, path => api.authURL(path)).slice(1));
  const files = computed(() => props.place.attachments.filter(a => a.type !== "photo"));
</script>

<template>
  <div class="flex max-w-190 flex-col gap-6 px-4 py-5 sm:px-6">
    <section>
      <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">{{ $t("items.notes") }}</h2>
      <InlineMarkdown
        :value="place.notes"
        :label="$t('items.notes')"
        :placeholder="t('shell.item_page.add_notes')"
        @save="notes => emit('update', { notes })"
      />
    </section>

    <section class="flex flex-wrap gap-2.5" :aria-label="$t('items.photos')">
      <button
        v-for="photo in photos"
        :key="photo.attachmentId"
        type="button"
        class="h-[90px] w-30 overflow-hidden rounded-[10px] border border-border bg-muted transition-opacity hover:opacity-90"
        @click="emit('openAttachment', photo.attachmentId)"
      >
        <img class="size-full object-cover" :src="photo.thumbnailSrc" :alt="$t('items.photo')" loading="lazy" />
      </button>
      <AddAttachmentTiles :entity-id="place.id" @uploaded="emit('reload')" />
    </section>

    <div>
      <FieldsEditor ref="fieldsEditor" :fields="place.fields" @save="fields => emit('update', { fields })" />
      <button
        v-if="!fieldsEditor?.adding"
        type="button"
        class="mt-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-primary hover:bg-muted"
        @click="fieldsEditor?.add()"
      >
        + {{ t("shell.item_page.add_field") }}
      </button>
    </div>

    <section v-if="files.length > 0">
      <h2 class="mb-2 text-[13px] font-semibold text-foreground/80">{{ t("shell.places_page.files") }}</h2>
      <ItemAttachmentsList :attachments="files" :item-id="place.id" preview @open="a => emit('openAttachment', a.id)" />
    </section>
  </div>
</template>
