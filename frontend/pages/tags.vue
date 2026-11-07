<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useQuery } from "@tanstack/vue-query";
  import { Plus, Search } from "@lucide/vue";
  import type { TagOut } from "~/lib/api/types/data-contracts";
  import { useTagStore } from "~/stores/tags";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import ResourceList from "~/components/Resource/List.vue";
  import TagResource from "~/components/Resource/TagResource.vue";
  import SelectionBar from "~/components/Resource/SelectionBar.vue";
  import SelectionAction from "~/components/Resource/SelectionAction.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("global.tags")}` });
  usePageHeader(() => [{ label: t("global.tags") }]);

  const api = useUserApi();
  const confirm = useConfirm();
  const tagStore = useTagStore();
  const preferences = useViewPreferences();
  const { openDialog } = useDialog();

  onMounted(() => tagStore.refresh());

  const { data: values } = useQuery({
    queryKey: computed(() => ["stats", "tags", preferences.value.collectionId]),
    queryFn: async () => new Map(((await api.stats.tags()).data ?? []).map(v => [v.id, v.total])),
  });

  // ----- Tree, flattened in display order -----

  type Row = { tag: TagOut; depth: number; path?: string };

  const byId = computed(() => new Map(tagStore.tags.map(tag => [tag.id, tag])));

  const rows = computed<Row[]>(() => {
    const tags = [...tagStore.tags].sort((a, b) => a.name.localeCompare(b.name));
    const children = new Map<string | null, TagOut[]>();
    for (const tag of tags) {
      const parent = tag.parentId && byId.value.has(tag.parentId) && tag.parentId !== tag.id ? tag.parentId : null;
      children.set(parent, [...(children.get(parent) ?? []), tag]);
    }
    const out: Row[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
      for (const tag of children.get(parent) ?? []) {
        if (seen.has(tag.id)) continue;
        seen.add(tag.id);
        out.push({ tag, depth });
        walk(tag.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  // ----- Filter: matching tags, flat, with their parents as a path -----

  const filter = ref("");
  const pathOf = (tag: TagOut) => {
    const names: string[] = [];
    let parent = tag.parentId ? byId.value.get(tag.parentId) : undefined;
    while (parent && names.length < 10) {
      names.unshift(parent.name);
      parent = parent.parentId ? byId.value.get(parent.parentId) : undefined;
    }
    return names.join(" / ") || undefined;
  };
  const visibleRows = computed<Row[]>(() => {
    const q = filter.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value
      .filter(r => r.tag.name.toLowerCase().includes(q) || r.tag.description?.toLowerCase().includes(q))
      .map(r => ({ tag: r.tag, depth: 0, path: pathOf(r.tag) }));
  });
  // The list holds the tags themselves (so menus and the selection get TagOut); depth and path come from here.
  const visible = computed(() => visibleRows.value.map(r => r.tag));
  const subTagCount = computed(() => {
    const counts = new Map<string, number>();
    for (const tag of tagStore.tags) if (tag.parentId) counts.set(tag.parentId, (counts.get(tag.parentId) ?? 0) + 1);
    return counts;
  });
  const layout = computed(() => new Map(visibleRows.value.map(r => [r.tag.id, r])));

  // ----- Actions -----

  async function remove(tags: TagOut[]) {
    if (!tags.length) return;
    const { isCanceled } = await confirm.open(t("shell.tags_page.delete_confirm", { n: tags.length }));
    if (isCanceled) return;
    const results = await Promise.all(tags.map(tag => api.tags.delete(tag.id)));
    if (results.some(r => r.error)) toast.error(t("tags.toast.failed_delete_tag"));
    else toast.success(t("shell.tags_page.deleted", { n: tags.length }));
    await tagStore.refresh();
  }

  const newTag = () => openDialog(DialogID.CreateTag);
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeaderActions>
      <Button size="sm" class="h-8 gap-1.5" @click="newTag">
        <Plus class="size-4" />
        {{ t("shell.tags_page.new_tag") }}
      </Button>
    </AppHeaderActions>

    <div class="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
      <label class="flex h-7 w-full items-center gap-1.5 text-[13px] text-muted-foreground sm:w-64">
        <span class="sr-only">{{ t("shell.tags_page.filter") }}</span>
        <Search class="size-3.5 shrink-0" aria-hidden="true" />
        <input
          v-model="filter"
          :placeholder="t('shell.tags_page.filter')"
          class="h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          @keydown.esc="($event.target as HTMLInputElement).blur()"
        />
      </label>
      <div class="grow" />
      <span class="text-xs text-muted-foreground tabular-nums">{{
        t("shell.tags_page.count", { n: rows.length })
      }}</span>
    </div>

    <ResourceList
      class="py-1.5"
      :items="visible"
      :get-key="tag => tag.id"
      :to="tag => `/tag/${tag.id}`"
      :label="t('global.tags')"
    >
      <template #default="{ item }">
        <TagResource
          :tag="item"
          :depth="layout.get(item.id)?.depth"
          :path="layout.get(item.id)?.path"
          :value="values?.get(item.id)"
          :sub-tags="subTagCount.get(item.id)"
          @delete="remove"
        />
      </template>
      <template #selection="{ items, clear }">
        <SelectionBar :count="items.length" @clear="clear">
          <SelectionAction destructive @click="remove(items).then(clear)">
            {{ t("shell.items_page.delete") }}
          </SelectionAction>
        </SelectionBar>
      </template>
    </ResourceList>

    <div class="px-1.5">
      <button
        type="button"
        class="flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-muted-foreground hover:bg-muted/70"
        @click="newTag"
      >
        <Plus class="size-4 text-primary" aria-hidden="true" />
        {{ t("shell.tags_page.new_tag") }}
      </button>
    </div>
    <p v-if="filter && !visible.length" class="px-4 py-6 text-center text-sm text-muted-foreground">
      {{ t("tags.no_results") }}
    </p>
  </div>
</template>
