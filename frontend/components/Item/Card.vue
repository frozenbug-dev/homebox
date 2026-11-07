<template>
  <Card class="relative flex flex-col overflow-hidden transition-colors hover:border-ring/50">
    <div v-if="tableRow" class="absolute top-2 left-2 z-10">
      <Checkbox
        class="size-5 bg-background"
        :model-value="tableRow.getIsSelected()"
        :aria-label="$t('components.item.view.selectable.select_card')"
        @update:model-value="tableRow.toggleSelected()"
      />
    </div>
    <NuxtLink :to="`/${item.entityType?.isLocation ? 'location' : 'item'}/${item.id}`" class="flex grow flex-col">
      <div class="relative h-40 bg-accent/60">
        <template v-if="hasImage">
          <img
            v-if="objectContain"
            class="absolute size-full object-cover blur-md"
            loading="lazy"
            :src="imageUrl"
            alt=""
          />
          <img
            class="absolute size-full"
            :class="objectContain ? 'object-contain' : 'object-cover'"
            loading="lazy"
            :src="imageUrl"
            :alt="item.name"
          />
        </template>
        <div v-else class="flex size-full items-center justify-center text-primary/40" aria-hidden="true">
          <MapPin v-if="item.entityType?.isLocation" class="size-11" :stroke-width="1.25" />
          <Box v-else class="size-11" :stroke-width="1.25" />
        </div>
        <div v-if="item.parent" class="absolute bottom-2 left-2 max-w-[calc(100%-1rem)]">
          <NuxtLink
            :to="`/location/${item.parent.id}`"
            class="flex items-center gap-1 truncate rounded-full bg-background/95 px-2 py-0.5 text-xs font-medium shadow-xs hover:underline"
          >
            <MapPin class="size-3 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ locationString }}</span>
          </NuxtLink>
        </div>
      </div>
      <div class="flex grow flex-col gap-1.5 p-4">
        <div class="flex items-start gap-2">
          <h2 class="line-clamp-2 grow text-[15px] leading-snug font-semibold">{{ item.name }}</h2>
          <TooltipProvider :delay-duration="0">
            <Tooltip v-if="item.insured">
              <TooltipTrigger class="mt-0.5">
                <MdiShieldCheck class="size-4 text-primary" />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.insured") }}
              </TooltipContent>
            </Tooltip>
            <Tooltip v-if="item.archived">
              <TooltipTrigger class="mt-0.5">
                <MdiArchive class="size-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.archived") }}
              </TooltipContent>
            </Tooltip>
            <Tooltip v-if="item.quantity !== 1">
              <TooltipTrigger>
                <Badge variant="secondary" class="tabular-nums">×{{ item.quantity }}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.quantity") }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Markdown class="line-clamp-2 text-sm text-ellipsis text-muted-foreground" :source="item.description" />
        <div v-if="itemTags.length" class="mt-auto flex flex-wrap gap-1.5 pt-2">
          <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
        </div>
      </div>
    </NuxtLink>
  </Card>
</template>

<script setup lang="ts">
  import type { EntityOut, EntitySummary } from "~~/lib/api/types/data-contracts";
  import MdiShieldCheck from "~icons/mdi/shield-check";
  import MdiArchive from "~icons/mdi/archive";
  import { Badge } from "@/components/ui/badge";
  import { Card } from "@/components/ui/card";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { Box, MapPin } from "@lucide/vue";
  import Markdown from "@/components/global/Markdown.vue";
  import TagChip from "@/components/Tag/Chip.vue";
  import type { Row } from "@tanstack/vue-table";
  import { Checkbox } from "@/components/ui/checkbox";

  const api = useUserApi();
  const preferences = useViewPreferences();

  const imageUrl = computed(() => {
    if (!props.item.imageId) {
      return "/no-image.jpg";
    }
    if (props.item.thumbnailId) {
      return api.authURL(`/entities/${props.item.id}/attachments/${props.item.thumbnailId}`);
    } else {
      return api.authURL(`/entities/${props.item.id}/attachments/${props.item.imageId}`);
    }
  });

  const itemTags = computed(() => {
    return useTagStore().withAncestors(props.item.tags);
  });

  const props = defineProps({
    item: {
      type: Object as () => EntityOut | EntitySummary,
      required: true,
    },
    locationFlatTree: {
      type: Array as () => FlatTreeItem[],
      required: false,
      default: () => [],
    },
    tableRow: {
      type: Object as () => Row<EntitySummary>,
      required: false,
      default: () => null,
    },
  });

  const hasImage = computed(() => !!props.item.imageId);

  const objectContain = computed(() => imageUrl.value !== "/no-image.jpg" && !preferences.value.legacyImageFit);

  const locationString = computed(
    () => props.locationFlatTree.find(l => l.id === props.item.parent?.id)?.treeString || props.item.parent?.name
  );
</script>

<style lang="css"></style>
