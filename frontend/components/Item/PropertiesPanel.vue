<script setup lang="ts">
  import { NuxtLink } from "#components";
  import { useI18n } from "vue-i18n";
  import { ChevronDown, ChevronsUpDown, MapPin, Minus, Package, Plus, X } from "@lucide/vue";
  import type { EntityOut, EntityPatch, EntitySummary, EntityUpdate } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { useTagStore } from "~/stores/tags";
  import { Button } from "@/components/ui/button";
  import { Switch } from "@/components/ui/switch";
  import { Pill } from "@/components/ui/pill";
  import { getIconComponent } from "~/lib/icons";
  import DateTime from "~/components/global/DateTime.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import InlineDate from "~/components/Item/Inline/Date.vue";
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";
  import TagPicker from "~/components/Item/Inline/TagPicker.vue";
  import ItemPicker from "~/components/Item/Inline/ItemPicker.vue";
  import TypePicker from "~/components/Item/Inline/TypePicker.vue";
  import FieldsEditor from "~/components/Item/FieldsEditor.vue";

  /**
   * The item page's properties column, grouped like the design (basics,
   * Product, Purchase). Every value is edited in place: place, quantity and
   * tags are emitted as PATCH changes, the rest as PUT changes.
   */
  const props = defineProps<{
    item: EntityOut;
    /** The items directly inside this one: they can't become its container. */
    contents?: EntitySummary[];
  }>();
  const emit = defineEmits<{
    patch: [changes: Omit<EntityPatch, "id">];
    update: [changes: Partial<EntityUpdate>];
    quantity: [quantity: number];
    /** Put it inside another item, or take it out (null) and leave it where it is. */
    container: [container: EntitySummary | null];
  }>();

  /** Open state of the place picker, so the page's M shortcut can open it. */
  const placeOpen = defineModel<boolean>("placeOpen", { default: false });

  const { t } = useI18n();
  const tagStore = useTagStore();
  const places = useFlatLocations();

  /** An item sits in a place or inside another item (a container). */
  const inContainer = computed(() => !!props.item.parent && !places.value.some(p => p.id === props.item.parent!.id));

  /** A part follows its container's place unless it has one of its own. */
  const placeLabel = computed(() => {
    return inContainer.value && props.item.locationId
      ? t("shell.item_page.place_stored_apart")
      : t("shell.item_page.place");
  });

  /**
   * Moving a part sets its own location and keeps it in the container;
   * re-parenting it to the place would silently take it out.
   */
  function pickPlace(place: FlatTreeItem) {
    emit("patch", inContainer.value ? { locationId: place.id } : { parentId: place.id });
  }

  const containerOpen = ref(false);
  const containerExclude = computed(() => [props.item.id, ...(props.contents ?? []).map(c => c.id)]);

  const typeOpen = ref(false);

  const fieldsEditor = useTemplateRef<InstanceType<typeof FieldsEditor>>("fieldsEditor");

  const itemTags = computed(() => tagStore.withAncestors(props.item.tags));
  const tagPickerOpen = ref(false);
  const tagIds = computed({
    get: () => props.item.tags.map(tag => tag.id),
    set: ids => emit("patch", { tagIds: ids }),
  });

  /** The quantity box: a fixed-width field so the − and + buttons never move while typing. */
  const quantityDraft = ref(String(props.item.quantity));
  watch(
    () => props.item.quantity,
    q => (quantityDraft.value = String(q))
  );
  function saveQuantity() {
    const n = Math.max(0, Math.floor(Number(quantityDraft.value)));
    if (Number.isFinite(n) && n !== props.item.quantity) emit("quantity", n);
    else quantityDraft.value = String(props.item.quantity);
  }
  function cancelQuantity(e: KeyboardEvent) {
    quantityDraft.value = String(props.item.quantity);
    (e.target as HTMLInputElement).blur();
  }

  const formatCurrency = shallowRef<((value: number | string) => string) | null>(null);
  useFormatCurrency().then(fn => (formatCurrency.value = fn));
  const price = computed(() =>
    props.item.purchasePrice
      ? (formatCurrency.value?.(props.item.purchasePrice) ?? String(props.item.purchasePrice))
      : ""
  );

  /** Where the item sits, as "Garage / Shelf 2", for the line under the place name. */
  const placePath = computed(() => {
    const id = props.item.location?.id ?? (inContainer.value ? undefined : props.item.parent?.id);
    const path = places.value.find(p => p.id === id)?.treeString ?? "";
    const parts = path.split(" / ");
    return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
  });

  /** Zero dates come back as year 1; treat them as unset. */
  const warrantyState = computed<"lifetime" | "active" | "expired" | null>(() => {
    if (props.item.lifetimeWarranty) return "lifetime";
    const d = props.item.warrantyExpires ? new Date(props.item.warrantyExpires) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getFullYear() <= 1) return null;
    return d.getTime() < Date.now() ? "expired" : "active";
  });

  const row =
    "grid min-h-8 grid-cols-[96px_minmax(0,1fr)] items-center gap-2 [&>dt]:text-muted-foreground [&>dd]:min-w-0";
  const heading = "mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";

  function savePrice(value: string) {
    const n = Number.parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    emit("update", { purchasePrice: Number.isFinite(n) ? n : 0 });
  }
</script>

<template>
  <section :aria-label="t('shell.item_page.properties')" class="flex flex-col gap-5 text-[13px]">
    <!-- Where it is, how many, and how it's tagged: the things people change most -->
    <div class="flex flex-col gap-2.5">
      <!-- One card: where it is, and for a part, the item it belongs to -->
      <div class="overflow-hidden rounded-lg border border-border bg-background shadow-xs">
        <PlacePicker
          v-model:open="placeOpen"
          :current-id="(inContainer ? item.locationId : item.parent?.id) ?? undefined"
          :allow-top="inContainer && !!item.locationId"
          :top-label="t('shell.item_page.follow_container')"
          align="end"
          @pick="pickPlace"
          @top="emit('update', { locationId: null })"
        >
          <button
            type="button"
            class="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            :aria-label="t('shell.item_page.move_to')"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin class="size-4" aria-hidden="true" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[11px] text-muted-foreground">{{ placeLabel }}</span>
              <span
                class="truncate text-sm font-medium"
                :class="{ 'text-muted-foreground': !item.location && !item.parent }"
              >
                {{
                  item.location?.name ?? (inContainer ? undefined : item.parent?.name) ?? t("shell.item_page.no_place")
                }}
              </span>
              <span v-if="placePath" class="truncate text-xs text-muted-foreground">{{ placePath }}</span>
            </span>
            <ShortcutHint :hotkey="SHORTCUTS.itemMove" />
            <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PlacePicker>
        <!-- Inside a container: the row opens it, and × takes the item out -->
        <div v-if="inContainer && item.parent" class="flex items-center border-t border-border">
          <NuxtLink
            :to="`/item/${item.parent.id}`"
            class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            :aria-label="t('shell.item_page.open_container', { name: item.parent.name })"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Package class="size-4" aria-hidden="true" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-[11px] text-muted-foreground">{{ t("shell.item_page.part_of") }}</span>
              <span class="truncate text-sm font-medium">{{ item.parent.name }}</span>
            </span>
          </NuxtLink>
          <button
            type="button"
            class="mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            :aria-label="t('shell.item_page.take_out')"
            :title="t('shell.item_page.take_out')"
            @click="emit('container', null)"
          >
            <X class="size-4" />
          </button>
        </div>
        <div v-else class="flex items-center border-t border-border">
          <ItemPicker
            v-model:open="containerOpen"
            :exclude-ids="containerExclude"
            align="end"
            @pick="c => emit('container', c)"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              :aria-label="t('shell.item_page.put_inside')"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Package class="size-4" aria-hidden="true" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-[11px] text-muted-foreground">{{ t("shell.item_page.part_of") }}</span>
                <span class="truncate text-sm text-muted-foreground">{{ t("shell.item_page.not_part_of") }}</span>
              </span>
              <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </ItemPicker>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 shadow-xs">
          <span class="text-[11px] text-muted-foreground">{{ $t("items.quantity") }}</span>
          <div class="-mx-1 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-muted-foreground"
              :disabled="item.quantity <= 0"
              :aria-label="t('shell.items_page.decrease')"
              @click="emit('quantity', item.quantity - 1)"
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
              @blur="saveQuantity"
              @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
              @keydown.esc.stop.prevent="cancelQuantity($event)"
            />
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-muted-foreground"
              :aria-label="t('shell.items_page.increase')"
              @click="emit('quantity', item.quantity + 1)"
            >
              <Plus class="size-3.5" />
            </Button>
          </div>
        </div>
        <div class="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 shadow-xs">
          <span class="text-[11px] text-muted-foreground">{{ $t("items.asset_id") }}</span>
          <InlineText
            :value="item.assetId"
            :label="$t('items.asset_id')"
            class="-mx-1.5 py-0.5 font-mono text-sm font-medium"
            @save="v => emit('update', { assetId: v })"
          />
        </div>
      </div>
    </div>

    <section>
      <h3 :class="heading">{{ $t("global.tags") }}</h3>
      <div class="flex flex-wrap items-center gap-1 pt-1">
        <Pill
          v-for="tag in itemTags"
          :key="tag.id"
          :as="NuxtLink"
          :to="`/tags?tag=${tag.id}`"
          :color="tag.ancestors ? undefined : tag.color || undefined"
          :icon="getIconComponent(tag.icon)"
          :dashed="tag.ancestors"
          class="hover:brightness-95 dark:hover:brightness-125"
        >
          {{ tag.name }}
        </Pill>
        <TagPicker v-model="tagIds" v-model:open="tagPickerOpen">
          <Pill v-if="itemTags.length === 0" as="button" dashed :icon="Plus">
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
          <dt>{{ $t("global.type") }}</dt>
          <dd>
            <TypePicker
              v-model:open="typeOpen"
              :current-id="item.entityType?.id"
              @pick="type => emit('update', { entityTypeId: type.id })"
            >
              <button
                type="button"
                class="flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted"
                :aria-label="$t('global.entity_type')"
              >
                <component
                  :is="getIconComponent(item.entityType?.icon)"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />
                <span class="truncate">{{ item.entityType?.name ?? "—" }}</span>
                <ChevronDown class="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </TypePicker>
          </dd>
        </div>
        <div :class="row">
          <dt>{{ $t("items.manufacturer") }}</dt>
          <dd>
            <InlineText
              :value="item.manufacturer"
              :label="$t('items.manufacturer')"
              @save="v => emit('update', { manufacturer: v })"
            />
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.model") }}</dt>
          <dd>
            <InlineText
              :value="item.modelNumber"
              :label="$t('items.model_number')"
              class="font-mono text-xs"
              @save="v => emit('update', { modelNumber: v })"
            />
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.serial") }}</dt>
          <dd>
            <InlineText
              :value="item.serialNumber"
              :label="$t('items.serial_number')"
              class="font-mono text-xs"
              @save="v => emit('update', { serialNumber: v })"
            />
          </dd>
        </div>
      </dl>
    </section>

    <section>
      <h3 :class="heading">{{ t("shell.item_page.group_purchase") }}</h3>
      <dl class="flex flex-col">
        <div :class="row">
          <dt>{{ t("shell.item_page.price") }}</dt>
          <dd>
            <InlineText
              :value="item.purchasePrice ? String(item.purchasePrice) : ''"
              :display="price"
              :label="$t('items.purchase_price')"
              class="font-medium tabular-nums"
              @save="savePrice"
            />
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.from") }}</dt>
          <dd>
            <InlineText
              :value="item.purchaseFrom"
              :label="$t('items.purchased_from')"
              @save="v => emit('update', { purchaseFrom: v })"
            />
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.date") }}</dt>
          <dd>
            <InlineDate
              :value="item.purchaseDate"
              :placeholder="t('shell.item_page.set_date')"
              :label="$t('items.purchase_date')"
              @save="v => emit('update', { purchaseDate: v })"
            />
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.warranty") }}</dt>
          <dd class="flex min-w-0 items-center gap-1.5">
            <span v-if="item.lifetimeWarranty" class="block px-1.5 py-1">{{ $t("items.lifetime_warranty") }}</span>
            <InlineDate
              v-else
              :value="item.warrantyExpires"
              :placeholder="t('shell.item_page.set_expiry')"
              :label="$t('items.warranty_expires')"
              class="min-w-0"
              @save="v => emit('update', { warrantyExpires: v })"
            />
            <span
              v-if="warrantyState === 'active' || warrantyState === 'expired'"
              class="shrink-0 rounded-full px-1.5 py-px text-[11px] font-medium"
              :class="warrantyState === 'active' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'"
            >
              {{
                warrantyState === "active"
                  ? t("shell.item_page.warranty_active")
                  : t("shell.item_page.warranty_expired")
              }}
            </span>
          </dd>
        </div>
        <div :class="row">
          <dt>{{ t("shell.item_page.lifetime") }}</dt>
          <dd class="flex justify-end">
            <Switch
              :model-value="item.lifetimeWarranty"
              :aria-label="$t('items.lifetime_warranty')"
              class="scale-90"
              @update:model-value="v => emit('update', { lifetimeWarranty: v })"
            />
          </dd>
        </div>
      </dl>
    </section>

    <section>
      <div class="mb-1 flex items-center justify-between">
        <h3 :class="heading.replace('mb-1', '')">
          {{ t("shell.item_page.fields") }}
        </h3>
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
      <FieldsEditor ref="fieldsEditor" compact :fields="item.fields" @save="fields => emit('update', { fields })" />
      <button
        v-if="item.fields.length === 0"
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
            :model-value="item.insured"
            class="scale-90"
            @update:model-value="v => emit('update', { insured: v })"
          />
        </label>
        <label class="flex min-h-8 items-center justify-between gap-2">
          <span class="text-muted-foreground">{{ $t("items.archived") }}</span>
          <Switch
            :model-value="item.archived"
            class="scale-90"
            @update:model-value="v => emit('update', { archived: v })"
          />
        </label>
        <label v-if="contents?.length" class="flex min-h-8 items-center justify-between gap-2">
          <span class="text-muted-foreground">{{ t("shell.item_page.contents_follow") }}</span>
          <Switch
            :model-value="item.syncChildEntityLocations"
            class="scale-90"
            @update:model-value="v => emit('update', { syncChildEntityLocations: v })"
          />
        </label>
      </div>
    </section>

    <dl
      class="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground"
    >
      <dt>{{ t("shell.item_page.created") }}</dt>
      <dd><DateTime :date="item.createdAt" /></dd>
      <dt>{{ t("shell.item_page.updated") }}</dt>
      <dd><DateTime :date="item.updatedAt" /></dd>
    </dl>
  </section>
</template>
