<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { MapPin, Minus, Plus } from "@lucide/vue";
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

  const formatCurrency = shallowRef<((value: number | string) => string) | null>(null);
  useFormatCurrency().then(fn => (formatCurrency.value = fn));
  const price = computed(() =>
    props.item.purchasePrice
      ? (formatCurrency.value?.(props.item.purchasePrice) ?? String(props.item.purchasePrice))
      : ""
  );

  function savePrice(value: string) {
    const n = Number.parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    emit("update", { purchasePrice: Number.isFinite(n) ? n : 0 });
  }
</script>

<template>
  <section :aria-label="t('shell.item_page.properties')" class="flex flex-col gap-[18px] text-[13px]">
    <dl class="flex flex-col">
      <div
        class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
      >
        <dt>{{ t("shell.item_page.place") }}</dt>
        <dd>
          <PlacePicker
            v-model:open="placeOpen"
            :current-id="item.parent?.id"
            align="end"
            @pick="place => emit('patch', { parentId: place.id })"
          >
            <button
              type="button"
              class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted"
              :aria-label="t('shell.item_page.move_to')"
            >
              <MapPin class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span class="truncate" :class="{ 'text-muted-foreground': !item.location && !item.parent }">
                {{ item.location?.name ?? item.parent?.name ?? t("shell.item_page.no_place") }}
              </span>
              <ShortcutHint :hotkey="SHORTCUTS.itemMove" class="max-sm:hidden" />
            </button>
          </PlacePicker>
          <NuxtLink
            v-if="inContainer && item.parent"
            :to="`/item/${item.parent.id}`"
            class="block truncate px-1.5 pb-1 text-xs text-muted-foreground hover:underline"
          >
            {{ t("shell.item_page.in_container", { name: item.parent.name }) }}
          </NuxtLink>
        </dd>
      </div>

      <div
        class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
      >
        <dt class="self-start pt-1.5">{{ $t("global.tags") }}</dt>
        <dd class="flex flex-wrap items-center gap-1 px-1.5 py-1">
          <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
          <TagPicker v-model="tagIds" v-model:open="tagPickerOpen">
            <button
              type="button"
              class="inline-flex h-6 items-center gap-1 rounded-md px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              :aria-label="t('shell.item_page.add_tags')"
            >
              <Plus class="size-3.5" />
              <span v-if="itemTags.length === 0">{{ t("shell.item_page.add_tags") }}</span>
            </button>
          </TagPicker>
        </dd>
      </div>

      <div
        class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
      >
        <dt>{{ $t("items.quantity") }}</dt>
        <dd class="flex items-center gap-0.5">
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
          <InlineText
            :value="String(item.quantity)"
            :label="t('items.quantity')"
            class="w-10 text-center tabular-nums"
            @save="v => emit('quantity', Number(v))"
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
        </dd>
      </div>

      <div
        class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
      >
        <dt>{{ $t("items.asset_id") }}</dt>
        <dd>
          <InlineText
            :value="item.assetId"
            :label="$t('items.asset_id')"
            class="font-mono text-xs"
            @save="v => emit('update', { assetId: v })"
          />
        </dd>
      </div>

      <div
        class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
      >
        <dt>{{ $t("items.archived") }}</dt>
        <dd class="px-1.5 py-1">
          <Switch
            :model-value="item.archived"
            :aria-label="$t('items.archived')"
            class="scale-90"
            @update:model-value="v => emit('update', { archived: v })"
          />
        </dd>
      </div>
    </dl>

    <div>
      <h3 class="pb-1.5 text-xs font-medium text-muted-foreground">{{ t("shell.item_page.group_product") }}</h3>
      <dl class="flex flex-col">
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
          <dt>{{ $t("items.manufacturer") }}</dt>
          <dd>
            <InlineText
              :value="item.manufacturer"
              :label="$t('items.manufacturer')"
              @save="v => emit('update', { manufacturer: v })"
            />
          </dd>
        </div>
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
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
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
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
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
          <dt>{{ $t("items.insured") }}</dt>
          <dd class="px-1.5 py-1">
            <Switch
              :model-value="item.insured"
              :aria-label="$t('items.insured')"
              class="scale-90"
              @update:model-value="v => emit('update', { insured: v })"
            />
          </dd>
        </div>
      </dl>
    </div>

    <div>
      <h3 class="pb-1.5 text-xs font-medium text-muted-foreground">{{ t("shell.item_page.group_purchase") }}</h3>
      <dl class="flex flex-col">
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
          <dt>{{ t("shell.item_page.from") }}</dt>
          <dd>
            <InlineText
              :value="item.purchaseFrom"
              :label="$t('items.purchased_from')"
              @save="v => emit('update', { purchaseFrom: v })"
            />
          </dd>
        </div>
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
          <dt>{{ t("shell.item_page.price") }}</dt>
          <dd>
            <InlineText
              :value="item.purchasePrice ? String(item.purchasePrice) : ''"
              :display="price"
              :label="$t('items.purchase_price')"
              class="tabular-nums"
              @save="savePrice"
            />
          </dd>
        </div>
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
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
        <div
          class="grid min-h-[34px] grid-cols-[110px_minmax(0,1fr)] items-center [&>dd]:min-w-0 [&>dt]:text-muted-foreground"
        >
          <dt>{{ t("shell.item_page.warranty") }}</dt>
          <dd>
            <span v-if="item.lifetimeWarranty" class="block px-1.5 py-1">{{ $t("items.lifetime_warranty") }}</span>
            <InlineDate
              v-else
              :value="item.warrantyExpires"
              :placeholder="t('shell.item_page.set_expiry')"
              :label="$t('items.warranty_expires')"
              @save="v => emit('update', { warrantyExpires: v })"
            />
          </dd>
        </div>
      </dl>
    </div>

    <NuxtLink
      :to="`/item/${item.id}/edit`"
      class="self-start rounded-md px-1.5 py-1 text-[13px] font-medium text-primary hover:bg-muted"
    >
      + {{ t("shell.item_page.add_field") }}
    </NuxtLink>

    <dl class="grid grid-cols-[110px_minmax(0,1fr)] gap-y-1.5 border-t border-border/70 pt-4 text-xs">
      <dt class="text-muted-foreground">{{ t("shell.item_page.created") }}</dt>
      <dd class="px-1.5"><DateTime :date="item.createdAt" /></dd>
      <dt class="text-muted-foreground">{{ t("shell.item_page.updated") }}</dt>
      <dd class="px-1.5"><DateTime :date="item.updatedAt" /></dd>
    </dl>
  </section>
</template>
