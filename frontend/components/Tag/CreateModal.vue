<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ChevronRight, CornerDownRight, Pipette } from "@lucide/vue";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import { useDialog, useDialogHotkey } from "~/components/ui/dialog-provider";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import CreateDialog from "~/components/Create/Dialog.vue";
  import CreateChip from "~/components/Create/Chip.vue";
  import OptionPicker, { type PickerOption } from "~/components/Create/OptionPicker.vue";
  import { getIconComponent } from "~/lib/icons";
  import IconSelector from "~/components/Form/IconSelector.vue";
  import { useTagStore } from "~/stores/tags";

  const { t } = useI18n();

  const { closeDialog, registerOpenDialogCallback } = useDialog();
  const tagStore = useTagStore();
  const api = useUserApi();

  useDialogHotkey(DialogID.CreateTag, { code: "Digit3", shift: true });

  /** Preset colours; "custom" opens the system colour picker. */
  const SWATCHES = [
    { name: "sage", value: "#4c7055" },
    { name: "amber", value: "#d97706" },
    { name: "red", value: "#dc2626" },
    { name: "pink", value: "#db2777" },
    { name: "violet", value: "#7c3aed" },
    { name: "blue", value: "#2563eb" },
    { name: "teal", value: "#0d9488" },
    { name: "slate", value: "#64748b" },
  ];

  const loading = ref(false);
  const nameInput = ref<HTMLInputElement | null>(null);
  const form = reactive({
    name: "",
    description: "",
    color: "",
    icon: "",
    parentId: null as string | null,
  });

  onMounted(async () => {
    await tagStore.ensureAllTagsFetched();
    const cleanup = registerOpenDialogCallback(DialogID.CreateTag, () => {
      nextTick(() => nameInput.value?.focus());
    });
    onUnmounted(cleanup);
  });

  const parentOptions = computed<PickerOption[]>(() =>
    tagStore.tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color ?? "",
    }))
  );
  const parentTag = computed(() => tagStore.tags.find(tag => tag.id === form.parentId));

  const icon = computed(() => getIconComponent(form.icon));
  const isCustomColor = computed(() => !!form.color && !SWATCHES.some(s => s.value === form.color));
  /** A light wash of the tag colour behind its icon, like the tag rows. */
  const tileStyle = computed(() =>
    form.color
      ? {
          backgroundColor: `color-mix(in srgb, ${form.color} 16%, transparent)`,
          color: form.color,
        }
      : undefined
  );

  function reset() {
    form.name = "";
    form.description = "";
    form.color = "";
    form.icon = "";
    form.parentId = null;
    loading.value = false;
  }

  async function create(close = true) {
    if (loading.value) {
      toast.error(t("components.tag.create_modal.toast.already_creating"));
      return;
    }
    if (!form.name.trim()) {
      nameInput.value?.focus();
      return;
    }
    if (form.name.length > 50) {
      toast.error(t("components.tag.create_modal.toast.tag_name_too_long"));
      return;
    }

    loading.value = true;

    const { error, data } = await api.tags.create({
      name: form.name,
      description: form.description,
      color: form.color,
      icon: form.icon,
      parentId: form.parentId ?? undefined,
    });

    if (error) {
      toast.error(t("components.tag.create_modal.toast.create_failed"));
      loading.value = false;
      return;
    }

    toast.success(t("components.tag.create_modal.toast.create_success"));
    // "Create more" keeps the parent, so a run of sibling tags is quick.
    const keepParent = form.parentId;
    reset();

    if (close) {
      closeDialog(DialogID.CreateTag);
      await navigateTo(`/tags?tag=${data.id}`);
    } else {
      form.parentId = keepParent;
      nameInput.value?.focus();
    }
  }
</script>

<template>
  <CreateDialog
    :dialog-id="DialogID.CreateTag"
    :title="t('components.tag.create_modal.title')"
    :submit-label="t('shell.create.create_tag')"
    :loading="loading"
    size="sm"
    @submit="keepOpen => create(!keepOpen)"
  >
    <template #crumb>
      <span class="text-[13px] text-muted-foreground">{{ t("global.tags") }}</span>
      <ChevronRight class="size-3.5 text-muted-foreground/60" aria-hidden="true" />
      <span class="text-[13px] text-muted-foreground">{{ t("shell.create.new_tag") }}</span>
    </template>

    <div class="flex gap-3">
      <Popover>
        <PopoverTrigger as-child>
          <button
            type="button"
            class="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-muted text-muted-foreground ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:ring-2 data-[state=open]:ring-primary"
            :style="tileStyle"
            :aria-label="t('shell.create.colour_icon')"
          >
            <component :is="icon" class="size-[18px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="flex w-75 flex-col gap-2.5 p-2.5">
          <span class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {{ t("shell.create.colour") }}
          </span>
          <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('shell.create.colour')">
            <button
              type="button"
              class="size-[22px] rounded-full text-muted-foreground swatch-none"
              :class="{
                'ring-2 ring-foreground/40 ring-offset-2 ring-offset-background': !form.color,
              }"
              :aria-label="t('shell.create.no_colour')"
              :title="t('shell.create.no_colour')"
              :aria-pressed="!form.color"
              @click="form.color = ''"
            />
            <button
              v-for="s in SWATCHES"
              :key="s.value"
              type="button"
              class="size-[22px] rounded-full"
              :class="{
                'ring-2 ring-offset-2 ring-offset-background': form.color === s.value,
              }"
              :style="{ backgroundColor: s.value, '--tw-ring-color': s.value }"
              :aria-label="t(`shell.create.swatch.${s.name}`)"
              :aria-pressed="form.color === s.value"
              @click="form.color = s.value"
            />
            <label
              class="relative flex size-[22px] cursor-pointer items-center justify-center rounded-full text-white"
              :class="{
                'ring-2 ring-offset-2 ring-offset-background': isCustomColor,
              }"
              :style="{
                background: isCustomColor
                  ? form.color
                  : 'conic-gradient(#dc2626, #d97706, #16a34a, #2563eb, #7c3aed, #dc2626)',
                '--tw-ring-color': isCustomColor ? form.color : undefined,
              }"
              :title="t('shell.create.custom_colour')"
            >
              <Pipette class="size-3" aria-hidden="true" />
              <input
                type="color"
                class="absolute inset-0 cursor-pointer opacity-0"
                :value="form.color || '#4c7055'"
                :aria-label="t('shell.create.custom_colour')"
                @input="form.color = ($event.target as HTMLInputElement).value"
              />
            </label>
          </div>
          <div class="-mx-2.5 h-px bg-border" />
          <span class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {{ t("shell.create.icon") }}
          </span>
          <IconSelector v-model="form.icon" :autofocus="false" />
        </PopoverContent>
      </Popover>

      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          ref="nameInput"
          v-model="form.name"
          :placeholder="t('shell.create.tag_name_placeholder')"
          :aria-label="t('components.tag.create_modal.tag_name')"
          maxlength="50"
          class="h-9 w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-[-0.01em] caret-primary outline-none placeholder:text-muted-foreground/80"
        />
        <textarea
          v-model="form.description"
          :placeholder="t('shell.create.description_placeholder')"
          :aria-label="t('components.tag.create_modal.tag_description')"
          maxlength="1000"
          rows="2"
          class="field-sizing-content max-h-40 min-h-[42px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-normal outline-none placeholder:text-muted-foreground/80 max-md:text-base"
        />
      </div>
    </div>

    <template #chips>
      <div class="flex flex-wrap gap-1.5 pl-12">
        <CreateChip
          :label="t('shell.create.no_parent_tag')"
          :icon="CornerDownRight"
          :filled="!!parentTag"
          :prefix="t('shell.create.inside')"
        >
          <template #value>
            <span
              class="size-2 rounded-full"
              :style="{
                backgroundColor: parentTag?.color || 'hsl(var(--muted-foreground) / 0.5)',
              }"
              aria-hidden="true"
            />
            <span class="truncate">{{ parentTag?.name }}</span>
          </template>
          <template #default="{ close }">
            <OptionPicker
              v-model="form.parentId"
              :options="parentOptions"
              :none-label="t('shell.create.no_parent_tag')"
              @close="close"
            />
          </template>
        </CreateChip>
      </div>
    </template>

    <template #footer-left>
      <span
        v-if="form.name"
        class="ml-1.5 inline-flex h-[22px] max-w-48 items-center gap-1.5 rounded-full border border-border px-2 text-xs max-md:hidden"
      >
        <component :is="icon" class="size-3 shrink-0" :style="form.color ? { color: form.color } : undefined" />
        <span class="truncate">{{ form.name }}</span>
      </span>
    </template>
  </CreateDialog>
</template>
