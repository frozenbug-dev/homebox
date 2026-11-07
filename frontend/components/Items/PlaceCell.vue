<script setup lang="ts">
  import { MapPin } from "@lucide/vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

  /**
   * The Place cell: click to move the item to another place. Only offered when
   * the item sits directly in a place; an item inside another item keeps its
   * container, so moving it goes through the full edit form.
   */
  const props = defineProps<{ item: EntitySummary; places: FlatTreeItem[]; placeIds: Set<string> }>();
  const emit = defineEmits<{ move: [place: FlatTreeItem] }>();

  const open = defineModel<boolean>("open", { default: false });
  const editable = computed(() => !props.item.parent || props.placeIds.has(props.item.parent.id));

  function pick(place: FlatTreeItem) {
    open.value = false;
    if (place.id !== props.item.parent?.id) emit("move", place);
  }
</script>

<template>
  <Popover v-if="editable" v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground/80 hover:bg-accent hover:text-foreground"
        @click.stop
      >
        <MapPin class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="truncate">{{ item.parent?.name ?? "—" }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-64 p-0" align="start" @click.stop>
      <Command>
        <CommandInput :placeholder="$t('components.search.filter.search_placeholder')" />
        <CommandList class="max-h-64">
          <CommandEmpty class="py-4 text-center text-sm text-muted-foreground">{{
            $t("shell.palette.no_results")
          }}</CommandEmpty>
          <CommandGroup>
            <CommandItem v-for="place in places" :key="place.id" :value="place.treeString" @select="pick(place)">
              <span class="truncate" :class="{ 'font-medium': place.id === item.parent?.id }">{{ place.name }}</span>
              <span v-if="place.treeString !== place.name" class="ml-auto truncate text-xs text-muted-foreground">
                {{ place.treeString }}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
  <NuxtLink
    v-else-if="item.parent"
    :to="`/item/${item.parent.id}`"
    class="inline-flex max-w-full items-center gap-1.5 px-1.5 text-sm text-muted-foreground hover:underline"
    @click.stop
  >
    <span class="truncate">{{ item.parent.name }}</span>
  </NuxtLink>
</template>
