<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useQuery } from "@tanstack/vue-query";
  import { MaintenanceFilterStatus } from "~/lib/api/types/data-contracts";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import Currency from "~/components/global/Currency.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t, locale } = useI18n();
  useHead({ title: () => `HomeBox | ${t("menu.home")}` });

  const api = useUserApi();
  const preferences = useViewPreferences();
  const entityTypeStore = useEntityTypeStore();

  const collection = computed(() => preferences.value.collectionId);
  const itemTypeIds = computed(() => entityTypeStore.itemTypes.map(et => et.id));
  const hasItemTypes = computed(() => itemTypeIds.value.length > 0);

  // Same key as the sidebar counts, so both share one request.
  const { data: stats } = useQuery({
    queryKey: computed(() => ["stats", collection.value]),
    queryFn: async () => (await api.stats.group()).data,
  });

  const { data: recent } = useQuery({
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

  const { data: places } = useQuery({
    queryKey: computed(() => ["entities", "places", collection.value]),
    queryFn: async () => {
      const { data, error } = await api.items.getLocations({ filterChildren: false });
      if (error) throw new Error("Failed to load places");
      return data;
    },
  });

  const maintenanceCounts = computed(() => {
    const now = Date.now();
    const soon = now + 30 * 24 * 60 * 60 * 1000;
    let overdue = 0;
    let upcoming = 0;
    for (const entry of scheduled.value ?? []) {
      const due = new Date(entry.scheduledDate).getTime();
      if (Number.isNaN(due)) continue;
      if (due < now) overdue++;
      else if (due < soon) upcoming++;
    }
    return { overdue, upcoming };
  });

  /** "Nov 7" style dates, like the design's activity list. */
  function shortDate(value: Date | string) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale.value, { month: "short", day: "numeric" });
  }

  /** Places with nothing in them and no places inside them. */
  const emptyPlaces = computed(() => {
    const all = places.value ?? [];
    const hasChildren = new Set(all.map(p => p.parent?.id).filter(Boolean));
    return all.filter(p => !p.itemCount && !hasChildren.has(p.id)).length;
  });

  type Chore = { key: string; count: number; label: string; to: string; tone?: "warn" };
  const chores = computed<Chore[]>(() =>
    [
      {
        key: "overdue",
        count: maintenanceCounts.value.overdue,
        label: t("shell.home.chore_overdue"),
        to: "/maintenance",
        tone: "warn" as const,
      },
      {
        key: "upcoming",
        count: maintenanceCounts.value.upcoming,
        label: t("shell.home.chore_upcoming"),
        to: "/maintenance",
      },
      {
        key: "photo",
        count: withoutPhoto.value ?? 0,
        label: t("shell.home.chore_photo"),
        to: "/items?photo=without",
      },
      {
        key: "empty",
        count: emptyPlaces.value,
        label: t("shell.home.chore_empty_places"),
        to: "/locations",
      },
    ].filter(c => c.count > 0)
  );
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Totals in one line, as in the design -->
    <p
      class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 text-[13px] text-muted-foreground"
      :aria-label="t('home.quick_statistics')"
    >
      <span>
        <b class="font-semibold text-foreground tabular-nums">{{ stats?.totalItems ?? 0 }}</b>
        {{ t("shell.home.stat_items", { n: stats?.totalItems ?? 0 }) }}
      </span>
      <span>
        <b class="font-semibold text-foreground tabular-nums">{{ stats?.totalLocations ?? 0 }}</b>
        {{ t("shell.home.stat_places", { n: stats?.totalLocations ?? 0 }) }}
      </span>
      <span>
        <b class="font-semibold text-foreground tabular-nums"><Currency :amount="stats?.totalItemPrice ?? 0" /></b>
        {{ t("shell.home.stat_total") }}
      </span>
      <span>
        <b class="font-semibold text-foreground tabular-nums">{{ stats?.totalTags ?? 0 }}</b>
        {{ t("shell.home.stat_tags", { n: stats?.totalTags ?? 0 }) }}
      </span>
    </p>

    <div class="flex flex-1 flex-wrap">
      <!-- Recently added, styled like the design's activity list -->
      <section class="min-w-0 flex-[3_1_520px] border-border lg:border-r">
        <div class="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h2 class="text-[13px] font-semibold text-foreground/80">{{ t("home.recently_added") }}</h2>
          <NuxtLink to="/items" class="text-xs text-muted-foreground hover:text-foreground">
            {{ t("shell.home.view_all") }}
          </NuxtLink>
        </div>
        <p v-if="recent && recent.length === 0" class="px-4 py-6 text-sm text-muted-foreground">
          {{ t("items.no_results") }}
        </p>
        <NuxtLink
          v-for="item in recent"
          :key="item.id"
          :to="`/item/${item.id}`"
          class="flex h-10 items-center gap-3 border-b border-border/70 px-4 text-sm hover:bg-muted/40"
        >
          <span class="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">
            <i18n-t v-if="item.parent" keypath="shell.home.added_to" scope="global">
              <template #name
                ><b class="font-semibold">{{ item.name }}</b></template
              >
              <template #place>{{ item.parent.name }}</template>
            </i18n-t>
            <i18n-t v-else keypath="shell.home.added" scope="global">
              <template #name
                ><b class="font-semibold">{{ item.name }}</b></template
              >
            </i18n-t>
          </span>
          <span class="shrink-0 text-xs text-muted-foreground">{{ shortDate(item.createdAt) }}</span>
        </NuxtLink>
      </section>

      <!-- Worth a minute -->
      <aside class="flex min-w-0 flex-[2_1_300px] flex-col gap-2.5 px-4 py-3.5">
        <h2 class="text-[13px] font-semibold text-foreground/80">{{ t("shell.home.worth_a_minute") }}</h2>
        <p v-if="chores.length === 0" class="text-sm text-muted-foreground">{{ t("shell.home.all_caught_up") }}</p>
        <NuxtLink
          v-for="chore in chores"
          :key="chore.key"
          :to="chore.to"
          class="flex items-center justify-between gap-3 rounded-[9px] border border-border/70 px-3 py-2.5 text-sm hover:bg-muted/40"
        >
          <span>{{ chore.label }}</span>
          <b class="font-semibold tabular-nums" :class="{ 'text-destructive': chore.tone === 'warn' }">
            {{ chore.count }}
          </b>
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>
