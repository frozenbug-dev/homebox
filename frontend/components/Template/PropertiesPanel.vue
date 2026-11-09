<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ChevronsUpDown, MapPin, Minus, Plus } from "@lucide/vue";
  import type { EntityFieldData, EntityTemplateOut, TemplateField } from "~/lib/api/types/data-contracts";
  import { NIL_UUID, templateField } from "~/lib/api/template-fields";
  import { useTagStore } from "~/stores/tags";
  import { Button } from "@/components/ui/button";
  import { Switch } from "@/components/ui/switch";
  import { Pill } from "@/components/ui/pill";
  import { getIconComponent } from "~/lib/icons";
  import DateTime from "~/components/global/DateTime.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";
  import TagPicker from "~/components/Item/Inline/TagPicker.vue";
  import FieldsEditor from "~/components/Item/FieldsEditor.vue";
  import type { TemplateChanges } from "~/lib/template-update";

  /**
   * The template page's properties column, laid out like the item page's:
   * the defaults a new item gets, each edited in place.
   */
  const props = defineProps<{ template: EntityTemplateOut }>();
  const emit = defineEmits<{ update: [changes: TemplateChanges, optimistic?: Partial<EntityTemplateOut>] }>();

  const { t } = useI18n();
  const tagStore = useTagStore();
  const places = useFlatLocations();

  const placeOpen = ref(false);
  const place = computed(() => places.value.find(p => p.id === props.template.defaultLocation?.id));
  const placePath = computed(() => {
    const parts = (place.value?.treeString ?? "").split(" / ");
    return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
  });
  function pickPlace(p: FlatTreeItem) {
    emit("update", { defaultLocationId: p.id }, { defaultLocation: { id: p.id, name: p.name } });
  }
  function clearPlace() {
    emit(
      "update",
      { defaultLocationId: null },
      { defaultLocation: null as unknown as EntityTemplateOut["defaultLocation"] }
    );
  }

  /** The store has colours and icons; the template only carries ids and names. */
  const tags = computed(() => {
    const ids = new Set((props.template.defaultTags ?? []).map(tag => tag.id));
    return tagStore.withAncestors(tagStore.tags.filter(tag => ids.has(tag.id)));
  });
  const tagPickerOpen = ref(false);
  const tagIds = computed({
    get: () => (props.template.defaultTags ?? []).map(tag => tag.id),
    set: ids =>
      emit(
        "update",
        { defaultTagIds: ids },
        { defaultTags: ids.map(id => ({ id, name: tagStore.tags.find(s => s.id === id)?.name ?? "" })) }
      ),
  });

  /** Fixed-width quantity box, as on the item page; a new item needs at least one. */
  const quantityDraft = ref(String(props.template.defaultQuantity));
  watch(
    () => props.template.defaultQuantity,
    q => (quantityDraft.value = String(q))
  );
  function setQuantity(n: number) {
    if (Number.isFinite(n) && n >= 1 && n !== props.template.defaultQuantity) emit("update", { defaultQuantity: n });
    else quantityDraft.value = String(props.template.defaultQuantity);
  }
  function cancelQuantity(e: KeyboardEvent) {
    quantityDraft.value = String(props.template.defaultQuantity);
    (e.target as HTMLInputElement).blur();
  }

  // The item fields editor works on item fields; template fields are the same plus a time value.
  const fieldsEditor = useTemplateRef<InstanceType<typeof FieldsEditor>>("fieldsEditor");
  const fields = computed(() => props.template.fields as unknown as EntityFieldData[]);
  function saveFields(next: EntityFieldData[]) {
    const out: TemplateField[] = next.map(f => {
      const defined = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== null));
      return templateField({ ...defined, id: f.id || NIL_UUID });
    });
    emit("update", { fields: out });
  }

  const row =
    "grid min-h-8 grid-cols-[96px_minmax(0,1fr)] items-center gap-2 [&>dt]:text-muted-foreground [&>dd]:min-w-0";
  const heading = "mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";
</script>

<template>
  <section :aria-label="t('shell.item_page.properties')" class="flex flex-col gap-5 text-[13px]">
    <div class="flex flex-col gap-2.5">
      <div class="overflow-hidden rounded-lg border border-border bg-background shadow-xs">
        <PlacePicker
          v-model:open="placeOpen"
          :current-id="template.defaultLocation?.id"
          :allow-top="!!template.defaultLocation"
          :top-label="t('shell.template_page.no_default_place')"
          align="end"
          @pick="pickPlace"
          @top="clearPlace"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            :aria-label="t('shell.template_page.set_default_place')"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin class="size-4" aria-hidden="true" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[11px] text-muted-foreground">{{
                t("shell.template_page.default_place")
              }}</span>
              <span
                class="truncate text-sm font-medium"
                :class="{ 'text-muted-foreground': !template.defaultLocation }"
              >
                {{ template.defaultLocation?.name ?? t("shell.template_page.no_default_place") }}
              </span>
              <span v-if="placePath" class="truncate text-xs text-muted-foreground">{{ placePath }}</span>
            </span>
            <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PlacePicker>
      </div>

      <div class="flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 shadow-xs">
        <span class="text-[11px] text-muted-foreground">{{ $t("items.quantity") }}</span>
        <div class="-mx-1 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            class="size-6 text-muted-foreground"
            :disabled="template.defaultQuantity <= 1"
            :aria-label="t('shell.items_page.decrease')"
            @click="setQuantity(template.defaultQuantity - 1)"
          >
            <Minus class="size-3.5" />
          </Button>
          <input
            v-model="quantityDraft"
            type="text"
            inputmode="numeric"
            :aria-label="t('items.quantity')"
            class="h-6 w-0 min-w-0 flex-1 rounded-md bg-transparent text-center text-sm font-medium tabular-nums outline-none hover:bg-muted focus:bg-transparent"
            @focus="($event.target as HTMLInputElement).select()"
            @blur="setQuantity(Math.floor(Number(quantityDraft)))"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.stop.prevent="cancelQuantity($event)"
          />
          <Button
            variant="ghost"
            size="icon"
            class="size-6 text-muted-foreground"
            :aria-label="t('shell.items_page.increase')"
            @click="setQuantity(template.defaultQuantity + 1)"
          >
            <Plus class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <section>
      <h3 :class="heading">{{ $t("global.tags") }}</h3>
      <div class="flex flex-wrap items-center gap-1 pt-1">
        <Pill
          v-for="tag in tags"
          :key="tag.id"
          :color="tag.ancestors ? undefined : tag.color || undefined"
          :icon="getIconComponent(tag.icon)"
          :dashed="tag.ancestors"
        >
          {{ tag.name }}
        </Pill>
        <TagPicker v-model="tagIds" v-model:open="tagPickerOpen">
          <Pill v-if="tags.length === 0" as="button" dashed :icon="Plus">
            {{ t("shell.item_page.add_tags") }}
          </Pill>
          <Pill v-else as="button" dashed :icon="Plus" :aria-label="t('shell.item_page.add_tags')" />
        </TagPicker>
      </div>
    </section>

    <section>
      <h3 :class="heading">{{ t("shell.item_page.group_product") }}</h3>
      <dl class="flex flex-col">
        <div :class="row">
          <dt>{{ $t("items.manufacturer") }}</dt>
          <dd>
            <InlineText
              :value="template.defaultManufacturer"
              :label="$t('items.manufacturer')"
              @save="v => emit('update', { defaultManufacturer: v })"
            />
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.model") }}</dt>
          <dd>
            <InlineText
              :value="template.defaultModelNumber"
              :label="$t('items.model_number')"
              class="font-mono text-xs"
              @save="v => emit('update', { defaultModelNumber: v })"
            />
          </dd>
        </div>
      </dl>
    </section>

    <section>
      <div class="mb-1 flex items-center justify-between">
        <h3 :class="heading.replace('mb-1', '')">{{ t("shell.item_page.fields") }}</h3>
        <button
          type="button"
          class="-mr-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          :aria-label="t('shell.item_page.add_field')"
          :title="t('shell.item_page.add_field')"
          @click="fieldsEditor?.add()"
        >
          <Plus class="size-3.5" />
        </button>
      </div>
      <FieldsEditor ref="fieldsEditor" compact :fields="fields" @save="saveFields" />
      <button
        v-if="template.fields.length === 0 && !fieldsEditor?.adding"
        type="button"
        class="-ml-1.5 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="fieldsEditor?.add()"
      >
        {{ t("shell.item_page.add_field") }}
      </button>
    </section>

    <section>
      <h3 :class="heading">{{ t("shell.item_page.group_status") }}</h3>
      <div class="flex flex-col">
        <label class="flex min-h-8 items-center justify-between gap-2">
          <span class="text-muted-foreground">{{ $t("items.insured") }}</span>
          <Switch
            :model-value="template.defaultInsured"
            class="scale-90"
            @update:model-value="v => emit('update', { defaultInsured: v })"
          />
        </label>
        <label class="flex min-h-8 items-center justify-between gap-2">
          <span class="text-muted-foreground">{{ $t("items.lifetime_warranty") }}</span>
          <Switch
            :model-value="template.defaultLifetimeWarranty"
            class="scale-90"
            @update:model-value="v => emit('update', { defaultLifetimeWarranty: v })"
          />
        </label>
      </div>
    </section>

    <dl
      class="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground"
    >
      <dt>{{ t("shell.item_page.created") }}</dt>
      <dd><DateTime :date="template.createdAt" /></dd>
      <dt>{{ t("shell.item_page.updated") }}</dt>
      <dd><DateTime :date="template.updatedAt" /></dd>
    </dl>
  </section>
</template>
