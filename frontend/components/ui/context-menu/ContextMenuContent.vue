<script setup lang="ts">
  import type { ContextMenuContentEmits, ContextMenuContentProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";
  import { reactiveOmit } from "@vueuse/core";
  import { ContextMenuContent, ContextMenuPortal, useForwardPropsEmits } from "reka-ui";
  import { cn } from "@/lib/utils";

  // Keep the menu on screen: slide it along both axes (not only flip sides) and
  // hold it off the edges. A 14rem menu opened mid-screen on a phone fits neither side.
  const props = withDefaults(defineProps<ContextMenuContentProps & { class?: HTMLAttributes["class"] }>(), {
    prioritizePosition: true,
    collisionPadding: 8,
    class: undefined,
  });
  const emits = defineEmits<ContextMenuContentEmits>();

  const delegatedProps = reactiveOmit(props, "class");

  const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      v-bind="forwarded"
      :class="
        cn(
          'z-50 min-w-32 animate-in overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md fade-in-80 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          props.class
        )
      "
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
