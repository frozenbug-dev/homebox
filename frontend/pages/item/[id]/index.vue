<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useQueryClient } from "@tanstack/vue-query";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import {
    CopyPlus,
    Ellipsis,
    LayoutTemplate,
    Printer,
    HandCoins,
    QrCode,
    Link as LinkIcon,
    Plus,
    Trash2,
    Wrench,
  } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import AddAttachmentTiles from "~/components/Entity/AddAttachmentTiles.vue";
  import CoverPhoto from "~/components/Entity/CoverPhoto.vue";
  import { entityPhotos, type EntityPhoto } from "~/lib/entity-photos";
  import type { EntityPatch, EntitySummary, EntityUpdate, ItemAttachment } from "~~/lib/api/types/data-contracts";
  import { templateField } from "~~/lib/api/template-fields";
  import { toEntityUpdate } from "~/lib/entity-update";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import ItemImageDialog from "~/components/Item/ImageDialog.vue";
  import AttachmentEditDialog from "~/components/Item/AttachmentEditDialog.vue";
  import ItemDuplicateSettings from "~/components/Item/DuplicateSettings.vue";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import PageQRCode from "~/components/global/PageQRCode.vue";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import ItemAttachmentsList from "~/components/Item/AttachmentsList.vue";
  import ItemList from "~/components/Items/List.vue";
  import PropertiesPanel from "~/components/Item/PropertiesPanel.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import InlineMarkdown from "~/components/Item/Inline/Markdown.vue";
  import InlineDate from "~/components/Item/Inline/Date.vue";

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

  /** True on the Maintenance sub-page, which renders through <NuxtPage>. */
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

  type Photo = EntityPhoto;

  /** Primary photo first: it's the cover beside the title, the rest sit below. */
  const photos = computed<Photo[]>(() => (item.value ? entityPhotos(item.value, path => api.authURL(path)) : []));
  const cover = computed(() => photos.value[0]);
  const morePhotos = computed(() => photos.value.slice(1));

  /** Files other than photos, plain attachments first, then manuals, warranties and receipts. */
  const typeOrder: Record<string, number> = { manual: 1, warranty: 2, receipt: 3 };
  const files = computed<ItemAttachment[]>(() =>
    (item.value?.attachments ?? [])
      .filter(a => a.type !== "photo")
      .sort((a, b) => (typeOrder[a.type] ?? 0) - (typeOrder[b.type] ?? 0))
  );

  /** The Sold section shows once anything about a sale is recorded, or after "Mark as sold". */
  const markingSold = ref(false);
  const isSold = computed(
    () =>
      !!item.value &&
      (!!item.value.soldTo || item.value.soldPrice !== 0 || validDate(item.value.soldDate) || !!item.value.soldNotes)
  );
  const showSold = computed(() => isSold.value || markingSold.value);
  watch(itemId, () => (markingSold.value = false));

  const formatCurrency = shallowRef<((value: number | string) => string) | null>(null);
  useFormatCurrency().then(fn => (formatCurrency.value = fn));
  const soldPrice = computed(() =>
    item.value?.soldPrice ? (formatCurrency.value?.(item.value.soldPrice) ?? String(item.value.soldPrice)) : ""
  );
  function saveSoldPrice(value: string) {
    const n = Number.parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    update({ soldPrice: Number.isFinite(n) ? n : 0 });
  }

  /** Warranty notes only matter once there's a warranty, unless some were written already. */
  const showWarrantyDetails = computed(
    () =>
      !!item.value &&
      (!!item.value.warrantyDetails || item.value.lifetimeWarranty || validDate(item.value.warrantyExpires))
  );

  /** Put the item inside another one, or take it out and leave it in the place it was in. */
  async function setContainer(container: EntitySummary | null) {
    if (!item.value) return;
    if (container) {
      await patch({ parentId: container.id });
    } else if (item.value.location) {
      await patch({ parentId: item.value.location.id });
    } else {
      await update({ parentId: null, locationId: null });
    }
  }

  function editAttachment(attachment: ItemAttachment) {
    openDialog(DialogID.AttachmentEdit, {
      params: { itemId: itemId.value, attachment },
      onClose: result => {
        if (result && item.value) {
          item.value = { ...item.value, attachments: result.attachments };
          queryClient.invalidateQueries({ queryKey: ["entities"] });
        }
      },
    });
  }

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
        } else if (result?.action === "edit") {
          const attachment = item.value?.attachments.find(a => a.id === result.id);
          if (attachment) editAttachment(attachment);
        }
      },
    });
  }

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

      // By actual parent: a part stored somewhere else is still part of this item.
      const resp = await api.items.getAll({
        parentItemIds: [itemId.value],
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

  const soldRow =
    "grid min-h-8 grid-cols-[96px_minmax(0,1fr)] items-center gap-2 [&>dt]:text-muted-foreground [&>dd]:min-w-0";

  async function onUploaded() {
    await refresh();
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  }

  usePageHeader(() => {
    const parts = fullpath.value ?? [];
    return [
      { label: t("shell.items"), to: "/items" },
      ...parts.slice(0, -1).map(part => ({
        label: part.name,
        to: part.type === "location" ? `/locations?place=${part.id}` : `/${part.type}/${part.id}`,
      })),
      ...(hasNested.value
        ? [
            { label: item.value?.name ?? "", to: `/item/${itemId.value}` },
            {
              label: t("shell.item_page.maintenance"),
            },
          ]
        : [{ label: item.value?.name ?? "" }]),
    ];
  });
</script>

<template>
  <div v-if="item" class="flex flex-1 flex-col">
    <!-- set page title -->
    <Title>{{ item.name }}</Title>

    <ItemImageDialog />
    <AttachmentEditDialog />
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

    <!-- Item actions live in the panel header, as in the design -->
    <AppHeaderActions v-if="!hasNested">
      <span v-if="neighbours" class="mr-1 hidden items-center gap-1 text-xs text-muted-foreground tabular-nums xl:flex">
        {{ t("shell.item_page.position", { index: neighbours.index + 1, total: neighbours.total }) }}
        <button
          type="button"
          class="rounded disabled:opacity-40"
          :disabled="!neighbours.prev"
          :aria-label="t('shell.item_page.previous')"
          @click="go(neighbours.prev)"
        >
          <ShortcutHint :hotkey="SHORTCUTS.itemPrevious" />
        </button>
        <button
          type="button"
          class="rounded disabled:opacity-40"
          :disabled="!neighbours.next"
          :aria-label="t('shell.item_page.next')"
          @click="go(neighbours.next)"
        >
          <ShortcutHint :hotkey="SHORTCUTS.itemNext" />
        </button>
      </span>
      <Button variant="outline" size="sm" class="h-[30px] text-[13px] max-sm:hidden" @click="duplicateItem()">
        {{ t("shell.item_page.duplicate") }}
        <ShortcutHint :hotkey="SHORTCUTS.itemDuplicate" />
      </Button>
      <Button size="sm" class="h-[30px] text-[13px]" @click="printLabel">
        <Printer class="sm:hidden" />
        <span class="max-sm:sr-only">{{ t("shell.item_page.print_label") }}</span>
        <ShortcutHint
          :hotkey="SHORTCUTS.itemPrint"
          class="max-sm:hidden [&_kbd]:border-primary-foreground/20 [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground"
        />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="icon" class="size-[30px]" :aria-label="t('shell.item_page.more')">
            <Ellipsis class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuItem as-child>
            <NuxtLink :to="`/item/${item.id}/maintenance`">
              <Wrench class="size-4" />
              {{ t("shell.item_page.maintenance") }}
            </NuxtLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="createSubitem">
            <Plus class="size-4" />
            {{ $t("global.create_subitem") }}
          </DropdownMenuItem>
          <DropdownMenuItem class="sm:hidden" @select="duplicateItem()">
            <CopyPlus class="size-4" />
            {{ t("shell.item_page.duplicate") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="openDialog(DialogID.DuplicateTemporarySettings)">
            <CopyPlus class="size-4" />
            {{ t("shell.item_page.duplicate_with_options") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="!showSold" @select="markingSold = true">
            <HandCoins class="size-4" />
            {{ t("shell.item_page.mark_sold") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="saveAsTemplate">
            <LayoutTemplate class="size-4" />
            {{ $t("components.template.save_as_template") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="copyLink">
            <LinkIcon class="size-4" />
            {{ t("shell.item_page.copy_link") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="openDialog(DialogID.PageQRCode)">
            <QrCode class="size-4" />
            {{ t("shell.item_page.show_qr") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deleteItem">
            <Trash2 class="size-4" />
            {{ $t("global.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </AppHeaderActions>
    <PageQRCode buttonless />

    <!-- Maintenance -->
    <div v-if="hasNested" class="px-3 py-4 sm:px-6">
      <NuxtPage :item="item" :page-key="itemId" />
    </div>

    <!-- Properties sit beside the content on wide screens and right below the title on narrow ones -->
    <div v-else class="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)]">
      <div class="flex min-w-0 flex-col gap-[22px] px-4 py-6 sm:px-10 sm:pt-7 sm:pb-10">
        <header class="flex max-w-190 items-start gap-4">
          <CoverPhoto
            :entity-id="item.id"
            :photo="cover"
            @uploaded="onUploaded"
            @view="p => openImageDialog(p, item!.id)"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <InlineText
              :value="item.name"
              :label="t('items.name')"
              wrap
              class="-mx-1.5 text-[26px] leading-tight font-semibold tracking-tight"
              @save="name => name && update({ name })"
            />
            <InlineMarkdown
              :value="item.description"
              :label="t('items.description')"
              :placeholder="t('shell.item_page.add_description')"
              @save="description => update({ description })"
            />
          </div>
        </header>

        <div v-if="!wide" class="-mx-4 border-y border-border/70 bg-muted/20 p-4 sm:-mx-10 sm:px-10">
          <PropertiesPanel
            v-model:place-open="placePickerOpen"
            :item="item"
            :contents="items ?? []"
            @patch="patch"
            @update="update"
            @quantity="setQuantity"
            @container="setContainer"
          />
        </div>
        <!-- The other photos, then quick ways to add more -->
        <section class="flex flex-wrap gap-2.5" :aria-label="t('items.photos')">
          <button
            v-for="img in morePhotos"
            :key="img.attachmentId"
            type="button"
            class="h-[90px] w-30 overflow-hidden rounded-[10px] border border-border bg-muted transition-opacity hover:opacity-90"
            @click="openImageDialog(img, item.id)"
          >
            <img class="size-full object-cover" :src="img.thumbnailSrc" :alt="$t('items.photo')" loading="lazy" />
          </button>
          <AddAttachmentTiles :entity-id="item.id" @uploaded="onUploaded" />
        </section>

        <div class="h-px bg-border/70" />

        <section>
          <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">
            {{ $t("items.notes") }}
          </h2>
          <InlineMarkdown
            :value="item.notes"
            :label="t('items.notes')"
            :placeholder="t('shell.item_page.add_notes')"
            @save="notes => update({ notes })"
          />
        </section>

        <section v-if="files.length > 0">
          <h2 class="mb-2 text-[13px] font-semibold text-foreground/80">
            {{ $t("items.attachments") }}
          </h2>
          <ItemAttachmentsList :attachments="files" :item-id="item.id" editable @edit="editAttachment" />
        </section>

        <section v-if="showWarrantyDetails">
          <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">
            {{ t("shell.item_page.warranty_details") }}
          </h2>
          <InlineMarkdown
            :value="item.warrantyDetails"
            :label="t('shell.item_page.warranty_details')"
            :placeholder="t('shell.item_page.add_warranty_details')"
            @save="warrantyDetails => update({ warrantyDetails })"
          />
        </section>

        <section v-if="showSold">
          <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">
            {{ t("shell.item_page.sold") }}
          </h2>
          <dl class="flex max-w-md flex-col text-[13px]">
            <div :class="soldRow">
              <dt>{{ t("shell.item_page.sold_to") }}</dt>
              <dd>
                <InlineText :value="item.soldTo" :label="$t('items.sold_to')" @save="soldTo => update({ soldTo })" />
              </dd>
            </div>
            <div :class="soldRow">
              <dt>{{ t("shell.item_page.sold_price") }}</dt>
              <dd>
                <InlineText
                  :value="item.soldPrice ? String(item.soldPrice) : ''"
                  :display="soldPrice"
                  :label="$t('items.sold_price')"
                  class="tabular-nums"
                  @save="saveSoldPrice"
                />
              </dd>
            </div>
            <div :class="soldRow">
              <dt>{{ t("shell.item_page.sold_date") }}</dt>
              <dd>
                <InlineDate
                  :value="item.soldDate"
                  :placeholder="t('shell.item_page.set_date')"
                  :label="$t('items.sold_at')"
                  @save="soldDate => update({ soldDate })"
                />
              </dd>
            </div>
          </dl>
          <InlineMarkdown
            class="mt-1"
            :value="item.soldNotes"
            :label="$t('items.sold_notes')"
            :placeholder="t('shell.item_page.add_sold_notes')"
            @save="soldNotes => update({ soldNotes })"
          />
        </section>

        <section v-if="items && items.length > 0">
          <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">
            {{ t("shell.item_page.contents") }}
            <span class="ml-1 font-normal text-muted-foreground tabular-nums">{{ items.length }}</span>
          </h2>
          <!-- The page's own M / P / ↑↓ shortcuts act on this item, so the list doesn't register any. -->
          <ItemList
            class="-mx-1.5"
            :rows="items"
            :total="items.length"
            :columns="{ asset: true, place: false, tags: true, quantity: true, price: true, added: false }"
            :hotkeys="false"
            bare
            @changed="refreshItemList"
          />
        </section>
      </div>

      <aside v-if="wide" class="border-l border-border/70 bg-muted/20">
        <div class="sticky top-(--header-height) px-4 py-[18px]">
          <PropertiesPanel
            v-model:place-open="placePickerOpen"
            :item="item"
            :contents="items ?? []"
            @patch="patch"
            @update="update"
            @quantity="setQuantity"
            @container="setContainer"
          />
        </div>
      </aside>
    </div>
  </div>
</template>
