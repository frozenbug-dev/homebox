<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import {
    Barcode,
    ChevronDown,
    ChevronRight,
    CornerDownRight,
    DollarSign,
    FileText,
    Hash,
    MapPin,
    Minus,
    Package,
    Paperclip,
    Plus,
    RotateCw,
    ScanBarcode,
    ShieldCheck,
    Star,
    Tag as TagIcon,
    Trash2,
    X,
  } from "@lucide/vue";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Checkbox } from "@/components/ui/checkbox";
  import CreateDialog from "~/components/Create/Dialog.vue";
  import CreateChip from "~/components/Create/Chip.vue";
  import OptionPicker, { type PickerOption } from "~/components/Create/OptionPicker.vue";
  import Currency from "~/components/global/Currency.vue";
  import type {
    EntityCreate,
    EntityTemplateOut,
    EntityTemplateSummary,
    EntityOut,
    EntitySummary,
    EntityTypeSummary,
  } from "~~/lib/api/types/data-contracts";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import { AttachmentTypes } from "~~/lib/api/types/non-generated";
  import { useDialog, useDialogHotkey } from "~/components/ui/dialog-provider";
  import {
    deletePhoto,
    dataURLtoFile,
    filesToPhotoPreviews,
    rotatePhotoPreview,
    setPrimaryPhoto,
    type PhotoPreview,
  } from "~/components/Form/photo-uploader";
  import { useFlatLocations } from "~~/composables/use-location-helpers";
  import { useEntityTypeStore } from "~~/stores/entityTypes";

  const { t, locale } = useI18n();
  const { openDialog, closeDialog, registerOpenDialogCallback } = useDialog();

  useDialogHotkey(DialogID.CreateEntity, { code: "Digit1", shift: true }, () => ({
    baseType: "item",
  }));
  useDialogHotkey(DialogID.CreateEntity, { code: "Digit2", shift: true }, () => ({
    baseType: "location",
  }));

  const entityTypeStore = useEntityTypeStore();
  const api = useUserApi();

  const locationsStore = useLocationStore();
  const locations = computed(() => locationsStore.allLocations);
  const flatLocations = useFlatLocations();

  const tagStore = useTagStore();
  const tags = computed(() => tagStore.tags);

  const route = useRoute();

  const parent = ref();
  const { query, results, isLoading, triggerSearch } = useItemSearch(api, { immediate: false });
  const subItemCreate = ref();

  const tagId = computed(() => (route.fullPath.includes("/tag/") ? route.params.id : null));
  const locationId = computed(() => (route.fullPath.includes("/location/") ? route.params.id : null));
  const itemId = computed(() => (route.fullPath.includes("/item/") ? route.params.id : null));

  const nameInput = ref<HTMLInputElement | null>(null);
  const photoInput = ref<HTMLInputElement | null>(null);

  // Entity type selection
  const entityTypes = computed(() => entityTypeStore.allTypes);
  const selectedEntityType = ref<EntityTypeSummary | null>(null);
  const isLocation = computed(() => !!selectedEntityType.value?.isLocation);
  const typeName = computed(() => t(selectedEntityType.value ? selectedEntityType.value.name : "global.entity"));
  const pickableTypes = computed(() =>
    subItemCreate.value ? entityTypes.value.filter(et => !et.isLocation) : entityTypes.value
  );

  async function onEntityTypeChanged(typeId: string) {
    const et = entityTypes.value.find(t => t.id === typeId);
    selectedEntityType.value = et || null;

    // A template the user picked explicitly takes precedence over the entity
    // type's default template, so don't overwrite it when the type changes.
    // (Locations don't use templates, so they still clear it below.)
    if (templateUserSelected.value && !et?.isLocation) {
      return;
    }

    // If the selected type has a default template and is not a location, auto-apply it
    if (et?.isLocation || !et?.defaultTemplateId || !et.defaultTemplate) {
      clearTemplate();
    } else {
      const { data, error } = await api.templates.get(et.defaultTemplateId);
      if (!error && data) {
        selectedTemplate.value = {
          id: data.id,
          name: data.name,
          description: data.description,
        } as EntityTemplateSummary;
        applyTemplate(data, true);
        toast.success(t("components.template.toast.applied", { name: data.name }));
      }
    }
  }

  const LAST_TEMPLATE_KEY = "homebox:lastUsedTemplate";

  const loading = ref(false);
  const selectedTemplate = ref<EntityTemplateSummary | null>(null);
  const templateData = ref<EntityTemplateOut | null>(null);
  // Tracks whether the current template was chosen explicitly by the user (vs.
  // auto-applied from an entity type's default template). User selections win.
  const templateUserSelected = ref(false);
  const form = reactive({
    location: locations.value && locations.value.length > 0 ? locations.value[0] : ({} as EntityOut),
    parentId: null as string | null,
    name: "",
    quantity: 1,
    description: "",
    color: "",
    // Populated by the barcode product-import flow; passed through on create (#1578).
    manufacturer: "",
    modelNumber: "",
    purchasePrice: null as number | null,
    warrantyExpires: "",
    lifetimeWarranty: false,
    tags: [] as string[],
    photos: [] as PhotoPreview[],
  });

  // ----- Pickers -----

  const { data: templates } = useAsyncData("templates-selector", async () => {
    const { data, error } = await api.templates.getAll();
    return error ? [] : data;
  });
  const templateOptions = computed<PickerOption[]>(() =>
    (templates.value ?? []).map(tpl => ({ id: tpl.id, name: tpl.name, hint: tpl.description || undefined }))
  );
  const templateId = computed({
    get: () => selectedTemplate.value?.id ?? null,
    set: id => {
      const tpl = (templates.value ?? []).find(x => x.id === id) ?? null;
      selectedTemplate.value = tpl;
      handleTemplateSelected(tpl);
    },
  });

  const placeOptions = computed<PickerOption[]>(() =>
    flatLocations.value.map(l => {
      const path = l.treeString.split(" > ");
      return { id: l.id, name: l.name, hint: path.length > 1 ? path.slice(0, -1).join(" › ") : undefined };
    })
  );
  const placeId = computed({
    get: () => (form.location?.id as string | undefined) ?? null,
    set: id => {
      form.location = (locations.value.find(l => l.id === id) ?? {}) as EntityOut;
    },
  });
  const placePath = computed(() => {
    const flat = flatLocations.value.find(l => l.id === placeId.value);
    return flat ? flat.treeString.split(" > ") : [];
  });

  const tagOptions = computed<PickerOption[]>(() =>
    tags.value.map(tag => ({ id: tag.id, name: tag.name, color: tag.color ?? "" }))
  );
  const pickedTags = computed(() => tags.value.filter(tag => form.tags.includes(tag.id)));

  async function createTag(name: string) {
    const { data, error } = await api.tags.create({ name, color: "", description: "", icon: "" });
    if (error || !data) {
      toast.error(t("components.tag.create_modal.toast.create_failed"));
      return;
    }
    await tagStore.refresh();
    form.tags = [...form.tags, data.id];
  }

  const parentOptions = computed<PickerOption[]>(() =>
    results.value.map(item => ({ id: item.id, name: item.name, hint: item.parent?.name }))
  );
  const parentId = computed({
    get: () => (parent.value?.id as string | undefined) ?? null,
    set: id => {
      parent.value = results.value.find(r => r.id === id) ?? {};
    },
  });
  watch(query, () => triggerSearch());

  // An emptied number input gives "" rather than null.
  const hasPrice = computed(() => typeof form.purchasePrice === "number" && !Number.isNaN(form.purchasePrice));

  const warrantyLabel = computed(() => {
    if (form.lifetimeWarranty) return t("shell.create.warranty_lifetime");
    if (!form.warrantyExpires) return "";
    const d = new Date(`${form.warrantyExpires}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? ""
      : t("shell.create.warranty_until", {
          date: d.toLocaleDateString(locale.value, { month: "short", day: "numeric", year: "numeric" }),
        });
  });

  // ----- Templates -----

  function applyTemplate(data: EntityTemplateOut, overrideLocation: boolean) {
    templateData.value = data;
    form.quantity = data.defaultQuantity;
    if (data.defaultName) form.name = data.defaultName;
    if (data.defaultDescription) form.description = data.defaultDescription;
    if (data.defaultLifetimeWarranty) form.lifetimeWarranty = true;
    if (data.defaultLocation && (overrideLocation || !form.location?.id)) {
      const found = locations.value.find(l => l.id === data.defaultLocation!.id);
      if (found) form.location = found;
    }
    if (data.defaultTags && data.defaultTags.length > 0) {
      form.tags = data.defaultTags.map(l => l.id);
    }
  }

  async function handleTemplateSelected(template: EntityTemplateSummary | null) {
    if (!template) {
      // Template was deselected, clear template data and remove from storage
      templateData.value = null;
      templateUserSelected.value = false;
      form.quantity = 1;
      localStorage.removeItem(LAST_TEMPLATE_KEY);
      return;
    }

    templateUserSelected.value = true;

    const { data, error } = await api.templates.get(template.id);
    if (error || !data) {
      toast.error(t("components.template.toast.load_failed"));
      return;
    }

    applyTemplate(data, false);
    localStorage.setItem(LAST_TEMPLATE_KEY, template.id);
    toast.success(t("components.template.toast.applied", { name: data.name }));
  }

  async function restoreLastTemplate() {
    const lastTemplateId = localStorage.getItem(LAST_TEMPLATE_KEY);
    if (!lastTemplateId) return;

    const { data, error } = await api.templates.get(lastTemplateId);
    if (error || !data) {
      // Template might have been deleted, clear the stored ID
      localStorage.removeItem(LAST_TEMPLATE_KEY);
      return;
    }

    // A restored template reflects the user's last explicit choice, so treat
    // it as user-selected for override purposes.
    selectedTemplate.value = { id: data.id, name: data.name, description: data.description } as EntityTemplateSummary;
    templateUserSelected.value = true;
    applyTemplate(data, true);
  }

  function clearTemplate() {
    selectedTemplate.value = null;
    templateData.value = null;
    templateUserSelected.value = false;
    form.quantity = 1;
    localStorage.removeItem(LAST_TEMPLATE_KEY);
  }

  // ----- Sub-items: where the item would live if left alone -----

  // Used at submit to tell "left at the default" from "stored elsewhere".
  const inheritedLocationId = ref<string | null>(null);

  function resolveInheritedLocation(entity: EntityOut | EntitySummary | null | undefined): string | null {
    if (!entity) return null;
    const resolved = (entity as EntityOut).location?.id;
    if (resolved) return resolved;
    return entity.parent?.entityType?.isLocation ? entity.parent.id : null;
  }

  const resolvedParent = ref<EntityOut | null>(null);
  let parentLookup = 0;

  watch(
    parent,
    async newParent => {
      form.parentId = newParent && newParent.id && subItemCreate.value ? newParent.id : null;

      const lookup = ++parentLookup;

      if (!newParent?.id) {
        inheritedLocationId.value = null;
        return;
      }

      if (resolvedParent.value?.id === newParent.id) {
        inheritedLocationId.value = resolveInheritedLocation(resolvedParent.value);
        return;
      }

      const { data, error } = await api.items.get(newParent.id);
      if (lookup !== parentLookup) return;

      if (error || !data) {
        console.error("Parent item fetch error:", error);
        inheritedLocationId.value = resolveInheritedLocation(newParent);
        return;
      }

      resolvedParent.value = data;
      inheritedLocationId.value = resolveInheritedLocation(data);
    },
    { immediate: true }
  );

  // ----- Photos -----

  async function onPhotosPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    appendPhotos(await filesToPhotoPreviews(input.files, form.photos.length));
    input.value = "";
  }

  function appendPhotos(photos: PhotoPreview[]) {
    form.photos.push(...photos);
  }

  function deletePhotoAt(index: number) {
    form.photos = deletePhoto(form.photos, index);
  }

  function setPrimaryPhotoAt(index: number) {
    form.photos = setPrimaryPhoto(form.photos, index);
  }

  async function rotatePhotoAt(index: number) {
    const photo = form.photos[index];
    if (!photo) return;

    try {
      form.photos[index] = await rotatePhotoPreview(photo);
    } catch (error) {
      toast.error(t("components.entity.create_modal.toast.rotate_process_failed"));
      console.error(error);
    }
  }

  // ----- Opening -----

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.CreateEntity, async params => {
      subItemCreate.value = false;
      let parentItemLocationId = null;
      parent.value = {};
      resolvedParent.value = null;
      form.parentId = null;

      if (params.baseType === "item") {
        selectedEntityType.value = entityTypes.value.find(t => !t.isLocation) || null;

        subItemCreate.value = params.subItem;

        if (subItemCreate.value && itemId.value) {
          const itemIdRead = typeof itemId.value === "string" ? (itemId.value as string) : itemId.value[0]!;
          const { data, error } = await api.items.get(itemIdRead);
          if (error || !data) {
            toast.error(t("components.entity.create_modal.toast.failed_load_parent"));
            console.error("Parent item fetch error:", error);
            return;
          }

          resolvedParent.value = data;
          parent.value = data;
          results.value = [data];

          // What the sub-item inherits if left alone. Resolved location, not the
          // direct parent — those only match when the parent sits in one.
          parentItemLocationId = resolveInheritedLocation(data);
        }

        if (params.product) {
          form.name = params.product.item.name;
          form.description = params.product.item.description;
          // Carry the looked-up identifications into the create payload so the
          // created item isn't missing manufacturer/model (#1578).
          form.manufacturer = params.product.manufacturer ?? "";
          form.modelNumber = params.product.modelNumber ?? "";

          if (params.product.imageURL) {
            appendPhotos([
              {
                photoName: "product_view.jpg",
                fileBase64: params.product.imageBase64,
                primary: form.photos.length === 0,
                file: dataURLtoFile(params.product.imageBase64, "product_view.jpg"),
              },
            ]);
          }
        } else {
          // Restore last used template if available. Skipped for barcode
          // product imports: a template's defaults (name, quantity, …) would
          // clobber the just-looked-up product data, and the template create
          // endpoint has no way to carry manufacturer/model (#1578).
          await restoreLastTemplate();
        }
      } else {
        selectedEntityType.value = entityTypes.value.find(t => t.isLocation) || null;
        // A new place goes at the top level unless opened from a place.
        form.location = {} as EntityOut;
      }

      const locId = locationId.value ? locationId.value : parentItemLocationId;

      if (locId) {
        const found = locations.value.find(l => l.id === locId);
        if (found) {
          form.location = found;
        }
      }

      if (tagId.value) {
        form.tags = tags.value.filter(l => l.id === tagId.value).map(l => l.id);
      }

      nextTick(() => nameInput.value?.focus());
    });

    onUnmounted(cleanup);
  });

  // ----- Creating -----

  function resetForm() {
    form.name = "";
    form.quantity = 1;
    form.description = "";
    form.color = "";
    form.manufacturer = "";
    form.modelNumber = "";
    form.purchasePrice = null;
    form.warrantyExpires = "";
    form.lifetimeWarranty = false;
    form.photos = [];
    form.tags = [];
    selectedTemplate.value = null;
    templateData.value = null;
    templateUserSelected.value = false;
    loading.value = false;
  }

  async function create(close = true) {
    // An empty entityTypeId serializes to "" and fails UUID unmarshalling on the
    // backend, so block creation up front rather than firing a doomed request.
    if (!selectedEntityType.value?.id) {
      toast.error(t("components.entity.create_modal.toast.please_select_entity_type"));
      return;
    }

    if (!form.name.trim()) {
      nameInput.value?.focus();
      return;
    }

    // Items must live somewhere, but a top-level location has no parent, so the
    // parent location selector is optional when creating a location.
    if (!isLocation.value && !form.location?.id) {
      toast.error(t("components.entity.create_modal.toast.please_select_location"));
      return;
    }

    if (loading.value) {
      toast.error(t("components.entity.create_modal.toast.already_creating", { type: typeName.value }));
      return;
    }

    loading.value = true;

    const purchase = {
      purchasePrice: hasPrice.value ? (form.purchasePrice as number) : undefined,
      warrantyExpires: form.warrantyExpires || undefined,
      lifetimeWarranty: form.lifetimeWarranty || undefined,
    };

    let error, data;

    if (isLocation.value) {
      const result = await api.items.createLocation({
        name: form.name,
        description: form.description,
        parentId: form.location?.id || null,
        entityTypeId: selectedEntityType.value?.id || "",
        quantity: 1,
        tagIds: form.tags,
      });
      error = result.error;
      data = result.data;
    } else if (templateData.value) {
      const result = await api.templates.createItem(templateData.value.id, {
        name: form.name,
        description: form.description,
        parentId: form.location?.id as string,
        tagIds: form.tags,
        quantity: form.quantity,
        entityTypeId: selectedEntityType.value?.id || "",
        ...purchase,
      });
      error = result.error;
      data = result.data;
    } else {
      // Only pin a location when it differs from what the item would inherit,
      // so it otherwise still follows the parent (#1688).
      const chosenLocationId = (form.location?.id as string) || null;
      const out: EntityCreate = {
        parentId: form.parentId || (form.location?.id as string),
        locationId:
          form.parentId && chosenLocationId && chosenLocationId !== inheritedLocationId.value ? chosenLocationId : null,
        name: form.name,
        quantity: form.quantity,
        description: form.description,
        manufacturer: form.manufacturer,
        modelNumber: form.modelNumber,
        tagIds: form.tags,
        entityTypeId: selectedEntityType.value?.id || "",
        ...purchase,
      };

      const result = await api.items.create(out);
      error = result.error;
      data = result.data;
    }

    if (error) {
      loading.value = false;
      toast.error(t("components.entity.create_modal.toast.create_failed", { type: typeName.value }));
      return;
    }

    toast.success(t("components.entity.create_modal.toast.create_success", { type: typeName.value }));

    if (form.photos.length > 0) {
      toast.info(t("components.entity.create_modal.toast.uploading_photos", { count: form.photos.length }));
      let uploadError = false;
      for (const photo of form.photos) {
        const { error: attachError } = await api.items.attachments.add(
          data.id,
          photo.file,
          photo.photoName,
          AttachmentTypes.Photo,
          photo.primary
        );

        if (attachError) {
          uploadError = true;
          toast.error(t("components.entity.create_modal.toast.upload_failed", { photoName: photo.photoName }));
          console.error(attachError);
        }
      }
      if (uploadError) {
        toast.warning(t("components.entity.create_modal.toast.some_photos_failed", { count: form.photos.length }));
      } else {
        toast.success(t("components.entity.create_modal.toast.upload_success", { count: form.photos.length }));
      }
    }

    const createdLocation = isLocation.value;
    resetForm();

    if (close) {
      closeDialog(DialogID.CreateEntity);
      navigateTo(createdLocation ? `/location/${data.id}` : `/item/${data.id}`);
    } else {
      nameInput.value?.focus();
      if (!createdLocation) {
        // "Create more" keeps the dialog open, so the open-dialog callback
        // (which normally restores the persisted template) never fires —
        // re-apply it here so the selection isn't cleared (#1489).
        await restoreLastTemplate();
      }
    }
  }

  function openQrScannerPage() {
    openDialog(DialogID.Scanner);
  }

  function openBarcodeDialog() {
    openDialog(DialogID.ProductImport);
  }
</script>

<template>
  <CreateDialog
    :dialog-id="DialogID.CreateEntity"
    :title="t('shell.create.new_type', { type: typeName })"
    :submit-label="t('shell.create.create_type', { type: typeName })"
    :loading="loading"
    @submit="keepOpen => create(!keepOpen)"
  >
    <template #crumb>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex h-[26px] items-center gap-1.5 rounded-[7px] border border-border px-2 text-[13px] font-medium hover:bg-muted max-md:h-8"
          >
            <component :is="isLocation ? MapPin : Package" class="size-3.5 text-primary" aria-hidden="true" />
            {{ typeName }}
            <ChevronDown class="size-3 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-48">
          <DropdownMenuItem v-for="et in pickableTypes" :key="et.id" class="gap-2" @select="onEntityTypeChanged(et.id)">
            <component :is="et.isLocation ? MapPin : Package" class="size-4 text-muted-foreground" />
            {{ t(et.name) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChevronRight class="size-3.5 text-muted-foreground/60 max-md:hidden" aria-hidden="true" />
      <span class="text-[13px] text-muted-foreground max-md:hidden">{{
        t("shell.create.new_type", { type: typeName })
      }}</span>
    </template>

    <template v-if="!isLocation" #header-actions>
      <span
        v-if="selectedTemplate"
        class="inline-flex h-[26px] items-center rounded-[7px] bg-accent text-[13px] text-accent-foreground max-md:h-8"
      >
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              class="flex h-full items-center gap-1.5 rounded-l-[7px] pr-1 pl-2 hover:bg-primary/10"
            >
              <FileText class="size-3.5" aria-hidden="true" />
              <span class="max-w-40 truncate">{{ selectedTemplate.name }}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-72 p-0">
            <OptionPicker
              v-model="templateId"
              :options="templateOptions"
              :placeholder="t('components.template.selector.search')"
            />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          class="flex h-full items-center rounded-r-[7px] px-1.5 hover:bg-primary/10"
          :aria-label="t('components.entity.create_modal.clear_template')"
          @click="clearTemplate"
        >
          <X class="size-3" />
        </button>
      </span>
      <CreateChip
        v-else
        :label="t('shell.create.template')"
        :icon="FileText"
        align="end"
        content-class="w-72"
        class="h-[26px] border-dashed px-2 max-md:h-8"
      >
        <template #default="{ close }">
          <OptionPicker
            v-model="templateId"
            :options="templateOptions"
            :placeholder="t('components.template.selector.search')"
            @close="close"
          />
        </template>
      </CreateChip>
    </template>

    <input
      ref="nameInput"
      v-model="form.name"
      :placeholder="t('shell.create.name_placeholder', { type: typeName })"
      :aria-label="t('shell.create.name_placeholder', { type: typeName })"
      maxlength="255"
      class="h-[30px] w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-[-0.01em] caret-primary outline-none placeholder:text-muted-foreground/80 max-md:text-[22px]"
    />
    <textarea
      v-model="form.description"
      :placeholder="t('shell.create.description_placeholder')"
      :aria-label="t('shell.create.description_placeholder')"
      maxlength="1000"
      rows="2"
      class="field-sizing-content max-h-48 min-h-[42px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-normal outline-none placeholder:text-muted-foreground/80 max-md:text-base"
    />

    <template #chips>
      <!-- Sub-items: which item this goes inside -->
      <CreateChip
        v-if="subItemCreate"
        :label="t('components.entity.create_modal.parent_item')"
        :icon="CornerDownRight"
        :value="parent?.name"
        :prefix="t('shell.create.inside')"
        content-class="w-72"
      >
        <template #default="{ close }">
          <OptionPicker
            v-model="parentId"
            v-model:search="query"
            :options="parentOptions"
            :loading="isLoading"
            remote
            @close="close"
          />
        </template>
      </CreateChip>

      <!-- Place: where an item lives, or which place a new place goes inside -->
      <CreateChip
        :label="isLocation ? t('shell.create.no_parent_place') : t('shell.create.place')"
        :icon="isLocation ? CornerDownRight : MapPin"
        :icon-class="isLocation ? undefined : 'text-primary'"
        :filled="placePath.length > 0"
        :prefix="isLocation ? t('shell.create.inside') : undefined"
        content-class="w-72"
      >
        <template #value>
          <span v-if="placePath.length > 1 && !isLocation" class="text-muted-foreground"
            >{{ placePath.slice(0, -1).join(" › ") }} ›</span
          >
          <span class="truncate">{{ placePath.at(-1) }}</span>
        </template>
        <template #default="{ close }">
          <OptionPicker
            v-model="placeId"
            :options="placeOptions"
            :none-label="isLocation ? t('shell.create.no_parent_place') : undefined"
            @close="close"
          />
        </template>
      </CreateChip>

      <CreateChip
        v-if="!isLocation"
        :label="t('global.quantity')"
        :icon="Hash"
        :value="String(form.quantity)"
        :prefix="t('shell.create.qty')"
        content-class="w-auto p-1.5"
      >
        <template #default="{ close }">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-md hover:bg-muted"
              :aria-label="t('shell.create.decrease')"
              @click="form.quantity = Math.max(0, (form.quantity || 0) - 1)"
            >
              <Minus class="size-4" />
            </button>
            <input
              v-model.number="form.quantity"
              type="number"
              min="0"
              step="any"
              :aria-label="t('global.quantity')"
              class="h-8 w-20 rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-ring"
              @keydown.enter.prevent="close"
            />
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-md hover:bg-muted"
              :aria-label="t('shell.create.increase')"
              @click="form.quantity = (form.quantity || 0) + 1"
            >
              <Plus class="size-4" />
            </button>
          </div>
        </template>
      </CreateChip>

      <CreateChip
        :label="t('global.tags')"
        :icon="pickedTags.length ? undefined : TagIcon"
        :filled="pickedTags.length > 0"
      >
        <template #value>
          <span v-for="tag in pickedTags.slice(0, 3)" :key="tag.id" class="inline-flex items-center gap-1.5">
            <span
              class="size-2 rounded-full"
              :style="{ backgroundColor: tag.color || 'hsl(var(--muted-foreground) / 0.5)' }"
              aria-hidden="true"
            />
            {{ tag.name }}
          </span>
          <span v-if="pickedTags.length > 3" class="text-muted-foreground">+{{ pickedTags.length - 3 }}</span>
        </template>
        <template #default="{ close }">
          <OptionPicker
            v-model="form.tags"
            :options="tagOptions"
            multiple
            creatable
            @create="createTag"
            @close="close"
          />
        </template>
      </CreateChip>

      <template v-if="!isLocation">
        <CreateChip :label="t('shell.create.price')" :icon="DollarSign" :filled="hasPrice" content-class="w-56 p-2">
          <template #value><Currency :amount="form.purchasePrice ?? 0" /></template>
          <template #default="{ close }">
            <label class="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {{ t("shell.create.purchase_price") }}
              <input
                v-model.number="form.purchasePrice"
                type="number"
                min="0"
                step="0.01"
                class="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground tabular-nums outline-none focus:border-ring"
                @keydown.enter.prevent="close"
              />
            </label>
          </template>
        </CreateChip>

        <CreateChip
          :label="t('shell.create.warranty')"
          :icon="ShieldCheck"
          :value="warrantyLabel"
          content-class="w-60 p-2"
        >
          <template #default="{ close }">
            <div class="flex flex-col gap-2.5">
              <label class="flex flex-col gap-1.5 text-xs text-muted-foreground">
                {{ t("shell.create.warranty_expires") }}
                <input
                  v-model="form.warrantyExpires"
                  type="date"
                  :disabled="form.lifetimeWarranty"
                  class="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring disabled:opacity-50"
                  @keydown.enter.prevent="close"
                />
              </label>
              <label class="flex items-center gap-2 text-sm">
                <Checkbox v-model="form.lifetimeWarranty" />
                {{ t("shell.create.warranty_lifetime") }}
              </label>
            </div>
          </template>
        </CreateChip>
      </template>
    </template>

    <template v-if="form.photos.length" #after>
      <div class="flex flex-wrap gap-2 px-5 pb-4 max-md:px-4">
        <div
          v-for="(photo, index) in form.photos"
          :key="index"
          class="group/photo relative size-[72px] overflow-hidden rounded-lg border border-border bg-muted"
        >
          <img :src="photo.fileBase64" :alt="photo.photoName" class="size-full object-cover" />
          <span
            v-if="photo.primary"
            class="absolute bottom-1 left-1 rounded bg-background px-1.5 text-[10px] font-medium text-foreground"
          >
            {{ t("shell.create.cover") }}
          </span>
          <div
            class="absolute inset-0 flex items-start justify-end gap-0.5 bg-black/30 p-1 opacity-0 transition-opacity group-focus-within/photo:opacity-100 group-hover/photo:opacity-100 pointer-coarse:opacity-100"
          >
            <button
              v-if="!photo.primary"
              type="button"
              class="flex size-6 items-center justify-center rounded bg-background/90 text-foreground hover:bg-background"
              :aria-label="t('shell.create.set_cover')"
              @click="setPrimaryPhotoAt(index)"
            >
              <Star class="size-3.5" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded bg-background/90 text-foreground hover:bg-background"
              :aria-label="t('shell.create.rotate')"
              @click="rotatePhotoAt(index)"
            >
              <RotateCw class="size-3.5" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded bg-background/90 text-destructive hover:bg-background"
              :aria-label="t('shell.create.remove_photo')"
              @click="deletePhotoAt(index)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          class="flex size-[72px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          :aria-label="t('shell.create.add_photos')"
          @click="photoInput?.click()"
        >
          <Plus class="size-4" />
        </button>
      </div>
    </template>

    <template #footer-left>
      <input
        ref="photoInput"
        type="file"
        class="hidden"
        accept="image/png,image/jpeg,image/gif,image/avif,image/webp,android/force-camera-workaround"
        multiple
        @change="onPhotosPicked"
      />
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-11"
        :aria-label="t('shell.create.add_photos')"
        :title="t('shell.create.add_photos')"
        @click="photoInput?.click()"
      >
        <Paperclip class="size-4" />
      </button>
      <template v-if="!isLocation">
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-11"
          :aria-label="t('components.entity.create_modal.product_tooltip_scan_barcode')"
          :title="t('components.entity.create_modal.product_tooltip_scan_barcode')"
          :disabled="loading"
          @click="openQrScannerPage"
        >
          <ScanBarcode class="size-4" />
        </button>
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground max-md:hidden"
          :aria-label="t('components.entity.create_modal.product_tooltip_input_barcode')"
          :title="t('components.entity.create_modal.product_tooltip_input_barcode')"
          :disabled="loading"
          @click="openBarcodeDialog"
        >
          <Barcode class="size-4" />
        </button>
      </template>
      <span
        v-else-if="form.name && placePath.length"
        class="ml-1.5 truncate text-xs text-muted-foreground max-md:hidden"
      >
        {{ placePath.join(" › ") }} › <b class="font-medium text-foreground">{{ form.name }}</b>
      </span>
    </template>
  </CreateDialog>
</template>
