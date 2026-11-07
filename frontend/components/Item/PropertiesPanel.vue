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
  import PlacePicker from "~/components/Item/Inline/PlacePicker.vue";
  import TagPicker from "~/components/Item/Inline/TagPicker.vue";

  /**
   * The item page's properties list: every value is edited in place. Place,
   * quantity and tags are emitted as PATCH changes, the rest as PUT changes.
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

  const textProperties = [
    { key: "assetId", label: "items.asset_id", mono: true },
    { key: "serialNumber", label: "items.serial_number", mono: true },
    { key: "modelNumber", label: "items.model_number", mono: false },
    { key: "manufacturer", label: "items.manufacturer", mono: false },
  ] as const;

  const toggleProperties = [
    { key: "insured", label: "items.insured" },
    { key: "archived", label: "items.archived" },
  ] as const;
</script>

<template>
  <section :aria-label="t('shell.item_page.properties')">
    <h2 class="mb-2 px-1.5 text-xs font-medium text-muted-foreground">{{ t("shell.item_page.properties") }}</h2>
    <dl class="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5 text-sm">
      <dt class="px-1.5 text-muted-foreground">{{ t("shell.item_page.place") }}</dt>
      <dd class="min-w-0">
        <PlacePicker
          v-model:open="placeOpen"
          :current-id="item.parent?.id"
          align="end"
          @pick="place => emit('patch', { parentId: place.id })"
        >
          <button
            type="button"
            class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-accent"
            :aria-label="t('shell.item_page.move_to')"
          >
            <MapPin class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span class="truncate" :class="{ 'text-muted-foreground': !item.location && !item.parent }">
              {{ item.location?.name ?? item.parent?.name ?? t("shell.item_page.no_place") }}
            </span>
            <ShortcutHint :hotkey="SHORTCUTS.itemMove" class="ml-auto max-sm:hidden" />
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

      <dt class="px-1.5 text-muted-foreground">{{ $t("items.quantity") }}</dt>
      <dd class="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          class="size-7"
          :disabled="item.quantity <= 0"
          :aria-label="t('shell.items_page.decrease')"
          @click="emit('quantity', item.quantity - 1)"
        >
          <Minus class="size-3.5" />
        </Button>
        <InlineText
          :value="String(item.quantity)"
          :label="t('items.quantity')"
          class="w-12 text-center tabular-nums"
          @save="v => emit('quantity', Number(v))"
        />
        <Button
          variant="ghost"
          size="icon"
          class="size-7"
          :aria-label="t('shell.items_page.increase')"
          @click="emit('quantity', item.quantity + 1)"
        >
          <Plus class="size-3.5" />
        </Button>
      </dd>

      <dt class="self-start px-1.5 py-1 text-muted-foreground">{{ $t("global.tags") }}</dt>
      <dd class="flex min-w-0 flex-wrap items-center gap-1 px-1.5 py-0.5">
        <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
        <TagPicker v-model="tagIds" v-model:open="tagPickerOpen">
          <button
            type="button"
            class="inline-flex h-6 items-center gap-1 rounded-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            :aria-label="t('shell.item_page.add_tags')"
          >
            <Plus class="size-3.5" />
            <span v-if="itemTags.length === 0">{{ t("shell.item_page.add_tags") }}</span>
          </button>
        </TagPicker>
      </dd>

      <template v-for="field in textProperties" :key="field.key">
        <dt class="truncate px-1.5 text-muted-foreground">{{ $t(field.label) }}</dt>
        <dd class="min-w-0">
          <InlineText
            :value="item[field.key]"
            :label="$t(field.label)"
            :class="{ 'font-mono text-xs': field.mono }"
            @save="v => emit('update', { [field.key]: v })"
          />
        </dd>
      </template>

      <template v-for="field in toggleProperties" :key="field.key">
        <dt class="px-1.5 text-muted-foreground">{{ $t(field.label) }}</dt>
        <dd class="px-1.5 py-1">
          <Switch
            :model-value="item[field.key]"
            :aria-label="$t(field.label)"
            @update:model-value="v => emit('update', { [field.key]: v })"
          />
        </dd>
      </template>
    </dl>

    <dl class="mt-6 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-1 gap-y-1.5 border-t border-border pt-4 text-xs">
      <dt class="px-1.5 text-muted-foreground">{{ t("shell.item_page.created") }}</dt>
      <dd class="px-1.5"><DateTime :date="item.createdAt" /></dd>
      <dt class="px-1.5 text-muted-foreground">{{ t("shell.item_page.updated") }}</dt>
      <dd class="px-1.5"><DateTime :date="item.updatedAt" /></dd>
    </dl>
  </section>
</template>
