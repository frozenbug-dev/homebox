<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { X } from "@lucide/vue";
  import type { DialogID } from "@/components/ui/dialog-provider/utils";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
  import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
  import { Switch } from "@/components/ui/switch";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import { cn } from "@/lib/utils";

  /**
   * The shell every "New …" dialog shares, after Linear's new-issue modal:
   * a breadcrumb bar, a borderless name and description, a row of property
   * chips and a footer with a "Create more" switch and the create button.
   * A bottom sheet on phones.
   */
  const props = withDefaults(
    defineProps<{
      dialogId: DialogID;
      /** Read out as the dialog's name. */
      title: string;
      submitLabel: string;
      loading?: boolean;
      size?: "md" | "sm";
    }>(),
    { loading: false, size: "md" }
  );

  /** `keepOpen` is the "Create more" switch: create, clear the form and stay. */
  const emit = defineEmits<{ submit: [keepOpen: boolean] }>();

  defineSlots<{
    crumb(): unknown;
    "header-actions"?(): unknown;
    default(): unknown;
    chips?(): unknown;
    after?(): unknown;
    "footer-left"?(): unknown;
  }>();

  const { t } = useI18n();
  const { closeDialog, activeDialog } = useDialog();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Remembered per dialog, like Linear.
  const createMore = useLocalStorage(`homebox:create-more:${props.dialogId}`, false);

  function submit() {
    if (!props.loading) emit("submit", createMore.value);
  }

  /**
   * ⌘/Ctrl+Enter creates from anywhere while the dialog is open, including
   * the description and the chip pickers (which render outside the dialog).
   */
  // Capture phase, so a focused control (the switch, a button) doesn't act on the Enter first.
  useEventListener(
    document,
    "keydown",
    (e: KeyboardEvent) => {
      if (activeDialog.value !== props.dialogId) return;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }
    },
    { capture: true }
  );
</script>

<template>
  <component :is="isDesktop ? Dialog : Drawer" :dialog-id="dialogId">
    <component
      :is="isDesktop ? DialogContent : DrawerContent"
      :class="
        cn(
          isDesktop &&
            'top-[12dvh] flex translate-y-0 flex-col gap-0 overflow-visible rounded-xl p-0 shadow-2xl [&>button:last-child]:hidden',
          isDesktop && (size === 'sm' ? 'sm:max-w-130' : 'sm:max-w-170'),
          !isDesktop && 'max-h-[92dvh]'
        )
      "
    >
      <component :is="isDesktop ? DialogTitle : DrawerTitle" class="sr-only">{{ title }}</component>
      <component :is="isDesktop ? DialogDescription : DrawerDescription" class="sr-only">
        {{ t("shell.create.description") }}
      </component>

      <form class="flex min-h-0 flex-col" @submit.prevent="submit">
        <!-- Breadcrumb bar -->
        <div class="flex h-12 shrink-0 items-center gap-1.5 pr-3 pl-3.5 max-md:pr-1.5 max-md:pl-4">
          <slot name="crumb" />
          <span class="flex-1" />
          <slot name="header-actions" />
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-11"
            :aria-label="t('global.close')"
            @click="closeDialog(dialogId)"
          >
            <X class="size-4 max-md:size-5" />
          </button>
        </div>

        <div class="min-h-0 overflow-y-auto">
          <div class="flex flex-col gap-1.5 px-5 pt-1.5 pb-3.5 max-md:px-4">
            <slot />
          </div>
          <div v-if="$slots.chips" class="flex flex-wrap gap-1.5 px-5 pb-4 max-md:gap-2 max-md:px-4">
            <slot name="chips" />
          </div>
          <slot name="after" />
        </div>

        <!-- Footer -->
        <div
          class="flex h-13 shrink-0 items-center gap-0.5 border-t border-border pr-3 pl-3.5 max-md:h-auto max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-2 max-md:px-4 max-md:py-3"
        >
          <slot name="footer-left" />
          <span class="flex-1" />
          <label
            class="mr-3 flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none max-md:mr-0 max-md:min-h-11"
          >
            <Switch
              v-model="createMore"
              class="h-4 w-[26px] [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-2.5"
            />
            {{ t("shell.create.create_more") }}
          </label>
          <button
            type="submit"
            :disabled="loading"
            class="inline-flex h-8 items-center gap-2 rounded-lg bg-primary pr-2 pl-3 text-[13px] font-medium whitespace-nowrap text-primary-foreground hover:bg-primary/90 disabled:opacity-60 max-md:order-last max-md:h-11 max-md:w-full max-md:justify-center max-md:text-[15px]"
          >
            {{ submitLabel }}
            <ShortcutHint
              hotkey="Mod+Enter"
              class="max-md:hidden [&_kbd]:bg-primary-foreground/20 [&_kbd]:text-primary-foreground"
            />
          </button>
        </div>
      </form>
    </component>
  </component>
</template>
