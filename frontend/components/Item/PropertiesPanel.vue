<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ChevronsUpDown, MapPin, Minus, Plus } from "@lucide/vue";
  import type { EntityOut, EntityPatch, EntityUpdate } from "~/lib/api/types/data-contracts";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { useTagStore } from "~/stores/tags";
  import { Button } from "@/components/ui/button";
  import { Switch } from "@/components/ui/switch";
  import TagChip from "~/components/Tag/Chip.vue";
  import DateTime from "~/components/global/DateTime.vue";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import InlineDate from "~/components/Item/Inline/Date.vue";
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";
  import TagPicker from "~/components/Item/Inline/TagPicker.vue";

  /**
   * The item page's properties column, grouped like the design (basics,
   * Product, Purchase). Every value is edited in place: place, quantity and
   * tags are emitted as PATCH changes, the rest as PUT changes.
   */
  const props = defineProps<{ item: EntityOut }>();
  const emit = defineEmits<{
    patch: [changes: Omit<EntityPatch, "id">];
    update: [changes: Partial<EntityUpdate>];
    quantity: [quantity: number];
  }>();

  /** Open state of the place picker, so the page's M shortcut can open it. */
  const placeOpen = defineModel<boolean>("placeOpen", { default: false });

  const { t } = useI18n();
  const tagStore = useTagStore();
  const places = useFlatLocations();

  /** An item sits in a place or inside another item (a container). */
  const inContainer = computed(() => !!props.item.parent && !places.value.some(p => p.id === props.item.parent!.id));

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
      <PlacePicker
        v-model:open="placeOpen"
        :current-id="item.parent?.id"
        align="end"
        @pick="place => emit('patch', { parentId: place.id })"
      >
        <button
          type="button"
          class="group flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left shadow-xs transition-colors hover:border-ring/50"
          :aria-label="t('shell.item_page.move_to')"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MapPin class="size-4" aria-hidden="true" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-[11px] text-muted-foreground">{{ t("shell.item_page.place") }}</span>
            <span
              class="truncate text-sm font-medium"
              :class="{ 'text-muted-foreground': !item.location && !item.parent }"
            >
              {{ item.location?.name ?? item.parent?.name ?? t("shell.item_page.no_place") }}
            </span>
            <span v-if="placePath" class="truncate text-xs text-muted-foreground">{{ placePath }}</span>
          </span>
          <ShortcutHint :hotkey="SHORTCUTS.itemMove" />
          <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PlacePicker>
      <NuxtLink
        v-if="inContainer && item.parent"
        :to="`/item/${item.parent.id}`"
        class="-mt-1 truncate px-1 text-xs text-muted-foreground hover:underline"
      >
        {{ t("shell.item_page.in_container", { name: item.parent.name }) }}
      </NuxtLink>

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

      <div class="flex flex-wrap items-center gap-1 pt-0.5">
        <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
        <TagPicker v-model="tagIds" v-model:open="tagPickerOpen">
          <button
            type="button"
            class="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            :aria-label="t('shell.item_page.add_tags')"
          >
            <Plus class="size-3" />
            <span v-if="itemTags.length === 0">{{ t("shell.item_page.add_tags") }}</span>
          </button>
        </TagPicker>
      </div>
    </div>

    <section>
      <h3 :class="heading">{{ t("shell.item_page.group_product") }}</h3>
      <dl class="flex flex-col">
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
      </dl>
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
