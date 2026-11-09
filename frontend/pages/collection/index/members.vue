<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Copy, Plus, UserMinus } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsListRow from "~/components/Settings/ListRow.vue";
  import type { UserSummary } from "~~/lib/api/types/data-contracts";

  definePageMeta({
    middleware: ["auth"],
  });

  const { t } = useI18n();

  const api = useUserApi();
  const auth = useAuthContext();
  const confirm = useConfirm();

  const { members: membersData } = useCollectionSettingsData();
  const members = computed(() => membersData.data.value);
  const loading = computed(() => membersData.status.value === "pending" && !members.value.length);
  const removing = ref<Record<string, boolean>>({});

  const currentUserId = computed(() => auth.user?.id ?? "");

  const isLastMember = computed(() => members.value.length <= 1);

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]!.toUpperCase())
      .join("") || "?";

  async function copyEmail(user: UserSummary) {
    await navigator.clipboard.writeText(user.email);
    toast.success(t("shell.members_page.email_copied"));
  }

  const handleRemove = async (user: UserSummary) => {
    if (!user?.id) return;

    if (isLastMember.value && user.id === currentUserId.value) {
      toast.error(t("collection.members.cannot_remove_last"));
      return;
    }

    const result = await confirm.open(t("collection.members.remove_confirm"));
    if (result.isCanceled) {
      return;
    }

    removing.value = { ...removing.value, [user.id]: true };

    try {
      const res = await api.group.removeMember(user.id);
      if (res.error) {
        const msg = t("errors.api_failure") + String(res.error);
        toast.error(msg);
      } else {
        membersData.data.value = members.value.filter(m => m.id !== user.id);
        toast.success(t("collection.members.removed"));
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(msg);
    } finally {
      removing.value = { ...removing.value, [user.id]: false };
    }
  };
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.members')" :description="t('collection.settings.members_sub')">
    <template #actions>
      <Button size="sm" as-child>
        <NuxtLink to="/collection/invites"><Plus /> {{ t("collection.settings.invite_people") }}</NuxtLink>
      </Button>
    </template>

    <p v-if="loading" class="text-sm text-muted-foreground">{{ t("global.loading") }}</p>
    <p v-else-if="!members.length" class="text-sm text-muted-foreground">{{ t("collection.members.empty") }}</p>

    <SettingsGroup v-else>
      <SettingsListRow v-for="m in members" :key="m.id" :subtitle="m.email">
        <template #leading>
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
            aria-hidden="true"
          >
            {{ initials(m.name) }}
          </span>
        </template>
        <template #title>
          <span class="truncate">{{ m.name }}</span>
          <span
            v-if="m.id === currentUserId"
            class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {{ t("shell.members_page.you") }}
          </span>
        </template>
        <template #menu>
          <DropdownMenuItem @select="copyEmail(m)"><Copy /> {{ t("shell.members_page.copy_email") }}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="text-destructive focus:text-destructive"
            :disabled="removing[m.id] || (isLastMember && m.id === currentUserId)"
            @select="handleRemove(m)"
          >
            <UserMinus /> {{ t("shell.members_page.remove") }}
          </DropdownMenuItem>
        </template>
      </SettingsListRow>
    </SettingsGroup>
  </SettingsSection>
</template>
