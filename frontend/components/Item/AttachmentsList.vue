<template>
  <ul role="list" class="flex flex-col gap-2">
    <li
      v-for="attachment in attachments"
      :key="attachment.id"
      class="group relative flex items-center gap-3 rounded-lg border border-border bg-card py-2 pr-2 pl-3 text-sm transition-colors hover:bg-muted/40"
    >
      <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <component :is="attachmentIcon(attachment)" class="size-4" aria-hidden="true" />
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <!-- With a preview the whole card opens it (the button's ::after covers the row) -->
        <button
          v-if="preview"
          type="button"
          class="truncate text-left font-medium after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          @click="emit('open', attachment)"
        >
          {{ attachment.title }}
        </button>
        <a
          v-else
          class="truncate font-medium hover:underline"
          :href="hrefFor(attachment)"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ attachment.title }}
        </a>
        <span v-if="typeLabel(attachment)" class="text-xs text-muted-foreground">{{ typeLabel(attachment) }}</span>
      </div>

      <div class="relative flex shrink-0 items-center gap-0.5">
        <TooltipProvider :delay-duration="0">
          <Tooltip v-if="!isExternal(attachment)">
            <TooltipTrigger as-child>
              <a
                :class="iconButton"
                :href="hrefFor(attachment)"
                :download="attachment.title"
                :aria-label="$t('components.item.attachments_list.download')"
              >
                <Download class="size-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              {{ $t("components.item.attachments_list.download") }}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <a
                :class="iconButton"
                :href="hrefFor(attachment)"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="$t('components.item.attachments_list.open_new_tab')"
              >
                <ExternalLink class="size-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              {{ $t("components.item.attachments_list.open_new_tab") }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Download, ExternalLink } from "@lucide/vue";
  import type { ItemAttachment } from "~~/lib/api/types/data-contracts";
  import { attachmentIcon } from "~~/lib/attachment-icon";
  import { buttonVariants } from "@/components/ui/button";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  const props = withDefaults(
    defineProps<{
      attachments: ItemAttachment[];
      itemId: string;
      /** Clicking a card emits `open` (for the preview dialog) instead of following the link. */
      preview?: boolean;
    }>(),
    { preview: false }
  );

  const emit = defineEmits<{ open: [attachment: ItemAttachment] }>();

  const { t } = useI18n();
  const api = useUserApi();

  const iconButton = buttonVariants({
    variant: "ghost",
    size: "icon",
    class: "size-8 text-muted-foreground hover:text-foreground",
  });

  function isExternal(attachment: ItemAttachment) {
    return (
      attachment.mimeType === "link/url" ||
      attachment.path.startsWith("http://") ||
      attachment.path.startsWith("https://")
    );
  }

  function hrefFor(attachment: ItemAttachment) {
    return isExternal(attachment)
      ? attachment.path
      : api.authURL(`/entities/${props.itemId}/attachments/${attachment.id}`);
  }

  /** Manuals, warranties and receipts get a caption; plain attachments don't need one. */
  function typeLabel(attachment: ItemAttachment) {
    switch (attachment.type) {
      case "manual":
        return t("items.manual");
      case "warranty":
        return t("items.warranty");
      case "receipt":
        return t("items.receipt");
      default:
        return "";
    }
  }
</script>
