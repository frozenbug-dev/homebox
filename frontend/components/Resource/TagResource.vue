<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ExternalLink, Link, ListFilter, Trash2 } from "@lucide/vue";
  import type { TagOut } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { useResourceListContext } from "./context";
  import Currency from "~/components/global/Currency.vue";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  /**
   * A tag as a list row: colour dot, name (indented by depth) and description
   * on the left; sub-tag count and the total value of tagged items on the right.
   */
  const props = defineProps<{
    tag: TagOut;
    depth?: number;
    /** Ancestors, shown when the list is flat (e.g. filtered). */
    path?: string;
    value?: number;
    /** Number of direct sub-tags (the tags endpoint doesn't fill `children`). */
    subTags?: number;
  }>();
  const emit = defineEmits<{ delete: [tags: TagOut[]] }>();

  const { t } = useI18n();
  const list = useResourceListContext();
  const asTags = (targets: unknown[]) => targets as TagOut[];

  async function copyLink(tag: TagOut) {
    await navigator.clipboard.writeText(`${window.location.origin}/tag/${tag.id}`);
  }
</script>

<template>
  <ResourceRow :id="tag.id">
    <template #left>
      <span class="flex min-w-0 items-center gap-2.5" :style="{ paddingLeft: `${(depth ?? 0) * 20}px` }">
        <span
          class="size-2.5 shrink-0 rounded-full"
          :class="{ 'bg-muted-foreground/40': !tag.color }"
          :style="tag.color ? { backgroundColor: tag.color } : undefined"
          aria-hidden="true"
        />
        <span v-if="path" class="shrink-0 text-muted-foreground">{{ path }} /</span>
        <NuxtLink :to="`/tag/${tag.id}`" class="truncate font-medium" tabindex="-1">{{ tag.name }}</NuxtLink>
      </span>
      <span v-if="tag.description" class="hidden truncate text-[13px] text-muted-foreground md:inline">
        {{ tag.description }}
      </span>
    </template>

    <template #right>
      <span class="hidden w-28 text-right text-xs sm:inline">
        <template v-if="subTags">{{ t("shell.tags_page.sub_tags", { n: subTags }) }}</template>
      </span>
      <span class="w-24 text-right tabular-nums">
        <Currency v-if="props.value" :amount="props.value" />
      </span>
    </template>

    <template #menu="{ targets }">
      <template v-if="asTags(targets).length === 1">
        <ContextMenuItem @select="navigateTo(`/tag/${asTags(targets)[0]!.id}`)">
          <ExternalLink /> {{ t("shell.resource.open") }}
        </ContextMenuItem>
        <ContextMenuItem @select="navigateTo(`/items?tags=${asTags(targets)[0]!.id}`)">
          <ListFilter /> {{ t("shell.tags_page.show_items") }}
        </ContextMenuItem>
        <ContextMenuItem @select="copyLink(asTags(targets)[0]!)">
          <Link /> {{ t("shell.resource.copy_link") }}
        </ContextMenuItem>
        <ContextMenuSeparator />
      </template>
      <ContextMenuItem
        class="text-destructive focus:text-destructive"
        @select="(emit('delete', asTags(targets)), list.clear())"
      >
        <Trash2 /> {{ t("shell.tags_page.delete", { n: targets.length }) }}
      </ContextMenuItem>
    </template>
  </ResourceRow>
</template>
