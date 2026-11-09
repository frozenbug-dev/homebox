<script setup lang="ts">
  import { RefreshCw } from "@lucide/vue";
  import { watchDebounced } from "@vueuse/core";
  import { useI18n } from "vue-i18n";
  import { Button } from "@/components/ui/button";
  import ItemSelector from "~/components/Item/Selector.vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";

  const { t } = useI18n();
  const props = defineProps<{
    templateId: string;
    canvasData: Record<string, unknown>;
    canvasDataJson?: string; // Serialized canvas data for live preview
    width: number; // label width in mm, for the preview box aspect ratio
    height: number;
    dpi: number;
  }>();

  const emit = defineEmits<{
    "update:item": [item: EntitySummary | null];
  }>();

  const api = useUserApi();
  const { render } = useLabelTemplateActions();

  const { query, results, isLoading, triggerSearch } = useItemSearch(api);

  const selectedItem = ref<EntitySummary | null>(null);
  const previewUrl = ref<string | null>(null);
  const isRenderingPreview = ref(false);
  const previewError = ref<string | null>(null);

  const aspectRatio = computed(() => `${props.width} / ${props.height}`);

  async function renderPreview() {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
    previewError.value = null;

    if (!selectedItem.value || !props.templateId) return;

    isRenderingPreview.value = true;
    try {
      const blob = await render(
        props.templateId,
        [selectedItem.value.id],
        "png",
        "Letter",
        false,
        props.canvasDataJson
      );
      previewUrl.value = URL.createObjectURL(blob);
    } catch (err) {
      previewError.value = t("components.label_template.editor.preview.render_failed");
      console.error("Preview render error:", err);
    } finally {
      isRenderingPreview.value = false;
    }
  }

  watchDebounced(
    () => props.canvasData,
    () => {
      if (selectedItem.value) renderPreview();
    },
    { debounce: 500, deep: true }
  );

  watch(selectedItem, item => {
    emit("update:item", item);
    renderPreview();
  });

  onBeforeUnmount(() => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  });

  defineExpose({ selectedItem, renderPreview });
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <ItemSelector
      v-model="selectedItem"
      :items="results"
      item-text="name"
      item-value="id"
      :is-loading="isLoading"
      :trigger-search="triggerSearch"
      :search="query"
      @update:search="query = $event"
    >
      <template #display="{ item }">
        <span v-if="item" class="truncate">{{ (item as { name: string }).name }}</span>
        <span v-else class="text-muted-foreground">{{ $t("components.label_template.editor.preview.pick_item") }}</span>
      </template>
    </ItemSelector>

    <div class="flex justify-center rounded-lg bg-muted/60 p-3">
      <div
        class="flex w-full items-center justify-center overflow-hidden bg-white shadow-sm ring-1 ring-black/5"
        :style="{ aspectRatio }"
      >
        <p v-if="!selectedItem" class="px-4 text-center text-xs text-muted-foreground">
          {{ $t("components.label_template.editor.preview.select_item_hint") }}
        </p>
        <div v-else-if="isRenderingPreview" class="text-center">
          <div class="mx-auto size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
        <div v-else-if="previewError" class="flex flex-col items-center gap-2">
          <p class="text-xs text-destructive">{{ previewError }}</p>
          <Button variant="ghost" size="sm" @click="renderPreview">
            <RefreshCw class="mr-1 size-3" />
            {{ $t("components.label_template.editor.preview.retry") }}
          </Button>
        </div>
        <img v-else-if="previewUrl" :src="previewUrl" alt="" class="size-full object-contain" />
      </div>
    </div>

    <p v-if="selectedItem" class="text-xs leading-relaxed text-muted-foreground">
      {{
        $t("components.label_template.editor.preview.render_hint", {
          dpi: props.dpi,
        })
      }}
    </p>
  </div>
</template>
