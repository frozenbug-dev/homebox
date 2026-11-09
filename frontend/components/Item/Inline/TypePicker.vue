<script setup lang="ts">
  import type { EntityTypeSummary } from "~~/lib/api/types/data-contracts";
  import { useEntityTypeStore } from "~/stores/entityTypes";
  import { getIconComponent } from "~/lib/icons";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

  /** Pick an item entity type (not a place type). The trigger is the default slot. */
  const props = defineProps<{ currentId?: string; align?: "start" | "end" }>();
  const emit = defineEmits<{ pick: [type: EntityTypeSummary] }>();

  const open = defineModel<boolean>("open", { default: false });
  const store = useEntityTypeStore();
  onMounted(() => store.ensureFetched());

  function pick(type: EntityTypeSummary) {
    open.value = false;
    if (type.id !== props.currentId) emit("pick", type);
  }
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent class="w-56 p-0" :align="align ?? 'start'" @click.stop>
      <Command>
        <CommandInput :placeholder="$t('components.search.filter.search_placeholder')" @keydown.esc="open = false" />
        <CommandList class="max-h-64">
          <CommandEmpty class="py-4 text-center text-sm text-muted-foreground">{{
            $t("shell.palette.no_results")
          }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="type in store.itemTypes"
              :key="type.id"
              :value="type.name"
              class="gap-2"
              @select="pick(type)"
            >
              <component :is="getIconComponent(type.icon)" class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate" :class="{ 'font-medium': type.id === currentId }">{{ type.name }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
