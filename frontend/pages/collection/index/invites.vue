<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Info, Link as LinkIcon, Plus, Ticket, Trash2 } from "@lucide/vue";
  import { Button } from "@/components/ui/button";
  import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsListRow from "~/components/Settings/ListRow.vue";
  import { toast } from "@/components/ui/sonner";
  import { useUserApi } from "~/composables/use-api";
  import { useDialog } from "~/components/ui/dialog-provider";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import type { Group, GroupInvitation } from "~~/lib/api/types/data-contracts";

  definePageMeta({
    middleware: ["auth"],
  });

  type Invitation = GroupInvitation & { id: string; group?: Group };
  type InvitationResult = GroupInvitation & { id: string; group?: Group };

  const { t, locale } = useI18n();

  const api = useUserApi();
  const { openDialog } = useDialog();
  const confirm = useConfirm();
  const localInvites = ref<Invitation[]>([]);
  const loading = ref(true);
  const invites = ref<Invitation[]>([]);
  const error = ref<string | null>(null);
  const removing = ref<Record<string, boolean>>({});

  const allInvites = computed<Invitation[]>(() => {
    const now = Date.now();

    const isActive = (inv: Invitation) => {
      if (!inv.expiresAt) return true;

      const expiresAtTime = new Date(inv.expiresAt).getTime();
      return Number.isFinite(expiresAtTime) && expiresAtTime > now;
    };

    return [...localInvites.value.filter(isActive), ...invites.value.filter(isActive)];
  });

  const loadInvites = async () => {
    loading.value = true;
    error.value = null;

    try {
      const res = await api.group.getInvitations();

      if (res.error) {
        const msg = t("errors.api_failure") + String(res.error);
        error.value = msg;
        invites.value = [];
        toast.error(msg);
      } else {
        invites.value = (res.data || []) as Invitation[];
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      error.value = msg;
      invites.value = [];
      toast.error(msg);
    } finally {
      loading.value = false;
    }
  };

  const handleOpenCreate = () => {
    openDialog(DialogID.CreateGroupInvite, {
      onClose: (result?: InvitationResult) => {
        if (!result) return;

        const localInvite: Invitation = {
          ...(result as InvitationResult),
        };

        localInvites.value = [localInvite, ...localInvites.value];
      },
    });
  };

  const handleDelete = async (inv: Invitation) => {
    if (!inv?.id) return;

    const result = await confirm.open(t("collection.invites_delete_confirm"));
    if (result.isCanceled) {
      return;
    }

    removing.value = { ...removing.value, [inv.id]: true };

    try {
      const res = await api.group.deleteInvitation(inv.id);

      if (res.error) {
        const msg = t("errors.api_failure") + String(res.error);
        toast.error(msg);
      } else {
        invites.value = invites.value.filter(i => i.id !== inv.id);
        localInvites.value = localInvites.value.filter(i => i.id !== inv.id && i.token !== inv.token);
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(msg);
    } finally {
      removing.value = { ...removing.value, [inv.id]: false };
    }
  };

  const inviteLink = (inv: Invitation) => `${window.location.protocol}//${window.location.host}?token=${inv.token}`;

  async function copyLink(inv: Invitation) {
    if (!inv.token) return;
    await navigator.clipboard.writeText(inviteLink(inv));
    toast.success(t("shell.resource.link_copied"));
  }

  const describe = (inv: Invitation) =>
    [
      inv.expiresAt
        ? t("collection.settings.invite_expires", {
            date: new Date(inv.expiresAt).toLocaleString(locale.value, { dateStyle: "medium", timeStyle: "short" }),
          })
        : "",
      t("shell.invites_page.uses", { n: inv.uses }),
    ]
      .filter(Boolean)
      .join(" · ");

  onMounted(() => {
    loadInvites();
  });
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.invites')" :description="t('collection.settings.invites_sub')">
    <template #actions>
      <Button size="sm" :disabled="loading" @click="handleOpenCreate"
        ><Plus /> {{ t("collection.create_invite") }}</Button
      >
    </template>

    <p v-if="loading" class="text-sm text-muted-foreground">{{ t("global.loading") }}</p>

    <div v-else>
      <div
        v-if="localInvites.length"
        class="mb-3 flex items-start gap-2.5 rounded-[10px] bg-muted px-3.5 py-3 text-[13px]"
      >
        <Info class="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{{ t("collection.invite_token_warning") }}</span>
      </div>

      <p v-if="!allInvites.length" class="text-sm text-muted-foreground">{{ t("collection.no_invites") }}</p>

      <SettingsGroup v-else>
        <SettingsListRow v-for="inv in allInvites" :key="inv.id || inv.token" :subtitle="describe(inv)">
          <template #icon><Ticket /></template>
          <template #title>
            <span v-if="inv.token" class="truncate font-mono text-[13px]">{{ inv.token }}</span>
            <span v-else class="truncate font-normal text-muted-foreground">{{
              t("collection.invite_token_hidden")
            }}</span>
          </template>
          <Button v-if="inv.token" variant="outline" size="sm" @click="copyLink(inv)">
            <LinkIcon /> {{ t("collection.copy_invite") }}
          </Button>
          <template #menu>
            <template v-if="inv.token">
              <DropdownMenuItem @select="copyLink(inv)"
                ><LinkIcon /> {{ t("collection.copy_invite") }}</DropdownMenuItem
              >
              <DropdownMenuSeparator />
            </template>
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              :disabled="removing[inv.id]"
              @select="handleDelete(inv)"
            >
              <Trash2 /> {{ t("global.delete") }}
            </DropdownMenuItem>
          </template>
        </SettingsListRow>
      </SettingsGroup>
    </div>
  </SettingsSection>
</template>
