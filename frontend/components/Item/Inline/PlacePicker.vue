<script setup lang="ts">
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

  /** A searchable place list in a popover. The trigger is the default slot. */
  const props = defineProps<{
    currentId?: string;
    align?: "start" | "end";
    /** Places that can't be picked, e.g. a place and its sub-places when choosing its parent. */
    excludeIds?: string[];
    /** Offer "Top level" (no parent); picking it emits `top`. */
    allowTop?: boolean;
  }>();
  const emit = defineEmits<{ pick: [place: FlatTreeItem]; top: [] }>();

  const open = defineModel<boolean>("open", { default: false });
  const allPlaces = useFlatLocations();
  const places = computed(() =>
    props.excludeIds?.length ? allPlaces.value.filter(p => !props.excludeIds!.includes(p.id)) : allPlaces.value
  );

  function pick(place: FlatTreeItem) {
    open.value = false;
    if (place.id !== props.currentId) emit("pick", place);
  }
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent class="w-64 p-0" :align="align ?? 'start'" @click.stop>
      <Command>
        <CommandInput :placeholder="$t('components.search.filter.search_placeholder')" @keydown.esc="open = false" />
        <CommandList class="max-h-64">
          <CommandEmpty class="py-4 text-center text-sm text-muted-foreground">{{
            $t("shell.palette.no_results")
          }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-if="allowTop"
              value="__top__"
              class="text-muted-foreground"
              @select="((open = false), currentId && emit('top'))"
            >
              {{ $t("shell.places_page.top_level") }}
            </CommandItem>
            <CommandItem v-for="place in places" :key="place.id" :value="place.treeString" @select="pick(place)">
              <span class="truncate" :class="{ 'font-medium': place.id === currentId }">{{ place.name }}</span>
              <span v-if="place.treeString !== place.name" class="ml-auto truncate text-xs text-muted-foreground">
                {{ place.treeString }}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
