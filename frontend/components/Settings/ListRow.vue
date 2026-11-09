<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Ellipsis } from "@lucide/vue";
  import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

  /**
   * A row in a settings list (members, invites, notifiers…): a leading icon or
   * avatar, a title over a subtitle, trailing pills or buttons, and an
   * optional ⋯ menu (`menu` slot of DropdownMenuItems).
   */
  defineProps<{ title?: string; subtitle?: string; menuLabel?: string }>();

  const { t } = useI18n();
</script>

<template>
  <div class="flex min-h-14 items-center gap-3 py-2.5 pr-2.5 pl-4">
    <span
      v-if="$slots.icon"
      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4"
    >
      <slot name="icon" />
    </span>
    <slot name="leading" />
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2 text-sm font-medium">
        <slot name="title"
          ><span class="truncate">{{ title }}</span></slot
        >
      </div>
      <div v-if="subtitle || $slots.subtitle" class="truncate text-[12.5px] text-muted-foreground">
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
    <DropdownMenu v-if="$slots.menu">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          :aria-label="menuLabel ?? t('collection.settings.more_actions')"
        >
          <Ellipsis class="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-52">
        <slot name="menu" />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
