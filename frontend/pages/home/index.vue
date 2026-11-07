<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useQuery } from "@tanstack/vue-query";
  import { ArrowRight, CalendarClock, ImageOff, MapPin, Search, Wrench } from "@lucide/vue";
  import type { Component } from "vue";
  import { MaintenanceFilterStatus } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { useTagStore } from "~/stores/tags";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import Currency from "~/components/global/Currency.vue";
  import DateTime from "~/components/global/DateTime.vue";
  import TagChip from "~/components/Tag/Chip.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("menu.home")}` });

  const api = useUserApi();
  const auth = useAuthContext();
  const preferences = useViewPreferences();
  const { openDialog } = useDialog();
  const entityTypeStore = useEntityTypeStore();
  const tagStore = useTagStore();

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

  /** Places with nothing in them and no places inside them. */
  const emptyPlaces = computed(() => {
    const all = places.value ?? [];
    const hasChildren = new Set(all.map(p => p.parent?.id).filter(Boolean));
    return all.filter(p => !p.itemCount && !hasChildren.has(p.id)).length;
  });

  type Chore = { key: string; count: number; label: string; to: string; icon: Component; tone?: "warn" };
  const chores = computed<Chore[]>(() =>
    [
      {
        key: "overdue",
        count: maintenanceCounts.value.overdue,
        label: t("shell.home.chore_overdue", { n: maintenanceCounts.value.overdue }),
        to: "/maintenance",
        icon: Wrench,
        tone: "warn" as const,
      },
      {
        key: "upcoming",
        count: maintenanceCounts.value.upcoming,
        label: t("shell.home.chore_upcoming", { n: maintenanceCounts.value.upcoming }),
        to: "/maintenance",
        icon: CalendarClock,
      },
      {
        key: "photo",
        count: withoutPhoto.value ?? 0,
        label: t("shell.home.chore_photo", { n: withoutPhoto.value ?? 0 }),
        to: "/items?photo=without",
        icon: ImageOff,
      },
      {
        key: "empty",
        count: emptyPlaces.value,
        label: t("shell.home.chore_empty_places", { n: emptyPlaces.value }),
        to: "/locations",
        icon: MapPin,
      },
    ].filter(c => c.count > 0)
  );

  const topPlaces = computed(() =>
    (places.value ?? [])
      .filter(p => !p.parent)
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 8)
  );

  const statCells = computed(() => [
    { key: "value", label: t("home.total_value"), value: stats.value?.totalItemPrice ?? 0, currency: true },
    { key: "items", label: t("home.total_items"), value: stats.value?.totalItems ?? 0 },
    { key: "places", label: t("home.total_locations"), value: stats.value?.totalLocations ?? 0 },
    { key: "tags", label: t("home.total_tags"), value: stats.value?.totalTags ?? 0 },
  ]);

  const firstName = computed(() => auth.user?.name?.split(" ")[0] ?? "");
</script>

<template>
  <div class="flex flex-col">
    <!-- Find or add: the fastest way to do almost anything -->
    <section class="border-b border-border px-4 py-6 sm:p-8">
      <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
        {{ firstName ? t("shell.home.welcome", { name: firstName }) : t("menu.home") }}
      </h1>
      <button
        type="button"
        class="mt-4 flex h-11 w-full max-w-2xl items-center gap-2.5 rounded-lg border border-input bg-background px-3 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:border-ring/60 hover:text-foreground"
        @click="openDialog(DialogID.CommandPalette)"
      >
        <Search class="size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ t("shell.palette.placeholder") }}</span>
        <ShortcutHint :hotkey="SHORTCUTS.commandPalette" class="ml-auto max-sm:hidden" />
      </button>
    </section>

    <!-- Totals -->
    <section class="grid grid-cols-2 border-b border-border md:grid-cols-4" :aria-label="t('home.quick_statistics')">
      <div
        v-for="(cell, i) in statCells"
        :key="cell.key"
        class="border-border p-4 sm:px-8"
        :class="{ 'border-r': i % 2 === 0 || i < 3, 'max-md:border-b': i < 2, 'md:border-r-0': i === 3 }"
      >
        <p class="text-xs text-muted-foreground">{{ cell.label }}</p>
        <p class="mt-1 text-xl font-semibold tracking-tight tabular-nums">
          <Currency v-if="cell.currency" :amount="cell.value" />
          <template v-else>{{ cell.value }}</template>
        </p>
      </div>
    </section>

    <div class="grid flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <!-- Recently added -->
      <section class="min-w-0 px-4 py-5 sm:px-8">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium">{{ t("home.recently_added") }}</h2>
          <NuxtLink
            to="/items"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {{ t("shell.home.view_all") }}
            <ArrowRight class="size-3.5" />
          </NuxtLink>
        </div>
        <p v-if="recent && recent.length === 0" class="py-6 text-sm text-muted-foreground">
          {{ t("items.no_results") }}
        </p>
        <ul v-else class="divide-y divide-border/60 border-y border-border/60">
          <li v-for="item in recent" :key="item.id">
            <NuxtLink
              :to="`/item/${item.id}`"
              class="-mx-2 flex h-11 items-center gap-3 rounded-md px-2 text-sm hover:bg-muted/50"
            >
              <span class="min-w-0 flex-1 truncate font-medium">{{ item.name }}</span>
              <span v-if="item.parent" class="hidden max-w-40 truncate text-muted-foreground sm:inline">
                {{ item.parent.name }}
              </span>
              <span class="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                <DateTime :date="item.createdAt" format="long" />
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Worth a minute, places, tags -->
      <aside class="space-y-6 border-t border-border px-4 py-5 sm:px-8 lg:border-t-0 lg:border-l lg:px-5">
        <section>
          <h2 class="mb-2 text-sm font-medium">{{ t("shell.home.worth_a_minute") }}</h2>
          <p v-if="chores.length === 0" class="text-sm text-muted-foreground">{{ t("shell.home.all_caught_up") }}</p>
          <ul v-else class="space-y-1.5">
            <li v-for="chore in chores" :key="chore.key">
              <NuxtLink
                :to="chore.to"
                class="group flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted/50"
              >
                <component
                  :is="chore.icon"
                  class="size-4 shrink-0"
                  :class="chore.tone === 'warn' ? 'text-destructive' : 'text-muted-foreground'"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1">{{ chore.label }}</span>
                <ArrowRight
                  class="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section v-if="topPlaces.length">
          <h2 class="mb-2 text-sm font-medium">{{ t("shell.places") }}</h2>
          <div class="flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="place in topPlaces"
              :key="place.id"
              :to="`/locations?place=${place.id}`"
              class="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-muted/50"
            >
              <MapPin class="size-3 text-muted-foreground" aria-hidden="true" />
              {{ place.name }}
              <span class="text-muted-foreground tabular-nums">{{ place.itemCount }}</span>
            </NuxtLink>
          </div>
        </section>

        <section v-if="tagStore.tags.length">
          <h2 class="mb-2 text-sm font-medium">{{ t("global.tags") }}</h2>
          <div class="flex flex-wrap gap-1.5">
            <TagChip v-for="tag in tagStore.tags" :key="tag.id" :tag="tag" size="sm" />
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
