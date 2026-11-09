<script setup lang="ts">
  import type { HTMLAttributes } from "vue";
  import { useSidebar } from "./utils";
  import { Button } from "@/components/ui/button";
  import { cn } from "@/lib/utils";
  import { PanelLeftClose, PanelLeftOpen } from "@lucide/vue";

  const props = defineProps<{
    class?: HTMLAttributes["class"];
    variant?: "ghost" | "default";
  }>();

  const { toggleSidebar, state, isMobile, openMobile } = useSidebar();
  const isOpen = computed(() => (isMobile.value ? openMobile.value : state.value === "expanded"));
</script>

<template>
  <Button
    data-sidebar="trigger"
    :variant="props.variant ?? 'ghost'"
    size="icon"
    :class="cn('size-8 [&_svg]:size-4', props.class)"
    :aria-expanded="isOpen"
    @click="toggleSidebar"
  >
    <component :is="isOpen ? PanelLeftClose : PanelLeftOpen" />
    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
