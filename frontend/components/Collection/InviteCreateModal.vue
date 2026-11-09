<template>
  <BaseModal :dialog-id="DialogID.CreateGroupInvite" :title="$t('collection.create_invite')" :hide-footer="true">
    <form class="flex min-w-0 flex-col gap-4" @submit.prevent="create">
      <FormTextField v-model="form.uses" :label="$t('collection.uses')" type="number" :required="true" />

      <FormDatePicker
        :model-value="form.expiresAt"
        :label="$t('collection.expires_at')"
        time
        :clearable="false"
        @update:model-value="v => (form.expiresAt = v instanceof Date ? v : null)"
      />

      <div class="mt-4 flex flex-row-reverse">
        <ButtonGroup>
          <Button :disabled="loading" type="submit">
            {{ $t("global.create") }}
          </Button>
        </ButtonGroup>
      </div>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { useDialog } from "~/components/ui/dialog-provider";
  import BaseModal from "@/components/App/CreateModal.vue";
  import FormTextField from "~/components/Form/TextField.vue";
  import FormDatePicker from "~/components/Form/DatePicker.vue";
  import { Button, ButtonGroup } from "~/components/ui/button";
  import { toast } from "@/components/ui/sonner";
  import { useUserApi } from "~/composables/use-api";

  const { t } = useI18n();
  const { activeDialog, closeDialog } = useDialog();
  const api = useUserApi();

  const loading = ref(false);
  const form = reactive<{ uses: number; expiresAt: Date | null }>({
    uses: 1,
    expiresAt: defaultExpiry(),
  });

  function defaultExpiry(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  watch(
    () => activeDialog.value,
    active => {
      if (active && active === DialogID.CreateGroupInvite) {
        form.uses = 1;
        form.expiresAt = defaultExpiry();
        loading.value = false;
      }
    }
  );

  async function create() {
    if (loading.value) {
      return;
    }

    const parsedUses = Number(form.uses ?? 0);
    if (!Number.isFinite(parsedUses) || parsedUses < 1 || parsedUses > 100) {
      toast.error(t("components.collection.invite_create_modal.toast.invalid_uses"));
      return;
    }
    const uses = parsedUses;

    if (!form.expiresAt) {
      toast.error(t("components.collection.invite_create_modal.toast.invalid_expiry_missing"));
      return;
    }

    const now = new Date();
    const exp = new Date(form.expiresAt);
    if (exp.getTime() <= now.getTime()) {
      toast.error(t("components.collection.invite_create_modal.toast.invalid_expiry_past"));
      return;
    }

    const expiresAtToSend: Date = exp;

    loading.value = true;

    try {
      const res = await api.group.createInvitation({
        expiresAt: expiresAtToSend,
        uses,
      });

      if (res.error) {
        const msg = t("errors.api_failure") + String(res.error);
        toast.error(msg);
        loading.value = false;
        return;
      }

      const data = res.data ?? undefined;
      closeDialog(DialogID.CreateGroupInvite, data);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(msg);
    } finally {
      loading.value = false;
    }
  }
</script>
