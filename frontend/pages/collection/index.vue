<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import {
    Archive,
    ArrowDownUp,
    Bell,
    ChevronLeft,
    Printer,
    Shapes,
    SlidersHorizontal,
    Ticket,
    Users,
    Wrench,
  } from "@lucide/vue";
  import type { Component } from "vue";
  import { useEntityTypeStore } from "~/stores/entityTypes";

  /**
   * Collection settings in two panes: a grouped nav of sections on the left,
   * the open section on the right. On phones `/collection` is the nav alone and
   * each section opens full screen with a way back.
   */
  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  const route = useRoute();
  const entityTypeStore = useEntityTypeStore();
  const { collection, group, members } = useCollectionSettingsData();

  onMounted(() => entityTypeStore.refresh());

  type Link = { to: string; label: string; icon: Component; count?: number };

  const groups = computed<{ label: string; links: Link[] }[]>(() => [
    {
      label: t("collection.settings.groups.collection"),
      links: [
        { to: "/collection/settings", label: t("collection.settings.nav.general"), icon: SlidersHorizontal },
        {
          to: "/collection/members",
          label: t("collection.settings.nav.members"),
          icon: Users,
          count: members.data.value.length || undefined,
        },
        { to: "/collection/invites", label: t("collection.settings.nav.invites"), icon: Ticket },
        { to: "/collection/notifiers", label: t("collection.settings.nav.notifiers"), icon: Bell },
      ],
    },
    {
      label: t("collection.settings.groups.inventory"),
      links: [
        {
          to: "/collection/entity-types",
          label: t("collection.settings.nav.entity_types"),
          icon: Shapes,
          count: entityTypeStore.allTypes.length || undefined,
        },
        { to: "/collection/labels", label: t("collection.settings.nav.labels"), icon: Printer },
      ],
    },
    {
      label: t("collection.settings.groups.data"),
      links: [
        { to: "/collection/data", label: t("collection.settings.nav.data"), icon: ArrowDownUp },
        { to: "/collection/backups", label: t("collection.settings.nav.backups"), icon: Archive },
        { to: "/collection/actions", label: t("collection.settings.nav.actions"), icon: Wrench },
      ],
    },
  ]);

  const isIndex = computed(() => route.path.replace(/\/$/, "") === "/collection");
  const current = computed(() => groups.value.flatMap(g => g.links).find(l => route.path.startsWith(l.to)));

  usePageHeader(() => [
    { label: t("shell.collection_settings"), to: current.value ? "/collection" : undefined },
    ...(current.value ? [{ label: current.value.label }] : []),
  ]);
  useHead({ title: () => `HomeBox | ${current.value?.label ?? t("shell.collection_settings")}` });

  const name = computed(() => group.data.value?.name ?? collection.value?.name ?? "");
  const initial = computed(() => name.value.trim().charAt(0).toUpperCase() || "?");
</script>

<template>
  <div class="grid flex-1 md:grid-cols-[15.5rem_minmax(0,1fr)]">
    <!-- Sections -->
    <aside
      class="border-border/70 bg-muted/30 md:border-r"
      :class="{ 'max-md:hidden': !isIndex }"
      :aria-label="t('shell.collection_settings')"
    >
      <nav class="flex flex-col p-3 md:sticky md:top-(--header-height)">
        <div class="flex items-center gap-3 px-2.5 py-2">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-base font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {{ initial }}
          </span>
          <span class="flex min-w-0 flex-col leading-tight">
            <span class="truncate text-[15px] font-semibold">{{ name || t("global.loading") }}</span>
            <span class="truncate text-[12.5px] text-muted-foreground">
              <template v-if="members.data.value.length">
                {{ t("collection.settings.members_count", { n: members.data.value.length }) }}
              </template>
              <template v-if="members.data.value.length && group.data.value"> · </template>
              <template v-if="group.data.value">{{ group.data.value.currency }}</template>
            </span>
          </span>
        </div>

        <template v-for="g in groups" :key="g.label">
          <div class="px-2.5 pt-4 pb-1.5 text-xs font-medium text-muted-foreground">{{ g.label }}</div>
          <div class="flex flex-col gap-0.5 max-md:overflow-hidden max-md:rounded-xl max-md:border max-md:bg-card">
            <NuxtLink
              v-for="l in g.links"
              :key="l.to"
              :to="l.to"
              class="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-foreground transition-colors hover:bg-muted max-md:h-12 max-md:rounded-none max-md:text-[15px] max-md:not-last:border-b"
              active-class="bg-accent! font-medium text-accent-foreground!"
            >
              <component :is="l.icon" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span class="truncate">{{ l.label }}</span>
              <span v-if="l.count" class="ml-auto text-xs text-muted-foreground tabular-nums">{{ l.count }}</span>
            </NuxtLink>
          </div>
        </template>
      </nav>
    </aside>

    <!-- Open section -->
    <main class="min-w-0 px-4 pt-6 pb-24 sm:px-8 md:pt-10 lg:px-12" :class="{ 'max-md:hidden': isIndex }">
      <div class="mx-auto max-w-190">
        <NuxtLink
          to="/collection"
          class="mb-4 -ml-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground md:hidden"
        >
          <ChevronLeft class="size-4" aria-hidden="true" />
          {{ t("collection.settings.back") }}
        </NuxtLink>
        <NuxtPage />
      </div>
    </main>
  </div>
</template>
