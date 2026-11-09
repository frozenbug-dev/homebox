<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
  import { Bell, Pencil, Plus, Send, Trash2 } from "@lucide/vue";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsListRow from "~/components/Settings/ListRow.vue";
  import FormCheckbox from "~/components/Form/Checkbox.vue";
  import FormTextField from "~/components/Form/TextField.vue";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import type { NotifierCreate, NotifierOut } from "~~/lib/api/types/data-contracts";

  definePageMeta({
    middleware: ["auth"],
  });

  const { t } = useI18n();

  const api = useUserApi();
  const confirm = useConfirm();
  const { openDialog, closeDialog } = useDialog();

  const notifiers = useAsyncData(async () => {
    const { data } = await api.notifiers.getAll();
    return data;
  });

  const targetID = ref("");
  const notifier = ref<NotifierCreate | null>(null);

  const openNotifierDialog = (v: NotifierOut | null) => {
    if (v) {
      targetID.value = v.id;
      notifier.value = {
        name: v.name,
        url: v.url,
        isActive: v.isActive,
      };
    } else {
      targetID.value = "";
      notifier.value = {
        name: "",
        url: "",
        isActive: true,
      };
    }

    openDialog(DialogID.CreateNotifier);
  };

  const createNotifier = async () => {
    if (!notifier.value) return;

    if (targetID.value) {
      await editNotifier();
      return;
    }

    const result = await api.notifiers.create({
      name: notifier.value.name,
      url: notifier.value.url || "",
      isActive: notifier.value.isActive,
    });

    if (result.error) {
      toast.error(t("profile.toast.failed_create_notifier"));
    }

    notifier.value = null;
    closeDialog(DialogID.CreateNotifier);
    await notifiers.refresh();
  };

  const editNotifier = async () => {
    if (!notifier.value) return;

    const result = await api.notifiers.update(targetID.value, {
      name: notifier.value.name,
      url: notifier.value.url || "",
      isActive: notifier.value.isActive,
    });

    if (result.error) {
      toast.error(t("profile.toast.failed_update_notifier"));
    }

    notifier.value = null;
    targetID.value = "";
    closeDialog(DialogID.CreateNotifier);
    await notifiers.refresh();
  };

  /** Hides the credentials part of a Shoutrrr URL, e.g. discord://token@id → discord://••••@id. */
  const maskUrl = (url: string) => url.replace(/^([a-z0-9+.-]+:\/\/)([^@/]+)@/i, "$1••••@");

  const deleteNotifier = async (id: string) => {
    const result = await confirm.open(t("profile.delete_notifier_confirm"));

    if (result.isCanceled) return;

    const { error } = await api.notifiers.delete(id);

    if (error) {
      toast.error(t("profile.toast.failed_delete_notifier"));
      return;
    }

    await notifiers.refresh();
  };

  const testNotifier = async (url = notifier.value?.url) => {
    if (!url) return;

    const { error } = await api.notifiers.test(url);

    if (error) {
      toast.error(t("profile.toast.failed_test_notifier"));
      return;
    }

    toast.success(t("profile.toast.notifier_test_success"));
  };
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.notifiers')" :description="t('profile.notifiers_sub')">
    <template #actions>
      <Button size="sm" @click="openNotifierDialog(null)"><Plus /> {{ t("collection.settings.add_notifier") }}</Button>
    </template>

    <Dialog :dialog-id="DialogID.CreateNotifier">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t("profile.notifier_modal", { type: notifier != null }) }}</DialogTitle>
        </DialogHeader>

        <form @submit.prevent="createNotifier">
          <template v-if="notifier">
            <FormTextField v-model="notifier.name" :label="$t('global.name')" class="mb-2" />
            <FormTextField v-model="notifier.url" :label="$t('profile.url')" class="mb-2" />
            <div class="max-w-25">
              <FormCheckbox v-model="notifier.isActive" :label="$t('profile.enabled')" />
            </div>
          </template>
          <div class="mt-4 flex justify-between gap-2">
            <DialogFooter class="flex w-full">
              <Button variant="secondary" :disabled="!(notifier && notifier.url)" type="button" @click="testNotifier()">
                {{ $t("profile.test") }}
              </Button>
              <div class="grow" />
              <Button type="submit">{{ $t("global.submit") }}</Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <p v-if="!notifiers.data.value" class="text-sm text-muted-foreground">{{ t("global.loading") }}</p>
    <p v-else-if="!notifiers.data.value.length" class="text-sm text-muted-foreground">
      {{ t("profile.no_notifiers") }}
    </p>

    <SettingsGroup v-else>
      <SettingsListRow v-for="n in notifiers.data.value" :key="n.id" :title="n.name">
        <template #icon><Bell /></template>
        <template #subtitle
          ><span class="font-mono">{{ maskUrl(n.url) }}</span></template
        >
        <span
          class="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-medium max-sm:hidden"
          :class="n.isActive ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'"
        >
          <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {{ n.isActive ? t("profile.active") : t("profile.inactive") }}
        </span>
        <Button variant="outline" size="sm" class="max-sm:hidden" @click="testNotifier(n.url)">
          {{ t("collection.settings.send_test") }}
        </Button>
        <template #menu>
          <DropdownMenuItem @select="openNotifierDialog(n)"><Pencil /> {{ t("global.edit") }}</DropdownMenuItem>
          <DropdownMenuItem @select="testNotifier(n.url)"
            ><Send /> {{ t("collection.settings.send_test") }}</DropdownMenuItem
          >
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deleteNotifier(n.id)">
            <Trash2 /> {{ t("global.delete") }}
          </DropdownMenuItem>
        </template>
      </SettingsListRow>
    </SettingsGroup>
  </SettingsSection>
</template>
