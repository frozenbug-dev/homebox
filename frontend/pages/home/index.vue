<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useQuery } from "@tanstack/vue-query";
  import { Calendar, Camera, ChevronRight, CircleCheckBig, House, MapPin, Wrench } from "@lucide/vue";
  import type { Component } from "vue";
  import { MaintenanceFilterStatus } from "~/lib/api/types/data-contracts";
  import ItemList, { type ItemColumn } from "~/components/Items/List.vue";
  import Currency from "~/components/global/Currency.vue";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import { useTagStore } from "~~/stores/tags";

  definePageMeta({ middleware: ["auth"] });

  const { t, locale } = useI18n();
  useHead({ title: () => `HomeBox | ${t("menu.home")}` });

  const api = useUserApi();
  const preferences = useViewPreferences();
  const entityTypeStore = useEntityTypeStore();
  const tagStore = useTagStore();

  onMounted(() => tagStore.ensureAllTagsFetched());

  const collection = computed(() => preferences.value.collectionId);
  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));
  const hasItemTypes = computed(() => itemTypeIds.value.length > 0);

  // ----- Quick statistics -----

  const { data: stats } = useQuery({
    queryKey: computed(() => ["stats", "group", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.stats.group();
      if (error) throw new Error("Failed to load statistics");
      return data;
    },
  });

  // ----- Recently added -----

  const { data: recent, refetch: refetchRecent } = useQuery({
    queryKey: computed(() => ["entities", "recent", collection.value, itemTypeIds.value]),
    queryFn: async () => {
      const { data, error } = await api.items.getAll({
        page: 1,
        pageSize: 8,
        orderBy: "createdAt",
        orderDirection: "desc",
        entityTypeIds: itemTypeIds.value,
      });
      if (error) throw new Error("Failed to load recent items");
      return data.items;
    },
    enabled: hasItemTypes,
  });

  // Narrow lists move the pills onto a second line (ItemResource), so every column fits.
  const columns: Record<ItemColumn, boolean> = {
    asset: true,
    place: true,
    tags: true,
    quantity: true,
    price: true,
    added: true,
  };

  // ----- Places -----

  const { data: places } = useQuery({
    queryKey: computed(() => ["entities", "places", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.items.getLocations({ filterChildren: false });
      if (error) throw new Error("Failed to load places");
      return data;
    },
  });

  const childrenOf = computed(() => {
    const out = new Map<string, string[]>();
    for (const p of places.value ?? []) {
      if (!p.parent?.id) continue;
      out.set(p.parent.id, [...(out.get(p.parent.id) ?? []), p.id]);
    }
    return out;
  });

  /** Top-level places, with how many places sit below them and the units (summed quantities) they hold. */
  const topPlaces = computed(() => {
    const all = places.value ?? [];
    const direct = new Map(all.map(p => [p.id, p.itemCount ?? 0]));
    const descendants = (id: string): string[] =>
      (childrenOf.value.get(id) ?? []).flatMap(child => [child, ...descendants(child)]);
    return all
      .filter(p => !p.parent?.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => {
        const below = descendants(p.id);
        return {
          id: p.id,
          name: p.name,
          inside: below.length,
          items: [p.id, ...below].reduce((n, id) => n + (direct.get(id) ?? 0), 0),
        };
      });
  });

  /** Places with nothing in them and no places inside them. */
  const emptyPlaces = computed(
    () => (places.value ?? []).filter(p => !p.itemCount && !childrenOf.value.has(p.id)).length
  );

  // ----- Tags -----

  const tags = computed(() => [...tagStore.tags].sort((a, b) => a.name.localeCompare(b.name)));
  /** Like the Tags page: a tag is top level unless its parent is another known tag (the API may send a zero id). */
  const topLevelTags = computed(() => {
    const ids = new Set(tags.value.map(tag => tag.id));
    return tags.value.filter(tag => !tag.parentId || tag.parentId === tag.id || !ids.has(tag.parentId)).length;
  });

  // ----- "Worth a minute": small chores, each counted with an existing filter -----

  const { data: withoutPhoto } = useQuery({
    queryKey: computed(() => ["entities", "count", "without-photo", collection.value, itemTypeIds.value]),
    queryFn: async () => {
      const { data, error } = await api.items.getAll({
        page: 1,
        pageSize: 1,
        onlyWithoutPhoto: true,
        entityTypeIds: itemTypeIds.value,
      });
      if (error) throw new Error("Failed to count items");
      return data.total;
    },
    enabled: hasItemTypes,
  });

  const { data: scheduled } = useQuery({
    queryKey: computed(() => ["maintenance", "scheduled", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.maintenance.getAll({
        status: MaintenanceFilterStatus.MaintenanceFilterStatusScheduled,
      });
      if (error) throw new Error("Failed to load maintenance");
      return data;
    },
  });

  const DAY = 24 * 60 * 60 * 1000;

  const maintenance = computed(() => {
    const now = Date.now();
    const soon = now + 30 * DAY;
    const dated = (scheduled.value ?? [])
      .map(entry => ({ entry, due: new Date(entry.scheduledDate).getTime() }))
      .filter(x => !Number.isNaN(x.due))
      .sort((a, b) => a.due - b.due);
    const overdue = dated.filter(x => x.due < now);
    const upcoming = dated.filter(x => x.due >= now && x.due < soon);
    return { overdue, upcoming, now };
  });

  const entryName = (e: { name: string; itemName: string }) => e.name || e.itemName;

  type Chore = {
    key: string;
    count: number;
    label: string;
    hint: string;
    icon: Component;
    to: string;
    tone?: "warn";
  };

  const chores = computed<Chore[]>(() => {
    const { overdue, upcoming, now } = maintenance.value;
    const late = overdue[0];
    const next = upcoming[0];
    return [
      {
        key: "overdue",
        count: overdue.length,
        label: t("shell.home.chore_overdue"),
        hint: late
          ? t("shell.home.chore_overdue_hint", {
              n: Math.max(1, Math.floor((now - late.due) / DAY)),
              name: entryName(late.entry),
            })
          : "",
        icon: Wrench,
        to: "/maintenance",
        tone: "warn" as const,
      },
      {
        key: "upcoming",
        count: upcoming.length,
        label: t("shell.home.chore_upcoming"),
        hint: next
          ? t("shell.home.chore_upcoming_hint", { name: entryName(next.entry), date: shortDate(next.due) })
          : "",
        icon: Calendar,
        to: "/maintenance",
      },
      {
        key: "photo",
        count: withoutPhoto.value ?? 0,
        label: t("shell.home.chore_photo"),
        hint: t("shell.home.chore_photo_hint"),
        icon: Camera,
        to: "/items?photo=without",
      },
      {
        key: "empty",
        count: emptyPlaces.value,
        label: t("shell.home.chore_empty_places"),
        hint: t("shell.home.chore_empty_places_hint"),
        icon: MapPin,
        to: "/locations",
      },
    ].filter(c => c.count > 0);
  });

  /** "Nov 7" style dates. */
  function shortDate(value: Date | string | number) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale.value, { month: "short", day: "numeric" });
  }
</script>

<template>
  <div class="flex flex-1 flex-col gap-6 px-4 py-5 sm:px-7 sm:py-6">
    <!-- Quick statistics -->
    <section
      :aria-label="t('home.quick_statistics')"
      class="grid grid-cols-2 overflow-hidden rounded-xl border border-border lg:grid-cols-4"
    >
      <NuxtLink
        to="/items"
        class="flex min-w-0 flex-col gap-1 border-b border-border px-4 py-3 hover:bg-muted/40 lg:border-b-0 lg:px-[18px] lg:py-3.5"
      >
        <span class="text-[12.5px] text-muted-foreground">{{ t("shell.home.stat_value") }}</span>
        <span class="truncate text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">
          <Currency v-if="stats" :amount="stats.totalItemPrice" />
          <template v-else>–</template>
        </span>
        <span class="hidden truncate text-xs text-muted-foreground sm:block">
          {{ t("shell.home.stat_value_hint") }}
        </span>
      </NuxtLink>
      <NuxtLink
        to="/items"
        class="flex min-w-0 flex-col gap-1 border-b border-l border-border px-4 py-3 hover:bg-muted/40 lg:border-b-0 lg:px-[18px] lg:py-3.5"
      >
        <span class="text-[12.5px] text-muted-foreground">{{ t("shell.home.stat_items") }}</span>
        <span class="text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">{{
          stats?.totalItems ?? "–"
        }}</span>
        <span class="hidden truncate text-xs text-muted-foreground sm:block">
          {{ t("shell.home.stat_items_hint", { n: stats?.totalWithWarranty ?? 0 }) }}
        </span>
      </NuxtLink>
      <NuxtLink
        to="/locations"
        class="flex min-w-0 flex-col gap-1 border-border px-4 py-3 hover:bg-muted/40 lg:border-l lg:px-[18px] lg:py-3.5"
      >
        <span class="text-[12.5px] text-muted-foreground">{{ t("shell.home.stat_places") }}</span>
        <span class="text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">
          {{ stats?.totalLocations ?? "–" }}
        </span>
        <span class="hidden truncate text-xs text-muted-foreground sm:block">
          {{ t("shell.home.top_level_count", { n: topPlaces.length }) }}
        </span>
      </NuxtLink>
      <NuxtLink
        to="/tags"
        class="flex min-w-0 flex-col gap-1 border-l border-border px-4 py-3 hover:bg-muted/40 lg:px-[18px] lg:py-3.5"
      >
        <span class="text-[12.5px] text-muted-foreground">{{ t("shell.home.stat_tags") }}</span>
        <span class="text-xl font-semibold tracking-tight tabular-nums lg:text-2xl">{{ stats?.totalTags ?? "–" }}</span>
        <span class="hidden truncate text-xs text-muted-foreground sm:block">
          {{ t("shell.home.top_level_count", { n: topLevelTags }) }}
        </span>
      </NuxtLink>
    </section>

    <!-- Two columns on large screens; one column (chores first) below that -->
    <div class="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-7">
      <div class="flex min-w-0 flex-col gap-6 max-xl:contents">
        <!-- Recently added -->
        <section aria-labelledby="home-recent" class="min-w-0 overflow-x-clip max-xl:order-2">
          <div class="flex h-7 items-center justify-between">
            <h2 id="home-recent" class="text-[13px] font-semibold text-foreground/80">
              {{ t("shell.home.recently_added") }}
            </h2>
            <NuxtLink to="/items" class="text-xs text-muted-foreground hover:text-foreground">
              {{ t("shell.home.view_all") }}
            </NuxtLink>
          </div>
          <p v-if="recent && recent.length === 0" class="py-4 text-sm text-muted-foreground">
            {{ t("items.no_results") }}
          </p>
          <ItemList
            v-else-if="recent"
            bare
            class="-mx-1.5 -mt-0.5"
            :rows="recent"
            :total="recent.length"
            :columns="columns"
            @changed="refetchRecent()"
          />
        </section>

        <!-- Tags -->
        <section v-if="tags.length" aria-labelledby="home-tags" class="max-xl:order-4">
          <div class="mb-1.5 flex h-7 items-center justify-between">
            <h2 id="home-tags" class="text-[13px] font-semibold text-foreground/80">{{ t("shell.home.tags") }}</h2>
            <NuxtLink to="/tags" class="text-xs text-muted-foreground hover:text-foreground">
              {{ t("shell.home.manage") }}
            </NuxtLink>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="tag in tags"
              :key="tag.id"
              :to="`/items?tags=${tag.id}`"
              class="flex h-8 items-center gap-[7px] rounded-full border border-border pr-2.5 pl-[9px] text-[13px] font-medium hover:bg-muted/40 lg:h-7"
            >
              <span
                class="size-2 shrink-0 rounded-full bg-muted-foreground/40"
                :style="tag.color ? { backgroundColor: tag.color } : undefined"
                aria-hidden="true"
              />
              {{ tag.name }}
            </NuxtLink>
          </div>
        </section>
      </div>

      <div class="flex min-w-0 flex-col gap-6 max-xl:contents">
        <!-- Worth a minute -->
        <section aria-labelledby="home-chores" class="max-xl:order-1">
          <h2 id="home-chores" class="mb-1.5 flex h-7 items-center text-[13px] font-semibold text-foreground/80">
            {{ t("shell.home.worth_a_minute") }}
          </h2>
          <p
            v-if="chores.length === 0"
            class="flex items-center gap-2.5 rounded-[10px] border border-dashed border-input p-4 text-sm text-muted-foreground"
          >
            <CircleCheckBig class="size-4 shrink-0 text-primary" aria-hidden="true" />
            {{ t("shell.home.all_caught_up") }}
          </p>
          <div v-else class="divide-y divide-border/70 overflow-hidden rounded-[10px] border border-border">
            <NuxtLink
              v-for="chore in chores"
              :key="chore.key"
              :to="chore.to"
              class="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40"
            >
              <span
                class="flex size-[30px] shrink-0 items-center justify-center rounded-lg"
                :class="
                  chore.tone === 'warn'
                    ? 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                    : 'bg-muted text-primary'
                "
                aria-hidden="true"
              >
                <component :is="chore.icon" class="size-[15px]" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col gap-px">
                <span class="font-medium">{{ chore.label }}</span>
                <span v-if="chore.hint" class="truncate text-xs text-muted-foreground">{{ chore.hint }}</span>
              </span>
              <b
                class="font-semibold tabular-nums"
                :class="{ 'text-orange-800 dark:text-orange-300': chore.tone === 'warn' }"
              >
                {{ chore.count }}
              </b>
              <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </NuxtLink>
          </div>
        </section>

        <!-- Places -->
        <section v-if="topPlaces.length" aria-labelledby="home-places" class="max-xl:order-3">
          <div class="mb-1.5 flex h-7 items-center justify-between">
            <h2 id="home-places" class="text-[13px] font-semibold text-foreground/80">
              {{ t("shell.home.places") }}
            </h2>
            <NuxtLink to="/locations" class="text-xs text-muted-foreground hover:text-foreground">
              {{ t("shell.home.view_all") }}
            </NuxtLink>
          </div>
          <div class="flex flex-col gap-0.5">
            <NuxtLink
              v-for="place in topPlaces"
              :key="place.id"
              :to="`/locations?place=${place.id}`"
              class="flex h-12 items-center gap-2.5 rounded-[9px] bg-muted/50 px-2.5 text-sm hover:bg-muted"
            >
              <House class="size-[15px] shrink-0 text-primary" aria-hidden="true" />
              <span class="flex min-w-0 flex-1 flex-col gap-px">
                <span class="truncate font-medium">{{ place.name }}</span>
                <span class="text-xs text-muted-foreground">{{
                  t("shell.home.places_inside", { n: place.inside })
                }}</span>
              </span>
              <span class="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                {{ t("shell.home.items_count", { n: place.items }) }}
              </span>
            </NuxtLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
