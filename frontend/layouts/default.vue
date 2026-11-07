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
    <AppQuickMenuModal :actions="quickMenuActions" />
    <AppScannerModal />
    <CollectionCreateModal />
    <CollectionJoinModal />
    <CollectionInviteCreateModal />
    <SidebarProvider :default-open="sidebarState">
      <Sidebar collapsible="icon">
        <SidebarHeader class="gap-3 p-3">
          <NuxtLink
            to="/home"
            class="flex h-10 items-center gap-2.5 rounded-lg px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <AppLogo class="size-8 shrink-0" />
            <span class="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">HomeBox</span>
          </NuxtLink>

          <CollectionSelector />

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                class="h-10 justify-center bg-primary font-medium text-primary-foreground shadow-xs group-data-[collapsible=icon]:justify-start hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground data-[state=open]:bg-primary/90 data-[state=open]:text-primary-foreground data-[state=open]:hover:bg-primary/90 data-[state=open]:hover:text-primary-foreground"
                :tooltip="$t('global.create')"
                hotkey="Shortcut: Ctrl+`"
              >
                <Plus />
                <span>
                  {{ $t("global.create") }}
                </span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="z-40 min-w-(--reka-dropdown-menu-trigger-width)">
              <DropdownMenuItem
                v-for="btn in dropdown"
                :key="btn.id"
                class="group cursor-pointer"
                @click="
                  () => {
                    if (btn.dialogId === DialogID.CreateEntity) {
                      if (btn.id == 0)
                        // create item
                        openDialog(btn.dialogId, { params: { baseType: 'item' } });
                      else if (btn.id == 1)
                        // create location
                        openDialog(btn.dialogId, { params: { baseType: 'location' } });
                    } else {
                      openDialog(btn.dialogId as NoParamDialogIDs);
                    }
                  }
                "
              >
                {{ btn.name.value }}
                <Shortcut
                  v-if="btn.shortcut"
                  class="invisible ml-auto group-hover:visible"
                  :keys="btn.shortcut.replace('Shift', '⇧').split('+')"
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup v-for="group in navGroups" :key="group.id" class="py-1">
            <SidebarGroupLabel v-if="group.label">{{ group.label.value }}</SidebarGroupLabel>
            <SidebarMenu class="gap-0.5">
              <SidebarMenuItem v-for="n in group.items" :key="n.id">
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
                </SidebarMenuLink>
              </SidebarMenuItem>

              <!-- makes scanner accessible easily if using legacy header -->
              <SidebarMenuItem v-if="group.id === 'main' && preferences.displayLegacyHeader">
                <SidebarMenuButton
                  :class="{
                    'text-nowrap': typeof locale === 'string' && locale.startsWith('zh-'),
                  }"
                  :tooltip="$t('menu.scanner')"
                  @click.prevent="openDialog(DialogID.Scanner)"
                >
                  <ScanQrCode />
                  <span>{{ $t("menu.scanner") }}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter class="border-t border-sidebar-border p-3">
          <SidebarMenu>
            <SidebarMenuItem class="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
              <SidebarMenuLink
                href="/profile"
                class="h-12 min-w-0 flex-1"
                :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground': route.path === '/profile' }"
                :tooltip="$t('profile.user_profile')"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
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
      <SidebarInset class="min-h-dvh max-w-full overflow-hidden bg-background-accent">
        <div class="relative flex h-full flex-col justify-center">
          <div v-if="preferences.displayLegacyHeader">
            <AppHeaderDecor class="-mt-10 hidden lg:block" />
            <SidebarTrigger class="absolute top-2 left-2 hidden lg:flex" variant="default" />
          </div>
          <!-- IMPORTANT: if you change the height of this header, update --header-height(-mobile) in main.css;
               the item and location edit pages offset their sticky bars by it -->
          <header
            class="sticky top-0 z-20 flex h-(--header-height-mobile) flex-col gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-sm sm:h-(--header-height) sm:flex-row sm:items-center sm:gap-3 sm:px-6 sm:py-0"
            :class="{
              'lg:hidden': preferences.displayLegacyHeader,
            }"
          >
            <div class="flex items-center gap-2">
              <SidebarTrigger variant="ghost" class="text-muted-foreground" />
              <NuxtLink to="/home" class="flex items-center gap-2 sm:hidden">
                <AppLogo class="size-7" />
                <span class="font-semibold tracking-tight">HomeBox</span>
              </NuxtLink>
              <div class="grow sm:hidden" />
              <Button
                variant="outline"
                size="icon"
                class="sm:hidden"
                :aria-label="$t('menu.scanner')"
                @click="openScanner"
              >
                <ScanQrCode />
              </Button>
            </div>
            <div class="hidden grow sm:block" />
            <form class="relative flex w-full items-center sm:max-w-sm" role="search" @submit.prevent="triggerSearch">
              <Search class="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
              <Input
                ref="searchInput"
                v-model:model-value="search"
                class="h-9 w-full bg-background-accent/60 pr-14 pl-9"
                :placeholder="$t('global.search')"
                :aria-label="$t('global.search')"
                type="search"
              />
              <kbd
                class="pointer-events-none absolute right-2 hidden rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline-block"
                aria-hidden="true"
                >{{ searchShortcutLabel }}</kbd
              >
            </form>
            <Button
              variant="outline"
              size="icon"
              class="hidden sm:inline-flex"
              :aria-label="$t('menu.scanner')"
              @click="openScanner"
            >
              <ScanQrCode />
            </Button>
          </header>

          <slot />
          <div class="grow" />

          <footer v-if="status" class="bottom-0 w-full pb-4 text-center">
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
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import { useEntityTypeStore } from "~~/stores/entityTypes";

  import {
    Bell,
    FileText,
    Hammer,
    House,
    LogOut,
    MapPin,
    Plus,
    Printer,
    ScanQrCode,
    Search,
    Settings,
    Shapes,
    Tags,
    UserPlus,
    Users,
    Wrench,
  } from "@lucide/vue";

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
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Shortcut } from "~/components/ui/shortcut";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { Input } from "~/components/ui/input";
  import { Button } from "~/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { DialogID, type NoParamDialogIDs } from "~/components/ui/dialog-provider/utils";
  import ModalConfirm from "~/components/ModalConfirm.vue";
  import OutdatedModal from "~/components/App/OutdatedModal.vue";
  import EntityCreateModal from "~/components/Entity/CreateModal.vue";
  import WipeInventoryDialog from "~/components/WipeInventoryDialog.vue";
  import TagCreateModal from "~/components/Tag/CreateModal.vue";
  import LabelTemplatePrintDialog from "~/components/LabelTemplate/PrintDialog.vue";
  import ItemBarcodeModal from "~/components/Item/BarcodeModal.vue";
  import AppQuickMenuModal from "~/components/App/QuickMenuModal.vue";
  import AppScannerModal from "~/components/App/ScannerModal.vue";
  import AppLogo from "~/components/App/Logo.vue";
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

  const search = ref("");
  const searchInput = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);

  // Ctrl/⌘+K focuses the header search from anywhere.
  const searchShortcutLabel = ref("Ctrl K");
  function focusSearch(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const target = searchInput.value;
      const el = target instanceof HTMLElement ? target : target?.$el;
      (el?.tagName === "INPUT" ? el : el?.querySelector("input"))?.focus();
    }
  }
  onMounted(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) searchShortcutLabel.value = "⌘K";
    window.addEventListener("keydown", focusSearch);
  });
  onBeforeUnmount(() => window.removeEventListener("keydown", focusSearch));

  const triggerSearch = () => {
    if (search.value) {
      navigateTo({
        path: "/search",
        query: { q: search.value },
      });
      search.value = "";
      // remove focus from input
      if (document.activeElement && "blur" in document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  };

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

  // Preload currency format
  useFormatCurrency();

  type DropdownItem = {
    id: number;
    name: ComputedRef<string>;
    shortcut: string;
    dialogId: DialogID;
  };

  const dropdown: DropdownItem[] = [
    {
      id: 0,
      name: computed(() => t("menu.create_item")),
      shortcut: "Shift+1",
      dialogId: DialogID.CreateEntity,
    },
    {
      id: 1,
      name: computed(() => t("menu.create_location")),
      shortcut: "Shift+2",
      dialogId: DialogID.CreateEntity,
    },
    {
      id: 2,
      name: computed(() => t("menu.create_tag")),
      shortcut: "Shift+3",
      dialogId: DialogID.CreateTag,
    },
  ];

  const route = useRoute();
  const router = useRouter();

  type NavItem = {
    icon: Component;
    active: ComputedRef<boolean>;
    id: string;
    name: ComputedRef<string>;
    to: string;
  };

  const navItem = (id: string, icon: Component, name: () => string, to: string, isActive?: () => boolean): NavItem => ({
    id,
    icon,
    name: computed(name),
    to,
    active: computed(isActive ?? (() => route.path === to)),
  });

  const navGroups: { id: string; label?: ComputedRef<string>; items: NavItem[] }[] = [
    {
      id: "main",
      items: [
        navItem("home", House, () => t("menu.home"), "/home"),
        navItem("locations", MapPin, () => t("menu.locations"), "/locations"),
        navItem("tags", Tags, () => t("global.tags"), "/tags"),
        navItem("search", Search, () => t("menu.search"), "/search"),
        navItem("templates", FileText, () => t("menu.templates"), "/templates"),
        // Label templates are personal unless shared
        navItem(
          "label-templates",
          Printer,
          () => t("menu.label_templates"),
          "/label-templates",
          () => route.path.startsWith("/label-templates")
        ),
        navItem("maintenance", Wrench, () => t("menu.maintenance"), "/maintenance"),
      ],
    },
    {
      id: "collection",
      label: computed(() => t("menu.collection")),
      items: [
        navItem("members", Users, () => t("collection.tabs.members"), "/collection/members"),
        navItem("invites", UserPlus, () => t("collection.tabs.invites"), "/collection/invites"),
        navItem("notifiers", Bell, () => t("collection.tabs.notifiers"), "/collection/notifiers"),
        navItem("settings", Settings, () => t("collection.tabs.settings"), "/collection/settings"),
        navItem("entity-types", Shapes, () => t("collection.tabs.entity_types"), "/collection/entity-types"),
        navItem("tools", Hammer, () => t("collection.tabs.tools"), "/collection/tools"),
      ],
    },
  ];

  const nav = [
    ...navGroups.flatMap(g => g.items),
    navItem("profile", House, () => t("profile.user_profile"), "/profile"),
  ];

  const quickMenuActions = reactive([
    ...dropdown.map(v => ({
      text: computed(() => v.name.value),
      dialogId: v.dialogId,
      shortcut: v.shortcut.split("+")[1] as string,
      id: v.id,
      type: "create" as const,
    })),
    ...nav.map(v => ({
      text: computed(() => v.name.value),
      href: v.to,
      type: "navigate" as const,
    })),
  ]);

  const tagStore = useTagStore();
  tagStore.ensureAllTagsFetched();

  const locationStore = useLocationStore();
  locationStore.ensureLocationsFetched();

  const entityTypeStore = useEntityTypeStore();
  entityTypeStore.ensureFetched();

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

  onServerEvent(ServerEvent.TagMutation, () => {
    tagStore.refresh();
  });

  onServerEvent(ServerEvent.EntityMutation, () => {
    locationStore.refreshChildren();
    locationStore.refreshParents();
    locationStore.refreshTree();
  });

  const authCtx = useAuthContext();
  const api = useUserApi();

  async function logout() {
    await authCtx.logout(api);
    navigateTo("/");
  }
</script>
