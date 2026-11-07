<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Copy, UserMinus } from "@lucide/vue";
  import type { UserSummary } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { toast } from "@/components/ui/sonner";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  /** A collection member as a list row: initials, name and email. */
  const props = defineProps<{ user: UserSummary; isSelf?: boolean; canRemove?: boolean }>();
  const emit = defineEmits<{ remove: [user: UserSummary] }>();

  const { t } = useI18n();
  const initials = computed(
    () =>
      props.user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]!.toUpperCase())
        .join("") || "?"
  );

  async function copyEmail() {
    await navigator.clipboard.writeText(props.user.email);
    toast.success(t("shell.members_page.email_copied"));
  }
</script>

<template>
  <ResourceRow :id="user.id" class="cursor-default">
    <template #left>
      <span
        class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary"
        aria-hidden="true"
      >
        {{ initials }}
      </span>
      <span class="truncate font-medium">{{ user.name }}</span>
      <span v-if="isSelf" class="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
        {{ t("shell.members_page.you") }}
      </span>
    </template>
    <template #right>
      <span class="truncate">{{ user.email }}</span>
    </template>
    <template #menu>
      <ContextMenuItem @select="copyEmail"> <Copy /> {{ t("shell.members_page.copy_email") }} </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        class="text-destructive focus:text-destructive"
        :disabled="!canRemove"
        @select="emit('remove', user)"
      >
        <UserMinus /> {{ t("shell.members_page.remove") }}
      </ContextMenuItem>
    </template>
  </ResourceRow>
</template>
