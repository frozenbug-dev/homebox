<script setup lang="ts">
  import type { Component } from "vue";
  import { useI18n } from "vue-i18n";
  import { useActiveElement } from "@vueuse/core";
  import { MapPin, Package, Plus, ScanQrCode, Tags } from "@lucide/vue";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";

  export type BottomNavTab = { id: string; icon: Component; name: string; to: string; active: boolean };

  defineProps<{ tabs: BottomNavTab[] }>();
  const emit = defineEmits<{ scan: [] }>();

  const { t } = useI18n();
  const { openDialog } = useDialog();
  const createOpen = ref(false);

  // The on-screen keyboard pushes a fixed bar up over the form, so step aside while typing.
  const activeElement = useActiveElement();
  const typing = computed(() => {
    const el = activeElement.value;
    if (!el) return false;
    return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
  });
</script>

<template>
  <Transition
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-150"
  >
    <div v-if="createOpen" class="fixed inset-0 z-35 bg-foreground/30 md:hidden" aria-hidden="true" />
  </Transition>

  <nav
    :aria-label="t('shell.bottom_nav')"
    class="fixed inset-x-4 z-40 flex items-center gap-2.5 transition-[translate,opacity] duration-200 md:hidden"
    :class="typing ? 'pointer-events-none translate-y-4 opacity-0' : ''"
    style="bottom: max(1rem, env(safe-area-inset-bottom))"
  >
    <div
      class="flex h-16 min-w-0 flex-1 gap-1 rounded-full border border-border bg-background/90 p-1.5 shadow-lg backdrop-blur-md"
    >
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.id"
        :to="tab.to"
        :aria-current="tab.active ? 'page' : undefined"
        class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors"
        :class="tab.active ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground active:bg-muted'"
      >
        <component :is="tab.icon" class="size-5" aria-hidden="true" />
        <span class="max-w-full truncate px-1">{{ tab.name }}</span>
      </NuxtLink>
    </div>

    <DropdownMenu v-model:open="createOpen">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="group flex size-16 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklab,hsl(var(--primary))_92%,black)] bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-colors data-[state=open]:border-foreground data-[state=open]:bg-foreground data-[state=open]:text-background"
          :aria-label="t('shell.create_menu')"
        >
          <Plus
            class="size-6.5 transition-transform duration-150 group-data-[state=open]:rotate-45"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" :side-offset="12" class="w-58 rounded-[22px] p-1.5 md:hidden">
        <DropdownMenuItem
          class="h-12 gap-3 rounded-2xl px-3.5 text-[15px] font-medium [&_svg]:size-5 [&_svg]:text-primary"
          @select="openDialog(DialogID.CreateEntity, { params: { baseType: 'item' } })"
        >
          <Package />
          {{ t("shell.new_item") }}
        </DropdownMenuItem>
        <DropdownMenuItem
          class="h-12 gap-3 rounded-2xl px-3.5 text-[15px] font-medium [&_svg]:size-5 [&_svg]:text-primary"
          @select="openDialog(DialogID.CreateEntity, { params: { baseType: 'location' } })"
        >
          <MapPin />
          {{ t("shell.new_place") }}
        </DropdownMenuItem>
        <DropdownMenuItem
          class="h-12 gap-3 rounded-2xl px-3.5 text-[15px] font-medium [&_svg]:size-5 [&_svg]:text-primary"
          @select="openDialog(DialogID.CreateTag)"
        >
          <Tags />
          {{ t("shell.create.new_tag") }}
        </DropdownMenuItem>
        <DropdownMenuSeparator class="mx-2.5" />
        <DropdownMenuItem
          class="h-12 gap-3 rounded-2xl px-3.5 text-[15px] font-medium [&_svg]:size-5 [&_svg]:text-primary"
          @select="emit('scan')"
        >
          <ScanQrCode />
          {{ t("shell.scan") }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </nav>
</template>
