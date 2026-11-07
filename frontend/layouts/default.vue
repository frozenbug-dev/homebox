<template>
  <div id="app">
    <!--
    Confirmation Modal is a singleton used by all components so we render
    it here to ensure it's always available. Possibly could move this further
    up the tree
    -->
    <ModalConfirm />
    <OutdatedModal v-if="status" :status="status" />
    <EntityCreateModal />
    <WipeInventoryDialog />
    <TagCreateModal />
    <LabelTemplatePrintDialog />
    <ItemBarcodeModal />
    <ItemChangeDetailsDialog />
    <AppCommandPalette @scan="openScanner" />
    <AppShortcutsDialog />
    <AppScannerModal />
    <CollectionCreateModal />
    <CollectionJoinModal />
    <CollectionInviteCreateModal />
    <SidebarProvider :default-open="sidebarState">
      <Sidebar collapsible="icon" class="border-r-0">
        <SidebarHeader class="gap-2 p-2.5 pb-2">
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <CollectionSelector />
            </div>
          </div>
          <div class="flex gap-1.5 group-data-[collapsible=icon]:flex-col">
            <SidebarMenuButton
              class="h-9 flex-1 justify-start rounded-[9px] border border-border bg-background text-[13px] text-muted-foreground hover:bg-background hover:text-foreground"
              :tooltip="$t('shell.search_or_add')"
              @click="openDialog(DialogID.CommandPalette)"
            >
              <Search />
              <span>{{ $t("shell.search_or_add") }}</span>
              <ShortcutHint :hotkey="SHORTCUTS.commandPalette" class="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
            <SidebarMenuButton
              class="size-9 shrink-0 justify-center bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              :tooltip="$t('shell.new_item')"
              :aria-label="$t('shell.new_item')"
              @click="openDialog(DialogID.CreateEntity, { params: { baseType: 'item' } })"
            >
              <Plus />
            </SidebarMenuButton>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup class="py-1">
            <SidebarMenu class="gap-0.5">
              <SidebarMenuItem v-for="n in nav" :key="n.id">
                <SidebarMenuLink
                  :href="n.to"
                  :class="{
                    'bg-sidebar-accent font-medium text-sidebar-accent-foreground': n.active.value,
                    'text-nowrap': typeof locale === 'string' && locale.startsWith('zh-'),
                  }"
                  :aria-current="n.active.value ? 'page' : undefined"
                  :tooltip="n.name.value"
                >
                  <component :is="n.icon" />
                  <span>{{ n.name.value }}</span>
                  <span class="ml-auto flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                    <ShortcutHint
                      v-if="n.hotkey"
                      :hotkey="n.hotkey"
                      class="opacity-0 transition-opacity group-hover/menu-item:opacity-100"
                    />
                    <span v-if="n.count?.value !== undefined" class="text-xs text-muted-foreground tabular-nums">
                      {{ n.count.value }}
                    </span>
                  </span>
                </SidebarMenuLink>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup v-if="topPlaces.length" class="py-1 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>{{ $t("shell.places") }}</SidebarGroupLabel>
            <SidebarMenu class="gap-0.5">
              <SidebarMenuItem v-for="place in topPlaces" :key="place.id">
                <SidebarMenuLink
                  :href="`/locations?place=${place.id}`"
                  :class="{
                    'bg-sidebar-accent font-medium text-sidebar-accent-foreground':
                      route.path === '/locations' && route.query.place === place.id,
                  }"
                >
                  <MapPin class="text-muted-foreground" />
                  <span>{{ place.name }}</span>
                  <span v-if="place.itemCount" class="ml-auto text-xs text-muted-foreground tabular-nums">
                    {{ place.itemCount }}
                  </span>
                </SidebarMenuLink>
              </SidebarMenuItem>
              <SidebarMenuItem v-if="allPlacesCount > topPlaces.length">
                <SidebarMenuLink href="/locations" class="text-muted-foreground">
                  <span class="pl-[26px]">{{ $t("shell.all_places", { count: allPlacesCount }) }}</span>
                </SidebarMenuLink>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter class="gap-1 p-3">
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuLink
                href="/collection/members"
                :class="{
                  'bg-sidebar-accent font-medium text-sidebar-accent-foreground': route.path.startsWith('/collection'),
                }"
                :tooltip="$t('shell.collection_settings')"
              >
                <Settings />
                <span>{{ $t("shell.collection_settings") }}</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton :tooltip="$t('shell.keyboard_shortcuts')" @click="openDialog(DialogID.Shortcuts)">
                <Keyboard />
                <span>{{ $t("shell.keyboard_shortcuts") }}</span>
                <ShortcutHint :hotkey="SHORTCUTS.help" class="ml-auto group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenu class="mt-1 border-t border-sidebar-border pt-2">
            <SidebarMenuItem class="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
              <SidebarMenuLink
                href="/profile"
                class="h-11 min-w-0 flex-1"
                :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground': route.path === '/profile' }"
                :tooltip="$t('profile.user_profile')"
              >
                <span
                  data-sidebar-icon
                  class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                  aria-hidden="true"
                >
                  {{ username.charAt(0).toUpperCase() }}
                </span>
                <span class="flex min-w-0 flex-col leading-tight">
                  <span class="truncate font-medium">{{ username }}</span>
                  <span v-if="email" class="truncate text-xs text-muted-foreground">{{ email }}</span>
                </span>
              </SidebarMenuLink>
              <SidebarMenuButton
                class="size-9 shrink-0 justify-center text-muted-foreground"
                :tooltip="$t('global.sign_out')"
                :aria-label="$t('global.sign_out')"
                data-testid="logout-button"
                @click="logout"
              >
                <LogOut />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset class="min-h-dvh max-w-full min-w-0 bg-sidebar md:p-2 md:pl-0">
        <!-- The page lives in one bordered panel; its header stays at the top while the page scrolls. -->
        <div
          class="relative flex min-h-dvh flex-col overflow-clip bg-background md:min-h-[calc(100dvh-1rem)] md:rounded-xl md:border md:border-border md:shadow-xs"
        >
          <!-- IMPORTANT: if you change the height of this header, update --header-height(-mobile) in main.css;
               the item and location edit pages offset their sticky bars by it -->
          <header
            class="sticky top-0 z-20 flex h-(--header-height-mobile) items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur-sm sm:h-(--header-height) sm:gap-3 sm:px-4"
          >
            <SidebarTrigger variant="ghost" class="text-muted-foreground" />
            <nav aria-label="Breadcrumb" class="flex min-w-0 shrink items-center gap-2 text-sm">
              <template v-for="(crumb, i) in pageHeader.crumbs" :key="i">
                <NuxtLink v-if="crumb.to" :to="crumb.to" class="shrink-0 text-muted-foreground hover:text-foreground">
                  {{ crumb.label }}
                </NuxtLink>
                <span v-else class="truncate font-medium" aria-current="page">{{ crumb.label }}</span>
                <span v-if="i < pageHeader.crumbs.length - 1" class="text-border" aria-hidden="true">/</span>
              </template>
            </nav>
            <button
              type="button"
              class="mx-auto hidden h-[34px] w-full max-w-140 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground md:flex"
              @click="openDialog(DialogID.CommandPalette)"
            >
              <Search class="size-4 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ $t("shell.palette.placeholder") }}</span>
              <ShortcutHint :hotkey="SHORTCUTS.commandPalette" class="ml-auto" />
            </button>
            <div class="flex-1 md:hidden" />
            <Button
              variant="ghost"
              size="icon"
              class="md:hidden"
              :aria-label="$t('shell.search_or_add')"
              @click="openDialog(DialogID.CommandPalette)"
            >
              <Search />
            </Button>
            <!-- Pages put their own actions here (see components/App/HeaderActions.vue) -->
            <div id="page-header-actions" class="flex shrink-0 items-center gap-1.5 empty:hidden" />
            <template v-if="!hasPageActions">
              <Button
                variant="outline"
                size="sm"
                class="h-[30px] text-[13px]"
                :aria-label="$t('shell.scan')"
                @click="openScanner"
              >
                <ScanQrCode />
                <span class="hidden lg:inline">{{ $t("shell.scan") }}</span>
                <ShortcutHint :hotkey="SHORTCUTS.scan" class="hidden lg:inline-flex" />
              </Button>
              <Button
                size="sm"
                class="h-[30px] text-[13px]"
                @click="openDialog(DialogID.CreateEntity, { params: { baseType: 'item' } })"
              >
                <Plus />
                <span class="hidden sm:inline">{{ $t("shell.new_item") }}</span>
                <ShortcutHint
                  :hotkey="SHORTCUTS.newItem"
                  class="hidden lg:inline-flex [&_kbd]:border-primary-foreground/20 [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground"
                />
              </Button>
            </template>
          </header>

          <div v-if="preferences.displayLegacyHeader">
            <AppHeaderDecor class="-mt-10 hidden lg:block" />
          </div>

          <!-- Pages fill the panel (flex-1 on their root) and the footer stays at the bottom -->
          <div class="flex flex-1 flex-col">
            <slot />
          </div>

          <footer v-if="status" class="w-full pb-4 text-center">
            <p class="text-center text-xs text-muted-foreground">
              <span
                v-html="
                  DOMPurify.sanitize(
                    $t('global.footer.version_link', {
                      version: status.build.version.replace(/^v/, ''),
                      build: status.build.commit,
                    })
                  )
                "
              />
              ~
              <span v-html="DOMPurify.sanitize($t('global.footer.api_link'))" />
            </p>
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>

<script lang="ts" setup>
  import { useI18n } from "vue-i18n";
  import DOMPurify from "dompurify";
  import { useQuery, useQueryClient } from "@tanstack/vue-query";
  import type { RegisterableHotkey } from "@tanstack/vue-hotkeys";
  import {
    FileText,
    House,
    Keyboard,
    LogOut,
    MapPin,
    Package,
    Plus,
    Printer,
    ScanQrCode,
    Search,
    Settings,
    Tags,
    Wrench,
  } from "@lucide/vue";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import { useEntityTypeStore } from "~~/stores/entityTypes";
  import { SHORTCUTS } from "~/lib/shortcuts";

  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuLink,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
  } from "@/components/ui/sidebar";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { Button } from "~/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import ModalConfirm from "~/components/ModalConfirm.vue";
  import OutdatedModal from "~/components/App/OutdatedModal.vue";
  import EntityCreateModal from "~/components/Entity/CreateModal.vue";
  import WipeInventoryDialog from "~/components/WipeInventoryDialog.vue";
  import TagCreateModal from "~/components/Tag/CreateModal.vue";
  import LabelTemplatePrintDialog from "~/components/LabelTemplate/PrintDialog.vue";
  import ItemBarcodeModal from "~/components/Item/BarcodeModal.vue";
  import ItemChangeDetailsDialog from "~/components/Item/ChangeDetailsDialog.vue";
  import AppCommandPalette from "~/components/App/CommandPalette.vue";
  import AppShortcutsDialog from "~/components/App/ShortcutsDialog.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import AppScannerModal from "~/components/App/ScannerModal.vue";
  import AppHeaderDecor from "~/components/App/HeaderDecor.vue";
  import CollectionSelector from "~/components/Collection/Selector.vue";
  import CollectionCreateModal from "~/components/Collection/CreateModal.vue";
  import CollectionJoinModal from "~/components/Collection/JoinModal.vue";
  import CollectionInviteCreateModal from "~/components/Collection/InviteCreateModal.vue";

  const { t, locale } = useI18n();
  const username = computed(() => authCtx.user?.name || "User");
  const email = computed(() => authCtx.user?.email || "");

  const { openDialog } = useDialog();

  const preferences = useViewPreferences();

  // get sidebar state from cookies
  const sidebarState = useCookie("sidebar:state", {
    readonly: true,
    decode: value => value !== "false",
  });

  const pubApi = usePublicApi();
  const { data: status } = useAsyncData(async () => {
    const { data } = await pubApi.status();

    return data;
  });

  const openScanner = () => {
    // request permission
    if (navigator.mediaDevices) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => {
          openDialog(DialogID.Scanner);
        })
        .catch(err => {
          console.error(err);
          toast.error(t("scanner.permission_denied"));
        });
    } else {
      toast.error(t("scanner.unsupported"));
    }
  };

  useGlobalShortcuts({ scan: openScanner });

  // Preload currency format
  useFormatCurrency();

  const route = useRoute();
  const router = useRouter();
  const api = useUserApi();

  const { data: stats } = useQuery({
    queryKey: computed(() => ["stats", preferences.value.collectionId]),
    queryFn: async () => (await api.stats.group()).data,
  });

  const pageHeader = usePageHeaderState();
  const hasPageActions = usePageHeaderActions();

  type NavItem = {
    icon: Component;
    active: ComputedRef<boolean>;
    id: string;
    name: ComputedRef<string>;
    to: string;
    count?: ComputedRef<number | undefined>;
    hotkey?: RegisterableHotkey;
  };

  const navItem = (
    id: string,
    icon: Component,
    name: () => string,
    to: string,
    opts: { isActive?: () => boolean; count?: () => number | undefined; hotkey?: RegisterableHotkey } = {}
  ): NavItem => ({
    hotkey: opts.hotkey,
    id,
    icon,
    name: computed(name),
    to,
    active: computed(opts.isActive ?? (() => route.path === to)),
    count: opts.count ? computed(opts.count) : undefined,
  });

  // Same order as the design; Templates sits at the end since the design has no slot for it.
  const nav: NavItem[] = [
    navItem("home", House, () => t("menu.home"), "/home", { hotkey: SHORTCUTS.goHome }),
    navItem("items", Package, () => t("shell.items"), "/items", {
      isActive: () => route.path === "/items" || route.path === "/search" || route.path.startsWith("/item/"),
      count: () => stats.value?.totalItems,
      hotkey: SHORTCUTS.goItems,
    }),
    navItem("places", MapPin, () => t("shell.places"), "/locations", {
      isActive: () => route.path === "/locations" || route.path.startsWith("/location/"),
      count: () => stats.value?.totalLocations,
      hotkey: SHORTCUTS.goPlaces,
    }),
    navItem("tags", Tags, () => t("global.tags"), "/tags", {
      isActive: () => route.path === "/tags" || route.path.startsWith("/tag/"),
      count: () => stats.value?.totalTags,
      hotkey: SHORTCUTS.goTags,
    }),
    navItem("maintenance", Wrench, () => t("menu.maintenance"), "/maintenance"),
    navItem("labels", Printer, () => t("shell.labels"), "/label-templates", {
      isActive: () => route.path.startsWith("/label-templates"),
    }),
    navItem("templates", FileText, () => t("menu.templates"), "/templates", {
      isActive: () => route.path === "/templates" || route.path.startsWith("/template/"),
    }),
  ];

  const tagStore = useTagStore();
  tagStore.ensureAllTagsFetched();

  const locationStore = useLocationStore();
  locationStore.ensureLocationsFetched();

  const entityTypeStore = useEntityTypeStore();
  entityTypeStore.ensureFetched();

  // The sidebar lists the busiest top-level places; the Places page has all of them.
  const allPlacesCount = computed(() => locationStore.parentLocations.length);
  const topPlaces = computed(() =>
    [...locationStore.parentLocations]
      .sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 6)
  );

  onMounted(() => {
    locationStore.refreshParents();
    locationStore.refreshTree();

    // Auto-open JoinModal when invitation token is in URL
    const token = route.query.token;
    if (typeof token === "string" && token.length > 0) {
      // Remove token from browser URL
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState(history.state, "", url.toString());

      // Sync router's state to clear route.query.token
      const { token: _, ...cleanQuery } = route.query;
      router.replace({ query: cleanQuery });

      openDialog(DialogID.JoinCollection, {
        params: { inviteCode: token },
      });
    }
  });

  // Keep TanStack Query caches in step with the server, like the stores below.
  const queryClient = useQueryClient();
  watch(
    () => preferences.value.collectionId,
    () => queryClient.clear()
  );

  onServerEvent(ServerEvent.TagMutation, () => {
    tagStore.refresh();
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  });

  onServerEvent(ServerEvent.EntityMutation, () => {
    locationStore.refreshChildren();
    locationStore.refreshParents();
    locationStore.refreshTree();
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  });

  const authCtx = useAuthContext();

  async function logout() {
    await authCtx.logout(api);
    navigateTo("/");
  }
</script>
