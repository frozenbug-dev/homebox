<script setup lang="ts">
  import type { HTMLAttributes } from "vue";
  import { useSidebar } from "./utils";
  import { Button } from "@/components/ui/button";
  import { cn } from "@/lib/utils";
  import { PanelLeft } from "@lucide/vue";

  const props = defineProps<{
    class?: HTMLAttributes["class"];
    variant?: "ghost" | "default";
  }>();

  const { toggleSidebar } = useSidebar();
</script>

<template>
  <Button data-sidebar="trigger" :variant="props.variant ?? 'ghost'" size="icon" :class="cn('size-9 [&_svg]:size-[18px]', props.class)" @click="toggleSidebar">
    <PanelLeft />
    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
