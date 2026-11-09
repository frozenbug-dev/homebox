<script setup lang="ts">
  import AppSubheader from "~/components/App/Subheader.vue";
  import { useI18n } from "vue-i18n";
  import { useQuery, useQueryClient } from "@tanstack/vue-query";
  import { useRouteQuery } from "@vueuse/router";
  import { ArrowLeft, Ellipsis, Link as LinkIcon, ListFilter, Plus, Search, Tag as TagIcon, Trash2 } from "@lucide/vue";
  import type { TagOut, TagUpdate } from "~/lib/api/types/data-contracts";
  import { useTagStore } from "~/stores/tags";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import { getIconComponent } from "~/lib/icons";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import ResourceList from "~/components/Resource/List.vue";
  import TagResource from "~/components/Resource/TagResource.vue";
  import SelectionBar from "~/components/Resource/SelectionBar.vue";
  import SelectionAction from "~/components/Resource/SelectionAction.vue";
  import ItemList, { type ItemColumn } from "~/components/Items/List.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import InlineMarkdown from "~/components/Item/Inline/Markdown.vue";
  import IconSelector from "~/components/Form/IconSelector.vue";

  /**
   * Tags in two panes, like Places: every tag on the left, the selected one
   * (`?tag=`) on the right, edited in place, with the items that carry it.
   */
  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  const api = useUserApi();
  const confirm = useConfirm();
  const tagStore = useTagStore();
  const entityTypeStore = useEntityTypeStore();
  const preferences = useViewPreferences();
  const queryClient = useQueryClient();
  const { openDialog } = useDialog();

  onMounted(() => tagStore.refresh());

  const { data: values } = useQuery({
    queryKey: computed(() => ["stats", "tags", preferences.value.collectionId]),
    queryFn: async () => new Map(((await api.stats.tags()).data ?? []).map(v => [v.id, v.total])),
  });

  // ----- Tree, flattened in display order -----

  type Row = { tag: TagOut; depth: number; path?: string };

  const byId = computed(() => new Map(tagStore.tags.map(tag => [tag.id, tag])));
  const parentOf = (tag: TagOut) =>
    tag.parentId && tag.parentId !== tag.id && byId.value.has(tag.parentId) ? tag.parentId : null;

  const children = computed(() => {
    const out = new Map<string | null, TagOut[]>();
    for (const tag of [...tagStore.tags].sort((a, b) => a.name.localeCompare(b.name))) {
      const parent = parentOf(tag);
      out.set(parent, [...(out.get(parent) ?? []), tag]);
    }
    return out;
  });

  const rows = computed<Row[]>(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
      for (const tag of children.value.get(parent) ?? []) {
        if (seen.has(tag.id)) continue;
        seen.add(tag.id);
        out.push({ tag, depth });
        walk(tag.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  /** A tag's ancestors, outermost first. */
  function ancestors(tag: TagOut): TagOut[] {
    const out: TagOut[] = [];
    for (let p = parentOf(tag); p && out.length < 20;) {
      const parent = byId.value.get(p)!;
      out.unshift(parent);
      p = parentOf(parent);
    }
    return out;
  }

  /** A tag and everything under it: it can't move under any of these. */
  function subtree(id: string): Set<string> {
    const out = new Set([id]);
    const walk = (p: string) => {
      for (const c of children.value.get(p) ?? []) {
        if (out.has(c.id)) continue;
        out.add(c.id);
        walk(c.id);
      }
    };
    walk(id);
    return out;
  }

  // ----- Filter: matching tags, flat, with their parents as a path -----

  const filter = ref("");
  const visibleRows = computed<Row[]>(() => {
    const q = filter.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value
      .filter(r => r.tag.name.toLowerCase().includes(q) || r.tag.description?.toLowerCase().includes(q))
      .map(r => ({
        tag: r.tag,
        depth: 0,
        path:
          ancestors(r.tag)
            .map(a => a.name)
            .join(" / ") || undefined,
      }));
  });
  // The list holds the tags themselves (so menus and the selection get TagOut); depth and path come from here.
  const visible = computed(() => visibleRows.value.map(r => r.tag));
  const layout = computed(() => new Map(visibleRows.value.map(r => [r.tag.id, r])));

  // ----- The selected tag -----

  const tagParam = useRouteQuery<string>("tag", "", { mode: "replace" });
  const selectedId = computed(() =>
    tagParam.value && byId.value.has(tagParam.value) ? tagParam.value : rows.value[0]?.tag.id
  );
  const selected = computed(() => (selectedId.value ? byId.value.get(selectedId.value) : undefined));
  const select = (id: string) => (tagParam.value = id);

  const path = computed(() => (selected.value ? ancestors(selected.value) : []));
  const icon = computed(() => (selected.value?.icon ? getIconComponent(selected.value.icon) : undefined));

  useHead({
    title: () => `HomeBox | ${selected.value?.name ?? t("global.tags")}`,
  });
  usePageHeader(() => [
    { label: t("global.tags"), to: selected.value ? "/tags" : undefined },
    ...(selected.value ? [{ label: selected.value.name }] : []),
  ]);

  /** Save a change to the selected tag: shown at once, then a full PUT (the API has no PATCH for tags). */
  async function updateTag(changes: Partial<TagUpdate>) {
    const tag = selected.value;
    if (!tag) return;
    const body: TagUpdate = {
      id: tag.id,
      name: tag.name,
      description: tag.description,
      color: tag.color,
      icon: tag.icon,
      parentId: tag.parentId ?? null,
      ...changes,
    };
    if (tagStore.allTags) tagStore.allTags = tagStore.allTags.map(x => (x.id === tag.id ? { ...x, ...body } : x));
    const { error } = await api.tags.update(tag.id, body);
    if (error) toast.error(t("tags.toast.failed_update_tag"));
    await tagStore.refresh();
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  }

  const parentOpen = ref(false);
  const parentChoices = computed(() => {
    if (!selected.value) return [];
    const blocked = subtree(selected.value.id);
    return rows.value.filter(r => !blocked.has(r.tag.id));
  });
  function setParent(parentId: string | null) {
    parentOpen.value = false;
    if (parentId !== (selected.value?.parentId ?? null)) updateTag({ parentId });
  }

  const SWATCHES = ["#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
  const colorOpen = ref(false);
  function setColor(color: string) {
    colorOpen.value = false;
    if (color !== selected.value?.color) updateTag({ color });
  }

  const iconOpen = ref(false);
  const iconValue = computed({
    get: () => selected.value?.icon ?? "",
    set: v => {
      iconOpen.value = false;
      updateTag({ icon: v ?? "" });
    },
  });

  async function copyLink() {
    if (!selected.value) return;
    await navigator.clipboard.writeText(`${window.location.origin}/tags?tag=${selected.value.id}`);
    toast.success(t("shell.resource.link_copied"));
  }

  // ----- The selected tag's items (including sub-tags; the API expands them) -----

  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));
  const contentsQuery = computed(() => ({
    tags: selectedId.value ? [selectedId.value] : [],
    entityTypeIds: itemTypeIds.value,
    orderBy: "name",
    orderDirection: "asc",
  }));
  const {
    rows: items,
    total,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    fetchNextPage,
  } = useEntityList(contentsQuery, () => !!selectedId.value && itemTypeIds.value.length > 0);
  const wide = useMediaQuery("(width >= 48rem)");
  const columns = computed<Record<ItemColumn, boolean>>(() => ({
    asset: true,
    place: true,
    tags: false,
    quantity: false,
    price: wide.value,
    added: false,
  }));

  // ----- Actions -----

  async function remove(tags: TagOut[]) {
    if (!tags.length) return;
    const { isCanceled } = await confirm.open(t("shell.tags_page.delete_confirm", { n: tags.length }));
    if (isCanceled) return;
    // Deleting the shown tag: show its parent next.
    const shown = selected.value;
    const results = await Promise.all(tags.map(tag => api.tags.delete(tag.id)));
    if (results.some(r => r.error)) toast.error(t("tags.toast.failed_delete_tag"));
    else toast.success(t("shell.tags_page.deleted", { n: tags.length }));
    if (shown && tags.some(x => x.id === shown.id)) tagParam.value = shown.parentId ?? "";
    await tagStore.refresh();
  }

  const newTag = () => openDialog(DialogID.CreateTag);
</script>

<template>
  <div class="grid flex-1 md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
    <AppHeaderActions>
      <Button size="sm" class="h-[30px] text-[13px]" @click="newTag">
        <Plus />
        {{ t("shell.tags_page.new_tag") }}
      </Button>
    </AppHeaderActions>

    <!-- All tags -->
    <section
      class="flex flex-col border-border/70 md:sticky md:top-(--header-height) md:h-[calc(100svh-var(--header-height)-0.5rem-2px)] md:border-r"
      :class="{ 'max-md:hidden': !!tagParam }"
      :aria-label="t('global.tags')"
    >
      <AppSubheader class="flex-nowrap">
        <label class="flex flex-1 items-center gap-1.5 text-[13px] text-muted-foreground">
          <Search class="size-3.5 shrink-0" aria-hidden="true" />
          <input
            v-model="filter"
            :placeholder="t('shell.tags_page.filter')"
            :aria-label="t('shell.tags_page.filter')"
            class="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            @keydown.esc="($event.target as HTMLInputElement).blur()"
          />
        </label>
        <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
          {{ t("shell.tags_page.count", { n: rows.length }) }}
        </span>
      </AppSubheader>

      <div class="flex-1 overflow-y-auto">
        <ResourceList
          class="py-1"
          :items="visible"
          :get-key="tag => tag.id"
          :label="t('global.tags')"
          :hotkeys="false"
          @open="tag => select(tag.id)"
        >
          <template #default="{ item }">
            <TagResource
              :tag="item"
              :depth="layout.get(item.id)?.depth"
              :path="layout.get(item.id)?.path"
              :value="values?.get(item.id)"
              :active="item.id === selectedId"
              @select="tag => select(tag.id)"
              @delete="remove"
            />
          </template>
          <template #selection="{ items: picked, clear }">
            <SelectionBar :count="picked.length" @clear="clear">
              <SelectionAction destructive @click="remove(picked).then(clear)">
                {{ t("shell.items_page.delete") }}
              </SelectionAction>
            </SelectionBar>
          </template>
        </ResourceList>
        <p v-if="!visible.length" class="px-4 py-6 text-center text-sm text-muted-foreground">
          {{ filter ? t("tags.no_results") : t("shell.tags_page.no_tags") }}
        </p>
      </div>
    </section>

    <!-- The selected tag -->
    <section v-if="selected" class="flex min-w-0 flex-col" :class="{ 'max-md:hidden': !tagParam }">
      <header class="flex flex-col gap-2.5 border-b border-border/70 px-4 pt-[22px] pb-4 sm:px-6">
        <NuxtLink
          to="/tags"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:hidden"
        >
          <ArrowLeft class="size-3.5" />
          {{ t("global.tags") }}
        </NuxtLink>
        <nav v-if="path.length" class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <template v-for="(p, i) in path" :key="p.id">
            <button type="button" class="hover:text-foreground hover:underline" @click="select(p.id)">
              {{ p.name }}
            </button>
            <span v-if="i < path.length - 1" aria-hidden="true">/</span>
          </template>
        </nav>

        <div class="flex items-center gap-3">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-full"
            :class="{ 'bg-muted text-muted-foreground': !selected.color }"
            :style="selected.color ? { backgroundColor: selected.color, color: '#fff' } : undefined"
            aria-hidden="true"
          >
            <component :is="icon ?? TagIcon" class="size-[18px]" />
          </span>
          <div class="min-w-0 flex-1">
            <InlineText
              :value="selected.name"
              :label="t('items.name')"
              wrap
              class="-mx-1.5 text-2xl font-semibold tracking-tight"
              @save="name => name && updateTag({ name })"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon" class="size-[30px]" :aria-label="t('shell.item_page.more')">
                <Ellipsis class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem as-child>
                <NuxtLink :to="`/items?tags=${selected.id}`">
                  <ListFilter class="size-4" />
                  {{ t("shell.tags_page.show_items") }}
                </NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem @select="copyLink">
                <LinkIcon class="size-4" />
                {{ t("shell.item_page.copy_link") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive focus:text-destructive" @select="remove([selected])">
                <Trash2 class="size-4" />
                {{ t("shell.tags_page.delete", { n: 1 }) }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="-mt-1 max-w-160">
          <InlineMarkdown
            :value="selected.description"
            :label="t('items.description')"
            :placeholder="t('shell.item_page.add_description')"
            @save="description => updateTag({ description })"
          />
        </div>

        <!-- Properties, each edited where it sits -->
        <div class="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <Popover v-model:open="parentOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-[7px] border border-border px-2 hover:bg-muted"
              >
                <span class="text-muted-foreground">{{ t("shell.tags_page.parent") }}</span>
                <span class="font-medium">{{ path.at(-1)?.name ?? t("shell.tags_page.no_parent") }}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-64 p-0" align="start">
              <Command>
                <CommandInput :placeholder="t('shell.tags_page.filter')" />
                <CommandList class="max-h-64">
                  <CommandEmpty class="py-4 text-center text-sm text-muted-foreground">
                    {{ t("shell.palette.no_results") }}
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="__none" @select="setParent(null)">
                      <span class="text-muted-foreground">{{ t("shell.tags_page.no_parent") }}</span>
                    </CommandItem>
                    <CommandItem
                      v-for="r in parentChoices"
                      :key="r.tag.id"
                      :value="r.tag.name"
                      @select="setParent(r.tag.id)"
                    >
                      <span :style="{ paddingLeft: `${r.depth * 12}px` }" class="flex min-w-0 items-center gap-2">
                        <span
                          class="size-2.5 shrink-0 rounded-full"
                          :class="{ 'bg-muted-foreground/40': !r.tag.color }"
                          :style="r.tag.color ? { backgroundColor: r.tag.color } : undefined"
                          aria-hidden="true"
                        />
                        <span class="truncate">{{ r.tag.name }}</span>
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover v-model:open="colorOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-[7px] border border-border px-2 hover:bg-muted"
              >
                <span class="text-muted-foreground">{{ t("shell.tags_page.color") }}</span>
                <span
                  class="size-3 rounded-full"
                  :class="{
                    'text-muted-foreground swatch-none': !selected.color,
                  }"
                  :style="selected.color ? { backgroundColor: selected.color } : undefined"
                  aria-hidden="true"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-2.5" align="start">
              <div class="grid grid-cols-6 gap-1.5">
                <button
                  type="button"
                  class="size-7 rounded-full text-muted-foreground ring-offset-2 ring-offset-popover swatch-none hover:ring-2 hover:ring-ring/40"
                  :class="{ 'ring-2 ring-ring': !selected.color }"
                  :aria-label="t('shell.tags_page.no_color')"
                  :title="t('shell.tags_page.no_color')"
                  :aria-pressed="!selected.color"
                  @click="setColor('')"
                />
                <button
                  v-for="c in SWATCHES"
                  :key="c"
                  type="button"
                  class="size-7 rounded-full ring-offset-2 ring-offset-popover hover:ring-2 hover:ring-ring/40"
                  :class="{ 'ring-2 ring-ring': selected.color === c }"
                  :style="{ backgroundColor: c }"
                  :aria-label="c"
                  @click="setColor(c)"
                />
                <label
                  class="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted"
                  :title="t('shell.tags_page.custom_color')"
                >
                  <Plus class="size-3.5" />
                  <input
                    type="color"
                    class="absolute inset-0 cursor-pointer opacity-0"
                    :value="selected.color || '#6b7280'"
                    :aria-label="t('shell.tags_page.custom_color')"
                    @change="setColor(($event.target as HTMLInputElement).value)"
                  />
                </label>
              </div>
            </PopoverContent>
          </Popover>

          <Popover v-model:open="iconOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-[7px] border border-border px-2 hover:bg-muted"
              >
                <span class="text-muted-foreground">{{ t("shell.tags_page.icon") }}</span>
                <component :is="icon" v-if="icon" class="size-3.5" />
                <span v-else class="font-medium">{{ t("shell.tags_page.no_icon") }}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-75 p-2.5" align="start">
              <IconSelector v-model="iconValue" />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <AppSubheader class="sm:px-5">
        <span class="text-[13.5px] font-semibold">{{ t("global.items") }}</span>
        <span class="text-xs text-muted-foreground tabular-nums">{{ total }}</span>
      </AppSubheader>

      <ItemList
        virtual
        :rows="items"
        :total="total"
        :has-next-page="!!hasNextPage"
        :is-fetching-next-page="isFetchingNextPage"
        :is-loading="isLoading"
        :columns="columns"
        :filtered="false"
        @load-more="fetchNextPage()"
      />
    </section>
  </div>
</template>
