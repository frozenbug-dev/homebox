<script setup lang="ts">
  import { Check, X } from "@lucide/vue";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

  /**
   * A removable "<label> is <values>" filter token whose values are picked from
   * a searchable list. Picks are applied when the list closes, so the token (and
   * the popover hanging off it) doesn't change size while you're choosing.
   */
  const props = defineProps<{
    label: string;
    options: { id: string; name: string; treeString?: string }[];
  }>();
  const emit = defineEmits<{ remove: [] }>();

  const selected = defineModel<string[]>({ required: true });
  const open = defineModel<boolean>("open", { default: false });

  /** The picks while the list is open. */
  const draft = ref<string[]>([...selected.value]);
  watch(open, isOpen => {
    if (isOpen) draft.value = [...selected.value];
    else if (draft.value.join() !== selected.value.join()) selected.value = draft.value;
  });

  const names = computed(() =>
    props.options
      .filter(o => selected.value.includes(o.id))
      .map(o => o.name)
      .join(", ")
  );

  function toggle(id: string) {
    draft.value = draft.value.includes(id) ? draft.value.filter(s => s !== id) : [...draft.value, id];
  }
</script>

<template>
  <span class="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button type="button" class="flex h-full max-w-72 items-center gap-1 rounded-l-md px-2 hover:bg-accent">
          <span class="text-muted-foreground">{{ label }}</span>
          <span class="truncate font-medium">{{ names || "…" }}</span>
        </button>
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
                v-for="o in options"
                :key="o.id"
                :value="o.treeString ?? o.name"
                class="gap-2"
                @select.prevent="toggle(o.id)"
              >
                <span
                  class="flex size-4 shrink-0 items-center justify-center rounded border border-input"
                  :class="{ 'border-primary bg-primary text-primary-foreground': draft.includes(o.id) }"
                  aria-hidden="true"
                >
                  <Check v-if="draft.includes(o.id)" class="size-3" />
                </span>
                <span class="truncate">{{ o.name }}</span>
                <span
                  v-if="o.treeString && o.treeString !== o.name"
                  class="ml-auto truncate text-xs text-muted-foreground"
                >
                  {{ o.treeString }}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <button
      type="button"
      class="flex h-full items-center rounded-r-md px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      :aria-label="$t('shell.items_page.remove_filter', { label })"
      @click="emit('remove')"
    >
      <X class="size-3.5" />
    </button>
  </span>
</template>
