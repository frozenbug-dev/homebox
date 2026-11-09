<script setup lang="ts">
  import type { EntitySummary } from "~~/lib/api/types/data-contracts";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

  /**
   * Pick an item to put this one inside, searched on the server as you type.
   * The trigger is the default slot. With `clearLabel`, a first entry emits
   * `clear` (take it out of its container).
   */
  const props = defineProps<{
    currentId?: string;
    align?: "start" | "end";
    /** Items that can't be picked, e.g. the item itself and its contents. */
    excludeIds?: string[];
    clearLabel?: string;
  }>();
  const emit = defineEmits<{ pick: [item: EntitySummary]; clear: [] }>();

  const open = defineModel<boolean>("open", { default: false });
  const api = useUserApi();
  const { query, results, isLoading, triggerSearch } = useItemSearch(api, { immediate: false });

  watch(open, isOpen => {
    if (isOpen) {
      query.value = "";
      triggerSearch();
    }
  });

  const items = computed(() =>
    results.value.filter(i => !i.entityType?.isLocation && !props.excludeIds?.includes(i.id))
  );

  function pick(item: EntitySummary) {
    open.value = false;
    if (item.id !== props.currentId) emit("pick", item);
  }
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent class="w-72 p-0" :align="align ?? 'start'" @click.stop>
      <Command ignore-filter>
        <CommandInput
          v-model="query"
          :placeholder="$t('components.search.filter.search_placeholder')"
          @keydown.esc="open = false"
        />
        <CommandList class="max-h-64">
          <CommandEmpty v-if="!isLoading" class="py-4 text-center text-sm text-muted-foreground">{{
            $t("shell.palette.no_results")
          }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-if="clearLabel && currentId"
              value="__clear__"
              class="text-muted-foreground"
              @select="((open = false), emit('clear'))"
            >
              {{ clearLabel }}
            </CommandItem>
            <CommandItem v-for="item in items" :key="item.id" :value="item.id" @select="pick(item)">
              <span class="truncate" :class="{ 'font-medium': item.id === currentId }">{{ item.name }}</span>
              <span v-if="item.parent" class="ml-auto truncate text-xs text-muted-foreground">
                {{ item.parent.name }}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
