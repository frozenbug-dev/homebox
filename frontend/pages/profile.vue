<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import * as Locales from "date-fns/locale";
  import { Copy, KeyRound, LoaderCircle, LogOut, Plus, Trash2 } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Switch } from "@/components/ui/switch";
  import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import FormPassword from "~/components/Form/Password.vue";
  import FormTextField from "~/components/Form/TextField.vue";
  import FormDatePicker from "~/components/Form/DatePicker.vue";
  import FormCheckbox from "~/components/Form/Checkbox.vue";
  import DateTime from "@/components/global/DateTime.vue";
  import PasswordScore from "~/components/global/PasswordScore.vue";
  import SettingsSection from "~/components/Settings/Section.vue";
  import SettingsGroup from "~/components/Settings/Group.vue";
  import SettingsRow from "~/components/Settings/Row.vue";
  import SettingsListRow from "~/components/Settings/ListRow.vue";
  import { fmtDate } from "~~/composables/use-formatters";
  import { localeMeasurementSystem, measurementLocale } from "~~/composables/use-measurement";
  import { PASSWORD_MIN_LENGTH, PASSWORD_RULES } from "~/lib/passwords";
  import type { APIKeyOut } from "~~/lib/api/types/data-contracts";

  /**
   * Account settings: who you are, how you sign in, and the preferences that
   * follow you across collections. Laid out with the same section, group and
   * row pieces as collection settings.
   */
  definePageMeta({ middleware: ["auth"] });

  const { t, locale, availableLocales } = useI18n({ useScope: "global" });
  usePageHeader(() => [{ label: t("profile.settings.title") }]);
  useHead({ title: () => `HomeBox | ${t("profile.settings.title")}` });

  const api = useUserApi();
  const auth = useAuthContext();
  const confirm = useConfirm();
  const preferences = useViewPreferences();
  const { openDialog, closeDialog } = useDialog();

  const initial = computed(() => (auth.user?.name ?? "").trim().charAt(0).toUpperCase() || "?");

  // ----- Language & region -----

  function setLanguage(lang: unknown) {
    if (typeof lang !== "string") return;
    locale.value = lang;
    preferences.value.language = lang;
  }

  const formatLocales = Object.values(Locales).map(l => ({
    code: l.code,
    name: new Intl.DisplayNames([preferences.value.language ?? "en-US"], { type: "language" }).of(l.code) ?? l.code,
    localName: new Intl.DisplayNames([l.code], { type: "language" }).of(l.code) ?? l.code,
  }));

  // "none" stands in for no override, which follows the language
  const formatLocale = computed({
    get: () => preferences.value.overrideFormatLocale ?? "none",
    set: (v: string) => {
      preferences.value.overrideFormatLocale = v === "none" ? undefined : v;
    },
  });

  const dateExample = computed(() => {
    // read the override so the example updates when it changes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const override = preferences.value.overrideFormatLocale;
    return fmtDate(new Date(Date.now() - 15 * 60000), "relative");
  });

  // "auto" stands in for a null preference, which follows the locale
  const measurementSystem = computed({
    get: () => preferences.value.measurementSystem ?? "auto",
    set: (v: string) => {
      preferences.value.measurementSystem = v === "metric" || v === "imperial" ? v : null;
    },
  });
  const localeSystem = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const override = preferences.value.overrideFormatLocale;
    return localeMeasurementSystem(measurementLocale());
  });

  // ----- Duplicating items -----

  const duplicate = computed(() => preferences.value.duplicateSettings);
  const prefix = ref(duplicate.value.copyPrefixOverride ?? "");
  const customPrefix = computed({
    get: () => duplicate.value.copyPrefixOverride !== null,
    set: (on: boolean) => {
      duplicate.value.copyPrefixOverride = on ? prefix.value : null;
    },
  });
  watch(prefix, v => {
    if (customPrefix.value) duplicate.value.copyPrefixOverride = v;
  });

  // ----- Password -----

  const passwordChange = reactive({ loading: false, current: "", new: "", isValid: false });

  function openChangePassword() {
    passwordChange.current = "";
    passwordChange.new = "";
    openDialog(DialogID.ChangePassword);
  }

  async function changePassword() {
    if (!passwordChange.isValid) return;
    passwordChange.loading = true;
    try {
      const { error } = await api.user.changePassword(passwordChange.current, passwordChange.new);
      if (error) {
        toast.error(t("profile.toast.failed_change_password"));
        return;
      }
      toast.success(t("profile.toast.password_changed"));
      closeDialog(DialogID.ChangePassword);
      passwordChange.new = "";
      passwordChange.current = "";
    } finally {
      passwordChange.loading = false;
    }
  }

  async function logoutAllDevices() {
    if ((await confirm.open(t("profile.logout_all_confirm"))).isCanceled) return;

    const { error } = await api.user.logoutAll();
    if (error) {
      toast.error(t("profile.toast.failed_logout_all"));
      return;
    }

    // Every session token was revoked server-side, including this one, so clear
    // the local session and send the user back to the login flow.
    toast.success(t("profile.toast.logout_all_success"));
    auth.invalidateSession();
    navigateTo("/");
  }

  // ----- API keys -----

  const apiKeys = ref<APIKeyOut[]>([]);
  const apiKeysLoading = ref(true);

  async function loadApiKeys() {
    apiKeysLoading.value = true;
    const { data, error } = await api.user.listApiKeys();
    apiKeysLoading.value = false;
    if (error) {
      toast.error(t("errors.api_failure") + String(error));
      return;
    }
    apiKeys.value = data ?? [];
  }

  onMounted(() => void loadApiKeys());

  const apiKeyForm = reactive({ name: "", setExpiration: false, expiresAt: "", submitting: false });

  function openCreateApiKey() {
    apiKeyForm.name = "";
    apiKeyForm.setExpiration = false;
    apiKeyForm.expiresAt = "";
    apiKeyForm.submitting = false;
    openDialog(DialogID.CreateApiKey);
  }

  const newApiKeyToken = ref<string | null>(null);

  async function submitCreateApiKey() {
    if (!apiKeyForm.name.trim()) return;
    apiKeyForm.submitting = true;

    let expiresAt: string | null = null;
    if (apiKeyForm.setExpiration && apiKeyForm.expiresAt) {
      // <input type="date"> gives YYYY-MM-DD; treat as end-of-day UTC so the
      // key remains valid through the chosen calendar day.
      expiresAt = new Date(apiKeyForm.expiresAt + "T23:59:59Z").toISOString();
    }

    const { data, error } = await api.user.createApiKey({ name: apiKeyForm.name.trim(), expiresAt });
    apiKeyForm.submitting = false;

    if (error || !data) {
      toast.error(t("profile.toast.failed_api_key_create"));
      return;
    }

    closeDialog(DialogID.CreateApiKey);
    newApiKeyToken.value = data.token;
    openDialog(DialogID.CreateApiKeyResult);
    toast.success(t("profile.toast.api_key_created"));
    await loadApiKeys();
  }

  async function copyApiKey() {
    if (!newApiKeyToken.value) return;
    try {
      await navigator.clipboard.writeText(newApiKeyToken.value);
      toast.success(t("profile.api_key_copied"));
    } catch {
      // Clipboard API can be blocked by the browser; surface no error toast,
      // the user can still copy manually from the visible field.
    }
  }

  function dismissApiKeyResult() {
    closeDialog(DialogID.CreateApiKeyResult);
    newApiKeyToken.value = null;
  }

  async function revokeApiKey(key: APIKeyOut) {
    if ((await confirm.open(t("profile.api_key_delete_confirm"))).isCanceled) return;

    const { error } = await api.user.deleteApiKey(key.id);
    if (error) {
      toast.error(t("profile.toast.failed_api_key_delete"));
      return;
    }
    toast.success(t("profile.toast.api_key_deleted"));
    await loadApiKeys();
  }

  // ----- Delete account -----

  async function deleteProfile() {
    if ((await confirm.open(t("profile.delete_account_confirm"))).isCanceled) return;

    const { response } = await api.user.delete();
    if (response?.status === 204) {
      toast.success(t("profile.toast.account_deleted"));
      auth.logout(api);
      navigateTo("/");
      return;
    }
    toast.error(t("profile.toast.failed_delete_account"));
  }
</script>

<template>
  <div class="flex-1 px-4 pt-6 pb-24 sm:px-8 md:pt-10 lg:px-12">
    <div class="mx-auto max-w-190">
      <SettingsSection :title="t('profile.settings.title')" :description="t('profile.settings.sub')">
        <!-- Profile -->
        <SettingsGroup :title="t('profile.settings.groups.profile')">
          <SettingsListRow :title="auth.user?.name || t('global.unknown')" :subtitle="auth.user?.email">
            <template #leading>
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                {{ initial }}
              </span>
            </template>
          </SettingsListRow>
        </SettingsGroup>

        <!-- Security -->
        <SettingsGroup :title="t('profile.settings.groups.security')">
          <SettingsRow :title="t('profile.change_password')" :description="t('profile.settings.password_sub')">
            <Button variant="outline" size="sm" @click="openChangePassword">
              {{ t("profile.settings.change") }}
            </Button>
          </SettingsRow>
          <SettingsRow :title="t('profile.logout_all_devices')" :description="t('profile.settings.logout_all_sub')">
            <Button variant="outline" size="sm" @click="logoutAllDevices">
              <LogOut />
              {{ t("profile.settings.sign_out_all") }}
            </Button>
          </SettingsRow>
        </SettingsGroup>

        <!-- API keys -->
        <SettingsGroup :title="t('profile.api_keys')">
          <template #actions>
            <Button variant="outline" size="sm" @click="openCreateApiKey">
              <Plus />
              {{ t("profile.api_key_create") }}
            </Button>
          </template>

          <div v-if="apiKeysLoading && !apiKeys.length" class="p-4 text-sm text-muted-foreground">
            {{ t("global.loading") }}
          </div>
          <SettingsListRow
            v-else-if="!apiKeys.length"
            :title="t('profile.no_api_keys')"
            :subtitle="t('profile.settings.no_api_keys_sub')"
          >
            <template #icon><KeyRound /></template>
          </SettingsListRow>
          <SettingsListRow v-for="k in apiKeys" :key="k.id" :title="k.name">
            <template #icon><KeyRound /></template>
            <template #subtitle>
              {{ t("profile.api_key_created") }}
              <DateTime format="relative" datetime-type="time" :date="k.createdAt" />
              ·
              {{ t("profile.api_key_last_used") }}
              <DateTime v-if="k.lastUsedAt" format="relative" datetime-type="time" :date="k.lastUsedAt" />
              <template v-else>{{ t("profile.api_key_never_used").toLowerCase() }}</template>
            </template>
            <span
              class="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground max-sm:hidden"
            >
              <template v-if="k.expiresAt">
                {{ t("profile.api_key_expires_at") }}&nbsp;<DateTime
                  format="human"
                  datetime-type="date"
                  :date="k.expiresAt"
                />
              </template>
              <template v-else>{{ t("profile.settings.api_key_never_expires") }}</template>
            </span>
            <template #menu>
              <DropdownMenuItem class="text-destructive focus:text-destructive" @select="revokeApiKey(k)">
                <Trash2 /> {{ t("profile.settings.revoke") }}
              </DropdownMenuItem>
            </template>
          </SettingsListRow>
        </SettingsGroup>

        <!-- Language & region -->
        <SettingsGroup :title="t('profile.settings.groups.language')">
          <SettingsRow for="language" :title="t('profile.language')" :description="t('profile.settings.language_sub')">
            <Select :model-value="locale" @update:model-value="setLanguage">
              <SelectTrigger id="language" class="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="lang in availableLocales" :key="lang" :value="lang">
                  {{ t(`languages.${lang}`) }} ({{ t(`languages.${lang}`, 1, { locale: lang }) }})
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            for="format-locale"
            :title="t('profile.override_locale')"
            :description="t('profile.settings.format_locale_sub')"
          >
            <div class="flex w-full flex-col gap-1.5">
              <Select v-model="formatLocale">
                <SelectTrigger id="format-locale" class="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{{ t("profile.no_override") }}</SelectItem>
                  <SelectItem v-for="l in formatLocales" :key="l.code" :value="l.code">
                    {{ l.name }} · {{ l.localName }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span class="text-[12.5px] text-muted-foreground">
                {{ t("collection.settings.preview") }}
                <span class="ml-1 text-foreground">{{ t("global.created") }} {{ dateExample }}</span>
              </span>
            </div>
          </SettingsRow>
          <SettingsRow
            for="measurement-system"
            :title="t('profile.measurement_system')"
            :description="t('profile.settings.measurement_sub')"
          >
            <Select v-model="measurementSystem">
              <SelectTrigger id="measurement-system" class="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {{ t("profile.measurement_auto", { system: t(`profile.measurement_${localeSystem}`) }) }}
                </SelectItem>
                <SelectItem value="metric">{{ t("profile.measurement_metric") }}</SelectItem>
                <SelectItem value="imperial">{{ t("profile.measurement_imperial") }}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsGroup>

        <!-- Appearance -->
        <SettingsGroup :title="t('profile.settings.groups.appearance')">
          <SettingsRow
            for="image-fill"
            :title="t('profile.settings.image_fill')"
            :description="t('profile.settings.image_fill_sub')"
          >
            <Switch id="image-fill" v-model="preferences.legacyImageFit" />
          </SettingsRow>
        </SettingsGroup>

        <!-- Duplicating items -->
        <SettingsGroup :title="t('profile.settings.groups.duplicate')" :hint="t('profile.settings.duplicate_hint')">
          <SettingsRow
            for="copy-maintenance"
            :title="t('items.duplicate.copy_maintenance')"
            :description="t('profile.settings.copy_maintenance_sub')"
          >
            <Switch id="copy-maintenance" v-model="duplicate.copyMaintenance" />
          </SettingsRow>
          <SettingsRow
            for="copy-attachments"
            :title="t('items.duplicate.copy_attachments')"
            :description="t('profile.settings.copy_attachments_sub')"
          >
            <Switch id="copy-attachments" v-model="duplicate.copyAttachments" />
          </SettingsRow>
          <SettingsRow
            for="copy-custom-fields"
            :title="t('items.duplicate.copy_custom_fields')"
            :description="t('profile.settings.copy_custom_fields_sub')"
          >
            <Switch id="copy-custom-fields" v-model="duplicate.copyCustomFields" />
          </SettingsRow>
          <SettingsRow
            for="copy-prefix"
            align="start"
            :title="t('items.duplicate.custom_prefix')"
            :description="t('profile.settings.custom_prefix_sub')"
          >
            <div class="flex w-full items-center gap-3">
              <Input
                id="copy-prefix"
                v-model="prefix"
                :disabled="!customPrefix"
                :placeholder="t('items.duplicate.prefix')"
                class="h-9"
              />
              <Switch v-model="customPrefix" :aria-label="t('items.duplicate.enable_custom_prefix')" />
            </div>
          </SettingsRow>
        </SettingsGroup>

        <!-- Danger zone -->
        <SettingsGroup :title="t('profile.settings.groups.danger')">
          <SettingsRow :title="t('profile.delete_account')" :description="t('profile.settings.delete_sub')">
            <Button variant="destructive" size="sm" @click="deleteProfile">
              <Trash2 />
              {{ t("profile.delete_account") }}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>
    </div>

    <!-- Dialogs -->
    <Dialog :dialog-id="DialogID.ChangePassword">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("profile.change_password") }}</DialogTitle>
        </DialogHeader>

        <form id="change-password-form" name="change-password" method="post" @submit.prevent="changePassword">
          <FormPassword
            id="current-password"
            v-model="passwordChange.current"
            :label="t('profile.current_password')"
            name="current-password"
            autocomplete="current-password"
            placeholder=""
            :required="true"
            class="mb-2"
          />
          <FormPassword
            id="new-password"
            v-model="passwordChange.new"
            :label="t('profile.new_password')"
            name="new-password"
            autocomplete="new-password"
            placeholder=""
            :min-length="PASSWORD_MIN_LENGTH"
            :passwordrules="PASSWORD_RULES"
            :required="true"
          />
          <PasswordScore v-model:valid="passwordChange.isValid" :password="passwordChange.new" />

          <DialogFooter>
            <Button :disabled="!passwordChange.isValid || passwordChange.loading" type="submit">
              <LoaderCircle v-if="passwordChange.loading" class="animate-spin" />
              {{ t("global.submit") }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :dialog-id="DialogID.CreateApiKey">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("profile.api_key_create") }}</DialogTitle>
        </DialogHeader>

        <form @submit.prevent="submitCreateApiKey">
          <FormTextField
            v-model="apiKeyForm.name"
            :label="t('profile.api_key_name')"
            :placeholder="t('profile.api_key_name_placeholder')"
            :required="true"
            class="mb-2"
          />
          <div class="mb-2 max-w-65">
            <FormCheckbox v-model="apiKeyForm.setExpiration" :label="t('profile.api_key_set_expiration')" />
          </div>
          <p v-if="!apiKeyForm.setExpiration" class="mb-2 text-sm text-muted-foreground">
            {{ t("profile.api_key_default_expiration") }}
          </p>
          <div v-if="apiKeyForm.setExpiration" class="mb-2">
            <FormDatePicker
              :model-value="apiKeyForm.expiresAt"
              :label="t('profile.api_key_expires_at')"
              :clearable="false"
              @update:model-value="v => (apiKeyForm.expiresAt = typeof v === 'string' ? v : '')"
            />
          </div>

          <DialogFooter>
            <Button :disabled="apiKeyForm.submitting || !apiKeyForm.name.trim()" type="submit">
              <LoaderCircle v-if="apiKeyForm.submitting" class="animate-spin" />
              {{ t("global.create") }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :dialog-id="DialogID.CreateApiKeyResult">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("profile.api_key_token_label") }}</DialogTitle>
        </DialogHeader>

        <p class="text-sm text-muted-foreground">{{ t("profile.api_key_token_warning") }}</p>

        <div class="flex items-center gap-2">
          <Input
            :model-value="newApiKeyToken ?? ''"
            readonly
            class="font-mono"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <Button variant="outline" size="icon" :aria-label="t('profile.api_key_copy')" @click="copyApiKey">
            <Copy />
          </Button>
        </div>

        <DialogFooter>
          <Button @click="dismissApiKeyResult">{{ t("global.close") }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
