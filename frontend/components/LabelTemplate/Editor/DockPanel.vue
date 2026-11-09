<script setup lang="ts">
  import { ChevronRight } from "@lucide/vue";
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

  /**
   * One collapsible panel in the editor's dock (Element, Layers, Label, Print
   * preview). The header shows a short summary in `meta`, so a folded panel
   * still says what's in it. Folded content stays mounted, so the print
   * preview keeps its picked item and render.
   */
  defineProps<{ title: string; meta?: string | number }>();
  const open = defineModel<boolean>("open", { default: true });
</script>

<template>
  <Collapsible
    v-model:open="open"
    :unmount-on-hide="false"
    as="section"
    class="border-b border-border"
    :aria-label="title"
  >
    <CollapsibleTrigger
      class="flex h-9 w-full items-center gap-1.5 pr-3 pl-2 text-left transition-colors hover:bg-muted/50"
    >
      <ChevronRight
        class="size-3.5 shrink-0 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': open }"
        aria-hidden="true"
      />
      <span class="shrink-0 text-[11px] font-semibold tracking-wide whitespace-nowrap text-foreground/80 uppercase">
        {{ title }}
      </span>
      <span class="min-w-3 flex-1" />
      <span class="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
        <slot name="meta">{{ meta }}</slot>
      </span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="px-3 pt-0.5 pb-3.5">
        <slot />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
