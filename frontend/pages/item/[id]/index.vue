<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useQueryClient } from "@tanstack/vue-query";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import {
    ChevronDown,
    ChevronUp,
    CopyPlus,
    Ellipsis,
    LayoutTemplate,
    Link as LinkIcon,
    Plus,
    Trash2,
  } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import type { AnyDetail, Detail, Details } from "~~/components/global/DetailsSection/types";
  import { filterZeroValues } from "~~/components/global/DetailsSection/types";
  import type { EntityPatch, EntityUpdate, ItemAttachment } from "~~/lib/api/types/data-contracts";
  import { templateField } from "~~/lib/api/template-fields";
  import { toEntityUpdate } from "~/lib/entity-update";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import ItemImageDialog from "~/components/Item/ImageDialog.vue";
  import ItemDuplicateSettings from "~/components/Item/DuplicateSettings.vue";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import PageQRCode from "~/components/global/PageQRCode.vue";
  import LabelTemplatePrintButton from "~/components/LabelTemplate/PrintButton.vue";
  import DetailsSection from "~/components/global/DetailsSection/DetailsSection.vue";
  import ItemAttachmentsList from "~/components/Item/AttachmentsList.vue";
  import ItemViewSelectable from "~/components/Item/View/Selectable.vue";
  import PropertiesPanel from "~/components/Item/PropertiesPanel.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import InlineMarkdown from "~/components/Item/Inline/Markdown.vue";

  const { t } = useI18n();

  const { openDialog, closeDialog } = useDialog();

  definePageMeta({
    middleware: ["auth"],
  });

  const route = useRoute();
  const router = useRouter();
  const api = useUserApi();
  const queryClient = useQueryClient();

  const itemId = computed<string>(() => route.params.id as string);
  const preferences = useViewPreferences();

  const temporaryDuplicateSettings = ref<DuplicateSettings>({
    copyMaintenance: preferences.value.duplicateSettings.copyMaintenance,
    copyAttachments: preferences.value.duplicateSettings.copyAttachments,
    copyCustomFields: preferences.value.duplicateSettings.copyCustomFields,
    copyPrefixOverride: preferences.value.duplicateSettings.copyPrefixOverride,
  });

  /** True on the Maintenance and Edit sub-pages, which render through <NuxtPage>. */
  const hasNested = computed<boolean>(() => {
    return route.fullPath.split("/").at(-1) !== itemId.value;
  });

  const { data: item, refresh } = useAsyncData(
    () => `item-${itemId.value}`,
    async () => {
      const { data, error } = await api.items.get(itemId.value);
      if (error) {
        toast.error(t("items.toast.failed_load_item"));
        navigateTo("/home");
        return;
      }
      return data;
    }
  );
  onMounted(() => {
    refresh();
  });

  const lastRoute = ref(route.fullPath);
  watchEffect(() => {
    if (lastRoute.value.endsWith("edit")) {
      refresh();
    }

    lastRoute.value = route.fullPath;
  });

  // ----- Saving single fields -----

  function saved(data: NonNullable<typeof item.value>) {
    item.value = data;
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  }

  /** Quantity, place and tags go through PATCH. */
  async function patch(changes: Omit<EntityPatch, "id">) {
    const { data, error } = await api.items.patch(itemId.value, { id: itemId.value, ...changes });
    if (error) {
      toast.error(t("items.toast.failed_save"));
      return;
    }
    saved(data);
  }

  /** Everything else is a full PUT built from the current item, shown optimistically. */
  async function update(changes: Partial<EntityUpdate>) {
    const prev = item.value;
    if (!prev) return;
    item.value = { ...prev, ...changes } as typeof prev;
    const { data, error } = await api.items.update(itemId.value, toEntityUpdate(prev, changes));
    if (error) {
      item.value = prev;
      toast.error(t("items.toast.failed_save"));
      return;
    }
    saved(data);
  }

  async function setQuantity(quantity: number) {
    if (!item.value || !Number.isFinite(quantity)) return;
    if (quantity < 0) {
      toast.error(t("items.toast.quantity_cannot_negative"));
      return;
    }
    item.value = { ...item.value, quantity };
    await patch({ quantity });
  }

  const placePickerOpen = ref(false);
  const wide = useMediaQuery("(min-width: 1024px)");

  // ----- Header, neighbours and shortcuts -----

  const neighbours = useEntityNeighbours(itemId);

  function go(target?: { id: string }) {
    if (target) router.push(`/item/${target.id}`);
  }

  const itemMeta = (name: string) => ({ meta: { name: t(name), group: "item" as const } });
  const onDetails = () => !hasNested.value && !!item.value;

  useHotkey(SHORTCUTS.itemPrevious, () => go(neighbours.value?.prev), {
    ...itemMeta("shell.shortcuts.item_previous"),
    enabled: () => onDetails() && !!neighbours.value?.prev,
  });
  useHotkey(SHORTCUTS.itemNext, () => go(neighbours.value?.next), {
    ...itemMeta("shell.shortcuts.item_next"),
    enabled: () => onDetails() && !!neighbours.value?.next,
  });
  useHotkey(SHORTCUTS.itemMove, () => (placePickerOpen.value = true), {
    ...itemMeta("shell.shortcuts.item_move"),
    enabled: onDetails,
  });
  useHotkey(SHORTCUTS.itemPrint, () => printLabel(), {
    ...itemMeta("shell.shortcuts.item_print"),
    enabled: onDetails,
  });
  useHotkey(SHORTCUTS.itemDuplicate, () => duplicateItem(), {
    ...itemMeta("shell.shortcuts.item_duplicate"),
    enabled: onDetails,
  });

  function printLabel() {
    openDialog(DialogID.PrintLabelTemplate, { params: { itemIds: [itemId.value] } });
  }

  const { copy } = useClipboard();
  function copyLink() {
    copy(window.location.href);
    toast.success(t("shell.item_page.link_copied"));
  }

  type FilteredAttachments = {
    attachments: ItemAttachment[];
    warranty: ItemAttachment[];
    manuals: ItemAttachment[];
    receipts: ItemAttachment[];
  };

  type Photo = {
    thumbnailSrc?: string;
    originalSrc: string;
    attachmentId: string;
    originalType?: string;
  };

  const photos = computed<Photo[]>(() => {
    if (!item.value) {
      return [];
    }
    return (
      item.value.attachments.reduce((acc, cur) => {
        if (cur.type === "photo") {
          const photo: Photo = {
            originalSrc: api.authURL(`/entities/${item.value!.id}/attachments/${cur.id}`),
            originalType: cur.mimeType,
            attachmentId: cur.id,
          };
          if (cur.thumbnail) {
            photo.thumbnailSrc = api.authURL(`/entities/${item.value!.id}/attachments/${cur.thumbnail.id}`);
          } else {
            photo.thumbnailSrc = photo.originalSrc; // fallback to itself if no thumbnail
          }
          acc.push(photo);
        }
        return acc;
      }, [] as Photo[]) || []
    );
  });

  const attachments = computed<FilteredAttachments>(() => {
    if (!item.value) {
      return {
        attachments: [],
        manuals: [],
        warranty: [],
        receipts: [],
      };
    }

    return item.value.attachments.reduce(
      (acc, attachment) => {
        if (attachment.type === "photo") {
          return acc;
        }
        if (attachment.type === "warranty") {
          acc.warranty.push(attachment);
        } else if (attachment.type === "manual") {
          acc.manuals.push(attachment);
        } else if (attachment.type === "receipt") {
          acc.receipts.push(attachment);
        } else {
          acc.attachments.push(attachment);
        }
        return acc;
      },
      {
        attachments: [] as ItemAttachment[],
        warranty: [] as ItemAttachment[],
        manuals: [] as ItemAttachment[],
        receipts: [] as ItemAttachment[],
      }
    );
  });

  /** The item's custom fields; URLs in values become links. */
  const customFields = computed<Details>(() => {
    if (!item.value) {
      return [];
    }

    const ret: Details = item.value.fields.map(field => {
      const url = maybeUrl(field.textValue);
      if (url.isUrl) {
        return {
          type: "link",
          name: field.name,
          text: url.text,
          href: url.url,
        } as AnyDetail;
      }

      return {
        name: field.name,
        text: field.textValue,
      };
    });

    if (!preferences.value.showEmpty) {
      return filterZeroValues(ret);
    }

    return ret;
  });

  const showAttachments = computed(() => {
    if (preferences.value?.showEmpty) {
      return true;
    }

    return (
      attachments.value.attachments.length > 0 ||
      attachments.value.warranty.length > 0 ||
      attachments.value.manuals.length > 0 ||
      attachments.value.receipts.length > 0
    );
  });

  const attachmentDetails = computed(() => {
    const details: Detail[] = [];

    const push = (name: string, slot: string) => {
      details.push({
        name,
        text: "",
        slot,
      });
    };

    if (attachments.value.attachments.length > 0) {
      push("items.attachments", "attachments");
    }

    if (attachments.value.warranty.length > 0) {
      push("items.warranty", "warranty");
    }

    if (attachments.value.manuals.length > 0) {
      push("items.manuals", "manuals");
    }

    if (attachments.value.receipts.length > 0) {
      push("items.receipts", "receipts");
    }

    return details;
  });

  const showWarranty = computed(() => {
    if (preferences.value.showEmpty) {
      return true;
    }
    return item.value?.lifetimeWarranty || validDate(item.value?.warrantyExpires);
  });

  const warrantyDetails = computed(() => {
    const details: Details = [
      {
        name: "items.lifetime_warranty",
        text: item.value?.lifetimeWarranty ? "Yes" : "No",
      },
    ];

    if (item.value?.lifetimeWarranty) {
      details.push({
        name: "items.warranty_expires",
        text: "N/A",
      });
    } else {
      details.push({
        name: "items.warranty_expires",
        text: item.value?.warrantyExpires || "",
        type: "date",
        date: true,
      });
    }

    details.push({
      name: "items.warranty_details",
      type: "markdown",
      text: item.value?.warrantyDetails || "",
    });

    if (!preferences.value.showEmpty) {
      return filterZeroValues(details);
    }

    return details;
  });

  const showPurchase = computed(() => {
    if (preferences.value.showEmpty) {
      return true;
    }
    return item.value?.purchaseFrom || item.value?.purchasePrice !== 0 || validDate(item.value?.purchaseDate);
  });

  const purchaseDetails = computed<Details>(() => {
    const v: Details = [
      {
        name: "items.purchased_from",
        text: item.value?.purchaseFrom || "",
      },
      {
        name: "items.purchase_price",
        text: String(item.value?.purchasePrice) || "",
        type: "currency",
      },
      {
        name: "items.purchase_date",
        text: item.value?.purchaseDate || "",
        type: "date",
        date: true,
      },
    ];

    if (!preferences.value.showEmpty) {
      return filterZeroValues(v);
    }

    return v;
  });

  const showSold = computed(() => {
    if (preferences.value.showEmpty) {
      return true;
    }
    return (
      item.value?.soldTo || item.value?.soldPrice !== 0 || validDate(item.value?.soldDate) || item.value?.soldNotes
    );
  });

  const soldDetails = computed<Details>(() => {
    const v: Details = [
      {
        name: "items.sold_to",
        text: item.value?.soldTo || "",
      },
      {
        name: "items.sold_price",
        text: String(item.value?.soldPrice) || "",
        type: "currency",
      },
      {
        name: "items.sold_at",
        text: item.value?.soldDate || "",
        type: "date",
        date: true,
      },
      {
        name: "items.sold_notes",
        type: "markdown",
        text: item.value?.soldNotes || "",
      },
    ];

    if (!preferences.value.showEmpty) {
      return filterZeroValues(v);
    }

    return v;
  });

  function openImageDialog(img: Photo, itemId: string) {
    openDialog(DialogID.ItemImage, {
      params: {
        type: "preloaded",
        originalSrc: img.originalSrc,
        originalType: img.originalType,
        thumbnailSrc: img.thumbnailSrc,
        attachmentId: img.attachmentId,
        itemId,
      },
      onClose: result => {
        if (result?.action === "delete") {
          item.value!.attachments = item.value!.attachments.filter(a => a.id !== result.id);
        }
      },
    });
  }

  const tabs = computed(() => {
    return [
      {
        id: "details",
        name: "global.details",
        to: `/item/${itemId.value}`,
      },
      {
        id: "log",
        name: "global.maintenance",
        to: `/item/${itemId.value}/maintenance`,
      },
      {
        id: "edit",
        name: "global.edit",
        to: `/item/${itemId.value}/edit`,
      },
    ];
  });

  const fullpath = computedAsync(async () => {
    if (!item.value) {
      return [];
    }

    const resp = await api.items.fullpath(item.value.id);
    if (resp.error) {
      toast.error(t("items.toast.failed_load_item"));
      return [];
    }

    return resp.data;
  });

  const { data: items, refresh: refreshItemList } = useAsyncData(
    () => itemId.value + "_item_list",
    async () => {
      if (!itemId.value) {
        return [];
      }

      const resp = await api.items.getAll({
        parentIds: [itemId.value],
      });

      if (resp.error) {
        toast.error(t("items.toast.failed_load_items"));
        return [];
      }

      return resp.data.items;
    },
    {
      watch: [itemId],
    }
  );

  async function duplicateItem(settings?: DuplicateSettings) {
    if (!item.value) {
      return;
    }

    const duplicateSettings = settings
      ? {
          copyMaintenance: settings.copyMaintenance,
          copyAttachments: settings.copyAttachments,
          copyCustomFields: settings.copyCustomFields,
          copyPrefix: settings.copyPrefixOverride ?? t("items.duplicate.prefix"),
        }
      : {
          copyMaintenance: preferences.value.duplicateSettings.copyMaintenance,
          copyAttachments: preferences.value.duplicateSettings.copyAttachments,
          copyCustomFields: preferences.value.duplicateSettings.copyCustomFields,
          copyPrefix: preferences.value.duplicateSettings.copyPrefixOverride ?? t("items.duplicate.prefix"),
        };

    const { error, data } = await api.items.duplicate(itemId.value, duplicateSettings);

    if (error) {
      toast.error(t("items.toast.failed_duplicate_item"));
      return;
    }

    navigateTo(`/item/${data.id}`);
  }

  const confirm = useConfirm();

  async function deleteItem() {
    const confirmed = await confirm.open(t("items.delete_item_confirm"));

    if (!confirmed.data) {
      return;
    }

    const { error } = await api.items.delete(itemId.value);
    if (error) {
      toast.error(t("items.toast.failed_delete_item"));
      return;
    }
    toast.success(t("items.toast.item_deleted"));
    navigateTo("/home");
  }

  async function saveAsTemplate() {
    if (!item.value) {
      return;
    }

    // Create template from item data
    const templateData = {
      name: `Template: ${item.value.name}`,
      description: "",
      notes: "",
      defaultName: item.value.name,
      defaultDescription: item.value.description || "",
      defaultQuantity: item.value.quantity,
      defaultInsured: item.value.insured,
      defaultManufacturer: item.value.manufacturer || "",
      defaultModelNumber: item.value.modelNumber || "",
      defaultLifetimeWarranty: item.value.lifetimeWarranty,
      defaultWarrantyDetails: item.value.warrantyDetails || "",
      defaultLocationId: item.value.location?.id || item.value.parent?.id || "",
      defaultTagIds: item.value.tags?.map(l => l.id) || [],
      includeWarrantyFields: !!(
        item.value.warrantyDetails ||
        item.value.lifetimeWarranty ||
        item.value.warrantyExpires
      ),
      includePurchaseFields: !!(item.value.purchaseFrom || item.value.purchasePrice || item.value.purchaseDate),
      includeSoldFields: !!(item.value.soldTo || item.value.soldPrice || item.value.soldDate),
      fields: item.value.fields.map(field => templateField({ name: field.name, textValue: field.textValue || "" })),
    };

    const { data, error } = await api.templates.create(templateData);
    if (error) {
      toast.error(t("components.template.toast.create_failed"));
      return;
    }

    toast.success(t("components.template.toast.saved_as_template", { name: templateData.name }));
    navigateTo(`/template/${data.id}`);
  }

  async function createSubitem() {
    openDialog(DialogID.CreateEntity, {
      params: {
        baseType: "item",
        subItem: true,
      },
    });
  }

  /** Purchase, warranty and sold details, each only when it has something to show. */
  const detailBlocks = computed(() =>
    [
      showPurchase.value && { title: "items.purchase_details", details: purchaseDetails.value },
      showWarranty.value && { title: "items.warranty_details", details: warrantyDetails.value },
      showSold.value && { title: "items.sold_details", details: soldDetails.value },
    ].filter((b): b is { title: string; details: Details } => !!b && b.details.length > 0)
  );

  usePageHeader(() => {
    const parts = fullpath.value ?? [];
    return [
      { label: t("shell.items"), to: "/items" },
      ...parts.slice(0, -1).map(part => ({ label: part.name, to: `/${part.type}/${part.id}` })),
      { label: item.value?.name ?? "" },
    ];
  });
</script>

<template>
  <div v-if="item" class="flex min-h-[calc(100svh-var(--header-height)-1rem)] flex-col">
    <!-- set page title -->
    <Title>{{ item.name }}</Title>

    <ItemImageDialog />
    <Dialog :dialog-id="DialogID.DuplicateTemporarySettings">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t("items.duplicate.temporary_title") }}</DialogTitle>
        </DialogHeader>
        <ItemDuplicateSettings v-model="temporaryDuplicateSettings" />
        <DialogFooter>
          <Button
            @click="
              closeDialog(DialogID.DuplicateTemporarySettings);
              duplicateItem(temporaryDuplicateSettings);
            "
          >
            {{ $t("global.duplicate") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Toolbar: sub-pages on the left, list navigation and actions on the right -->
    <div class="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1.5 sm:px-4">
      <nav class="flex items-center gap-0.5">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.id"
          :to="tab.to"
          class="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          :class="{ 'bg-accent font-medium text-foreground': tab.to === route.path }"
          :aria-current="tab.to === route.path ? 'page' : undefined"
        >
          {{ $t(tab.name) }}
        </NuxtLink>
      </nav>
      <div class="grow" />

      <div v-if="neighbours && !hasNested" class="mr-1 hidden items-center gap-0.5 sm:flex">
        <span class="mr-1 text-xs text-muted-foreground tabular-nums">
          {{ t("shell.item_page.position", { index: neighbours.index + 1, total: neighbours.total }) }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="size-7"
          :disabled="!neighbours.prev"
          :aria-label="t('shell.item_page.previous')"
          @click="go(neighbours.prev)"
        >
          <ChevronUp class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-7"
          :disabled="!neighbours.next"
          :aria-label="t('shell.item_page.next')"
          @click="go(neighbours.next)"
        >
          <ChevronDown class="size-4" />
        </Button>
      </div>

      <LabelTemplatePrintButton :id="item.id" type="item" variant="outline" />
      <PageQRCode variant="ghost" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-8" :aria-label="t('shell.item_page.more')">
            <Ellipsis class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuItem @select="createSubitem">
            <Plus class="size-4" />
            {{ $t("global.create_subitem") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="duplicateItem()">
            <CopyPlus class="size-4" />
            {{ $t("global.duplicate") }}
            <ShortcutHint :hotkey="SHORTCUTS.itemDuplicate" class="ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuItem @select="openDialog(DialogID.DuplicateTemporarySettings)">
            <CopyPlus class="size-4 opacity-0" />
            {{ $t("items.duplicate.temporary_title") }}…
          </DropdownMenuItem>
          <DropdownMenuItem @select="saveAsTemplate">
            <LayoutTemplate class="size-4" />
            {{ $t("components.template.save_as_template") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="copyLink">
            <LinkIcon class="size-4" />
            {{ t("shell.item_page.copy_link") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem v-model="preferences.showEmpty" @select.prevent>
            {{ t("shell.item_page.show_empty") }}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deleteItem">
            <Trash2 class="size-4" />
            {{ $t("global.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Maintenance and Edit -->
    <div v-if="hasNested" class="px-3 py-4 sm:px-6">
      <NuxtPage :item="item" :page-key="itemId" />
    </div>

    <!-- Properties sit beside the content on wide screens and right below the title on narrow ones -->
    <div v-else class="grid flex-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div class="min-w-0 space-y-8 px-4 py-6 sm:px-8">
        <header class="space-y-1">
          <InlineText
            :value="item.name"
            :label="t('items.name')"
            wrap
            class="-mx-1.5 text-2xl font-semibold tracking-tight"
            @save="name => name && update({ name })"
          />
          <InlineMarkdown
            :value="item.description"
            :label="t('items.description')"
            :placeholder="t('shell.item_page.add_description')"
            @save="description => update({ description })"
          />
        </header>

        <div v-if="!wide" class="-mx-4 border-y border-border px-3 py-4 sm:-mx-8 sm:px-6">
          <PropertiesPanel
            v-model:place-open="placePickerOpen"
            :item="item"
            @patch="patch"
            @update="update"
            @quantity="setQuantity"
          />
        </div>
        <section v-if="photos.length > 0" :aria-label="t('items.photos')">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <button
              v-for="img in photos"
              :key="img.attachmentId"
              type="button"
              class="aspect-square overflow-hidden rounded-lg border border-border bg-muted transition-opacity hover:opacity-90"
              @click="openImageDialog(img, item.id)"
            >
              <img class="size-full object-cover" :src="img.thumbnailSrc" :alt="$t('items.photo')" loading="lazy" />
            </button>
          </div>
        </section>

        <section>
          <h2 class="mb-1 text-sm font-medium">{{ $t("items.notes") }}</h2>
          <InlineMarkdown
            :value="item.notes"
            :label="t('items.notes')"
            :placeholder="t('shell.item_page.add_notes')"
            @save="notes => update({ notes })"
          />
        </section>

        <section v-if="customFields.length > 0">
          <h2 class="mb-2 text-sm font-medium">{{ t("shell.item_page.fields") }}</h2>
          <div class="overflow-hidden rounded-lg border border-border [&>div]:border-t-0">
            <DetailsSection :details="customFields" />
          </div>
        </section>

        <section v-if="showAttachments">
          <h2 class="mb-2 text-sm font-medium">{{ $t("items.attachments") }}</h2>
          <div class="overflow-hidden rounded-lg border border-border [&>div]:border-t-0">
            <DetailsSection v-if="attachmentDetails.length > 0" :details="attachmentDetails">
              <template #manuals>
                <ItemAttachmentsList :attachments="attachments.manuals" :item-id="item.id" />
              </template>
              <template #attachments>
                <ItemAttachmentsList :attachments="attachments.attachments" :item-id="item.id" />
              </template>
              <template #warranty>
                <ItemAttachmentsList :attachments="attachments.warranty" :item-id="item.id" />
              </template>
              <template #receipts>
                <ItemAttachmentsList :attachments="attachments.receipts" :item-id="item.id" />
              </template>
            </DetailsSection>
            <p v-else class="px-4 py-3 text-sm text-muted-foreground">{{ $t("items.no_attachments") }}</p>
          </div>
        </section>

        <section v-for="block in detailBlocks" :key="block.title">
          <h2 class="mb-2 text-sm font-medium">{{ $t(block.title) }}</h2>
          <div class="overflow-hidden rounded-lg border border-border [&>div]:border-t-0">
            <DetailsSection :details="block.details" />
          </div>
        </section>

        <section v-if="items && items.length > 0">
          <ItemViewSelectable :items="items" :title="t('shell.item_page.contents')" @refresh="refreshItemList" />
        </section>
      </div>

      <aside v-if="wide" class="border-l border-border px-3 py-6">
        <PropertiesPanel
          v-model:place-open="placePickerOpen"
          :item="item"
          @patch="patch"
          @update="update"
          @quantity="setQuantity"
        />
      </aside>
    </div>
  </div>
</template>
