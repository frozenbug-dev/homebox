<script setup lang="ts">
  import { Check } from "@lucide/vue";
  import { useTagStore } from "~/stores/tags";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

  /** Toggle tags on and off from a searchable list. The trigger is the default slot. */
  const selected = defineModel<string[]>({ required: true });
  const open = defineModel<boolean>("open", { default: false });

  const tagStore = useTagStore();

  function toggle(id: string) {
    selected.value = selected.value.includes(id) ? selected.value.filter(s => s !== id) : [...selected.value, id];
  }
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent class="w-64 p-0" align="start">
      <Command>
        <CommandInput :placeholder="$t('components.search.filter.search_placeholder')" @keydown.esc="open = false" />
        <CommandList class="max-h-64">
          <CommandEmpty class="py-4 text-center text-sm text-muted-foreground">{{
            $t("shell.palette.no_results")
          }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="tag in tagStore.tags"
              :key="tag.id"
              :value="tag.name"
              class="gap-2"
              @select.prevent="toggle(tag.id)"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded border border-input"
                :class="{ 'border-primary bg-primary text-primary-foreground': selected.includes(tag.id) }"
                aria-hidden="true"
              >
                <Check v-if="selected.includes(tag.id)" class="size-3" />
              </span>
              <span
                v-if="tag.color"
                class="size-2 shrink-0 rounded-full"
                :style="{ backgroundColor: tag.color }"
                aria-hidden="true"
              />
              <span class="truncate">{{ tag.name }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
