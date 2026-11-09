<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { LoaderCircle, LogOut, Trash2 } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import AppShortcutHint from "~/components/App/ShortcutHint.vue";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsRow from "~/components/Settings/Row.vue";
  import type { CurrenciesCurrency } from "~~/lib/api/types/data-contracts";
  import { fmtCurrencyAsync } from "~/composables/utils";

  /** General: the collection's name and currency, plus leaving or deleting it. */
  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  const api = useUserApi();
  const auth = useAuthContext();
  const confirm = useConfirm();
  const { load: reloadCollections } = useCollections();
  const { collection, group, members } = useCollectionSettingsData();

  const currencies = ref<CurrenciesCurrency[]>([]);
  onMounted(async () => {
    const res = await api.group.currencies();
    if (res.error) toast.error(t("profile.toast.failed_get_currencies"));
    else currencies.value = res.data ?? [];
  });

  // ----- Name and currency, saved together from the save bar -----

  const name = ref("");
  const currency = ref("USD");
  const reset = () => {
    name.value = group.data.value?.name ?? "";
    currency.value = group.data.value?.currency ?? "USD";
  };
  watch(() => group.data.value, reset, { immediate: true });

  const dirty = computed(
    () => !!group.data.value && (name.value !== group.data.value.name || currency.value !== group.data.value.currency)
  );

  const example = ref("");
  watch(
    currency,
    async code => {
      if (!code) return;
      try {
        example.value = await fmtCurrencyAsync(1000, code, getLocaleCode());
      } catch {
        example.value = `${code} 1000`;
      }
    },
    { immediate: true }
  );

  const saving = ref(false);
  async function save() {
    if (!collection.value || !dirty.value || saving.value || !name.value.trim()) return;
    saving.value = true;
    try {
      const res = await api.group.update({ name: name.value.trim(), currency: currency.value }, collection.value.id);
      if (res.error || !res.data) {
        toast.error(t("profile.toast.failed_update_group"));
        return;
      }
      group.data.value = res.data;
      setCurrency(res.data.currency);
      toast.success(t("profile.toast.group_updated"));
      await reloadCollections();
    } finally {
      saving.value = false;
    }
  }

  useEventListener(document, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && dirty.value) {
      e.preventDefault();
      void save();
    }
  });

  // ----- Leave / delete -----

  const currentUserId = computed(() => auth.user?.id ?? "");
  const isOnlyMember = computed(
    () => members.data.value.length === 1 && members.data.value[0]?.id === currentUserId.value
  );
  const busy = ref(false);

  async function leave() {
    if (!collection.value || (await confirm.open(t("collection.leave_confirm"))).isCanceled) return;
    busy.value = true;
    try {
      let userId = currentUserId.value;
      if (!userId) userId = (await api.user.self()).data?.item.id ?? "";
      const res = await api.group.removeMember(userId);
      if (res.error) {
        toast.error(t("errors.api_failure") + String(res.error));
        return;
      }
      toast.success(t("collection.left_collection"));
      await reloadCollections();
      window.location.reload();
    } finally {
      busy.value = false;
    }
  }

  async function remove() {
    if (!collection.value || (await confirm.open(t("collection.delete_confirm"))).isCanceled) return;
    busy.value = true;
    try {
      const res = await api.group.delete(collection.value.id);
      if (res.error) {
        toast.error(t("errors.api_failure") + String(res.error));
        return;
      }
      toast.success(t("collection.deleted_collection"));
      await reloadCollections();
      window.location.reload();
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <SettingsSection :title="t('collection.settings.nav.general')" :description="t('collection.settings.general_sub')">
    <div v-if="!collection" class="text-sm text-muted-foreground">
      {{ t("components.collection.selector.select_collection") }}
    </div>

    <template v-else>
      <SettingsGroup>
        <SettingsRow for="collection-name" :title="t('global.name')" :description="t('collection.settings.name_sub')">
          <Input id="collection-name" v-model="name" :disabled="!group.data.value" class="h-9" />
        </SettingsRow>
        <SettingsRow
          for="collection-currency"
          :title="t('profile.currency_format')"
          :description="t('collection.settings.currency_sub')"
        >
          <div class="flex w-full flex-col gap-1.5">
            <Select :model-value="currency" @update:model-value="v => (currency = String(v || ''))">
              <SelectTrigger id="collection-currency" class="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                  {{ c.name }} · {{ c.code }}
                </SelectItem>
              </SelectContent>
            </Select>
            <span class="text-[12.5px] text-muted-foreground">
              {{ t("collection.settings.preview") }}
              <span class="ml-1 font-mono text-foreground">{{ example }}</span>
            </span>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup :title="t('collection.settings.danger_zone')">
        <SettingsRow :title="t('collection.leave_collection')" :description="t('collection.settings.leave_sub')">
          <Button
            variant="outline"
            size="sm"
            class="text-destructive hover:bg-destructive/10 hover:text-destructive"
            :disabled="busy || isOnlyMember"
            @click="leave"
          >
            <LogOut />
            {{ t("collection.settings.leave") }}
          </Button>
        </SettingsRow>
        <SettingsRow :title="t('collection.delete_collection')" :description="t('collection.settings.delete_sub')">
          <TooltipProvider :delay-duration="0">
            <Tooltip :disabled="isOnlyMember">
              <TooltipTrigger as-child>
                <span tabindex="0" class="inline-flex">
                  <Button variant="destructive" size="sm" :disabled="busy || !isOnlyMember" @click="remove">
                    <Trash2 />
                    {{ t("collection.delete_collection") }}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{{ t("collection.settings.delete_disabled") }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SettingsRow>
      </SettingsGroup>
    </template>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="dirty"
        role="status"
        class="sticky bottom-[calc(var(--bottom-nav-space,0px)+1.25rem)] z-10 mx-auto flex w-max max-w-full items-center gap-1 rounded-xl bg-foreground py-1.5 pr-1.5 pl-4 text-background shadow-lg"
      >
        <span class="mr-2 text-[13px]">{{ t("collection.settings.unsaved") }}</span>
        <button
          type="button"
          class="h-8 rounded-lg px-3 text-[13px] font-medium text-background/80 hover:bg-background/10 hover:text-background"
          @click="reset"
        >
          {{ t("collection.settings.discard") }}
        </button>
        <button
          type="button"
          class="inline-flex h-8 items-center gap-2 rounded-lg bg-background pr-2 pl-3 text-[13px] font-medium text-foreground hover:bg-background/90 disabled:opacity-60"
          :disabled="saving || !name.trim()"
          @click="save"
        >
          <LoaderCircle v-if="saving" class="size-3.5 animate-spin" />
          {{ t("collection.settings.save") }}
          <AppShortcutHint hotkey="Mod+Enter" class="max-md:hidden" />
        </button>
      </div>
    </Transition>
  </SettingsSection>
</template>
