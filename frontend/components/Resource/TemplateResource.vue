<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Copy, FileText, Pencil, Trash2 } from "@lucide/vue";
  import type { EntityTemplateSummary } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { useResourceListContext } from "./context";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  /** An item template as a list row: name and description; last change on the right. */
  const props = defineProps<{ template: EntityTemplateSummary }>();
  const emit = defineEmits<{
    duplicate: [template: EntityTemplateSummary];
    delete: [templates: EntityTemplateSummary[]];
  }>();

  const { t, locale } = useI18n();
  const list = useResourceListContext();
  const asTemplates = (targets: unknown[]) => targets as EntityTemplateSummary[];

  const updated = computed(() => {
    const d = new Date(props.template.updatedAt);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString(locale.value, { month: "short", day: "numeric", year: "numeric" });
  });
</script>

<template>
  <ResourceRow :id="template.id">
    <template #left>
      <FileText class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <NuxtLink :to="`/template/${template.id}`" class="shrink-0 truncate font-medium" tabindex="-1">
        {{ template.name }}
      </NuxtLink>
      <span v-if="template.description" class="truncate text-[13px] text-muted-foreground">
        {{ template.description }}
      </span>
    </template>

    <template #right>
      <span class="hidden w-28 text-right text-xs sm:inline" :title="t('items.updated_at')">{{ updated }}</span>
    </template>

    <template #menu="{ targets }">
      <template v-if="asTemplates(targets).length === 1">
        <ContextMenuItem @select="navigateTo(`/template/${asTemplates(targets)[0]!.id}`)">
          <Pencil /> {{ t("components.template.card.edit") }}
        </ContextMenuItem>
        <ContextMenuItem @select="emit('duplicate', asTemplates(targets)[0]!)">
          <Copy /> {{ t("components.template.card.duplicate") }}
        </ContextMenuItem>
        <ContextMenuSeparator />
      </template>
      <ContextMenuItem
        class="text-destructive focus:text-destructive"
        @select="(emit('delete', asTemplates(targets)), list.clear())"
      >
        <Trash2 /> {{ t("shell.templates_page.delete", { n: targets.length }) }}
      </ContextMenuItem>
    </template>
  </ResourceRow>
</template>
