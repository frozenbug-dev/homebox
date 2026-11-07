<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Link, Ticket, Trash2 } from "@lucide/vue";
  import type { GroupInvitation } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { toast } from "@/components/ui/sonner";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  export type InviteRow = GroupInvitation & { id: string };

  /**
   * An invitation as a list row: the token (only known right after creating
   * it), when it expires and how many uses are left.
   */
  const props = defineProps<{ invite: InviteRow; rowKey: string }>();
  const emit = defineEmits<{ delete: [invite: InviteRow] }>();

  const { t, locale } = useI18n();
  const link = computed(() =>
    props.invite.token ? `${window.location.protocol}//${window.location.host}?token=${props.invite.token}` : ""
  );
  const expires = computed(() =>
    props.invite.expiresAt
      ? new Date(props.invite.expiresAt).toLocaleString(locale.value, { dateStyle: "medium", timeStyle: "short" })
      : ""
  );

  async function copyLink() {
    if (!link.value) return;
    await navigator.clipboard.writeText(link.value);
    toast.success(t("shell.resource.link_copied"));
  }
</script>

<template>
  <ResourceRow :id="rowKey" class="cursor-default">
    <template #left>
      <Ticket class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span v-if="invite.token" class="truncate font-mono text-xs">{{ invite.token }}</span>
      <span v-else class="truncate text-muted-foreground">{{ t("collection.invite_token_hidden") }}</span>
      <button
        v-if="invite.token"
        type="button"
        class="shrink-0 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
        @click="copyLink"
      >
        {{ t("collection.copy_invite") }}
      </button>
    </template>
    <template #right>
      <span class="hidden w-44 text-right text-xs sm:inline" :title="t('collection.expires_at')">{{ expires }}</span>
      <span class="w-20 text-right text-xs tabular-nums" :title="t('collection.remaining_uses')">
        {{ t("shell.invites_page.uses", { n: invite.uses }) }}
      </span>
    </template>
    <template #menu>
      <ContextMenuItem v-if="invite.token" @select="copyLink">
        <Link /> {{ t("collection.copy_invite") }}
      </ContextMenuItem>
      <ContextMenuSeparator v-if="invite.token" />
      <ContextMenuItem class="text-destructive focus:text-destructive" @select="emit('delete', invite)">
        <Trash2 /> {{ t("global.delete") }}
      </ContextMenuItem>
    </template>
  </ResourceRow>
</template>
