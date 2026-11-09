<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Link, ListFilter, Tag, Trash2 } from "@lucide/vue";
  import type { TagOut } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { useResourceListContext } from "./context";
  import Currency from "~/components/global/Currency.vue";
  import ActionMenuBody from "~/components/App/ActionMenu/ActionMenuBody.vue";
  import type { ActionMenuEntry } from "~/components/App/ActionMenu/types";
  import { toast } from "@/components/ui/sonner";
  import { getIconComponent } from "~/lib/icons";

  /**
   * A tag as a row of the tags page's list: icon (in its colour) and name (indented by
   * depth) on the left, the total value of tagged items on the right.
   */
  const props = defineProps<{
    tag: TagOut;
    depth?: number;
    /** Ancestors, shown when the list is flat (e.g. filtered). */
    path?: string;
    value?: number;
    /** The tag shown in the page's detail pane. */
    active?: boolean;
  }>();
  const emit = defineEmits<{ delete: [tags: TagOut[]]; select: [tag: TagOut] }>();

  const { t } = useI18n();
  const list = useResourceListContext();

  const menu = computed<ActionMenuEntry[]>(() => {
    const tags = list.targetsFor(props.tag.id) as TagOut[];
    const one = tags.length === 1 ? tags[0]! : undefined;
    return [
      ...(one
        ? ([
            { id: "open", label: t("shell.resource.open"), icon: Tag, onSelect: () => emit("select", one) },
            {
              id: "items",
              label: t("shell.tags_page.show_items"),
              icon: ListFilter,
              onSelect: () => navigateTo(`/items?tags=${one.id}`),
            },
            {
              id: "copy-link",
              label: t("shell.resource.copy_link"),
              icon: Link,
              onSelect: async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/tags?tag=${one.id}`);
                toast.success(t("shell.resource.link_copied"));
              },
            },
            { kind: "separator" },
          ] satisfies ActionMenuEntry[])
        : []),
      {
        id: "delete",
        label: t("shell.tags_page.delete", { n: tags.length }),
        icon: Trash2,
        destructive: true,
        onSelect: () => (emit("delete", tags), list.clear()),
      },
    ];
  });
</script>

<template>
  <ResourceRow :id="tag.id" :class="active ? 'bg-primary/10 font-medium hover:bg-primary/10' : undefined">
    <template #left>
      <span class="flex min-w-0 items-center gap-2.5" :style="{ paddingLeft: `${(depth ?? 0) * 18}px` }">
        <component
          :is="getIconComponent(tag.icon)"
          class="size-4 shrink-0"
          :class="{ 'text-muted-foreground': !tag.color }"
          :style="tag.color ? { color: tag.color } : undefined"
          aria-hidden="true"
        />
        <span v-if="path" class="shrink-0 text-muted-foreground">{{ path }} /</span>
        <span class="truncate" :class="active ? 'font-semibold' : 'font-medium'">{{ tag.name }}</span>
      </span>
    </template>

    <template #right>
      <span class="w-20 text-right tabular-nums">
        <Currency v-if="props.value" :amount="props.value" />
      </span>
    </template>

    <template #menu>
      <ActionMenuBody :entries="menu" />
    </template>
  </ResourceRow>
</template>
