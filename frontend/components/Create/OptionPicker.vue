<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Check, Plus } from "@lucide/vue";
  import fuzzysort from "fuzzysort";
  import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
  } from "@/components/ui/command";

  export type PickerOption = {
    id: string;
    name: string;
    /** Shown muted on the right, and searched too (e.g. the place's path). */
    hint?: string;
    /** A dot before the name (tag colour). */
    color?: string;
  };

  /**
   * A searchable list for a property chip. Single choice closes on pick;
   * `multiple` toggles and stays open. `creatable` offers "Create “term”".
   * With `remote`, the parent filters (`search` v-model) and `options` are shown as given.
   */
  const props = withDefaults(
    defineProps<{
      options: PickerOption[];
      multiple?: boolean;
      placeholder?: string;
      /** Adds a first row that clears the choice, e.g. "No parent". */
      noneLabel?: string;
      creatable?: boolean;
      remote?: boolean;
      loading?: boolean;
    }>(),
    {
      multiple: false,
      placeholder: undefined,
      noneLabel: undefined,
      creatable: false,
      remote: false,
      loading: false,
    }
  );

  const emit = defineEmits<{ close: []; create: [name: string] }>();

  const selected = defineModel<string | string[] | null>({ required: true });
  const search = defineModel<string>("search", { default: "" });

  const { t } = useI18n();

  const isSelected = (id: string) =>
    Array.isArray(selected.value) ? selected.value.includes(id) : selected.value === id;

  const shown = computed(() => {
    if (props.remote || !search.value.trim()) return props.options;
    return fuzzysort.go(search.value, props.options, { keys: ["name", "hint"], threshold: 0 }).map(r => r.obj);
  });

  const term = computed(() => search.value.trim());
  const canCreate = computed(
    () => props.creatable && !!term.value && !props.options.some(o => o.name.toLowerCase() === term.value.toLowerCase())
  );

  function pick(id: string | null) {
    if (props.multiple) {
      const list = Array.isArray(selected.value) ? selected.value : [];
      selected.value = id === null ? [] : list.includes(id) ? list.filter(s => s !== id) : [...list, id];
      return;
    }
    selected.value = id;
    search.value = "";
    emit("close");
  }

  function create() {
    emit("create", term.value);
    search.value = "";
  }
</script>

<template>
  <Command :ignore-filter="true">
    <CommandInput
      v-model="search"
      :placeholder="placeholder ?? t('components.search.filter.search_placeholder')"
      class="h-9"
      @keydown.esc="emit('close')"
    />
    <CommandList class="max-h-64 border-t border-border p-1">
      <p v-if="loading" class="py-4 text-center text-sm text-muted-foreground">{{ t("global.loading") }}</p>
      <p v-else-if="shown.length === 0 && !canCreate" class="py-4 text-center text-sm text-muted-foreground">
        {{ t("shell.palette.no_results") }}
      </p>
      <CommandGroup v-if="noneLabel && !term" class="p-0">
        <CommandItem value="__none" class="gap-2 text-muted-foreground" @select.prevent="pick(null)">
          <span class="size-3.5" aria-hidden="true" />
          {{ noneLabel }}
        </CommandItem>
      </CommandGroup>
      <CommandGroup class="p-0">
        <CommandItem v-for="o in shown" :key="o.id" :value="o.id" class="gap-2" @select.prevent="pick(o.id)">
          <span
            v-if="multiple"
            class="flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-input"
            :class="{ 'border-primary bg-primary text-primary-foreground': isSelected(o.id) }"
            aria-hidden="true"
          >
            <Check v-if="isSelected(o.id)" class="size-2.5" :stroke-width="3" />
          </span>
          <span
            v-if="o.color !== undefined"
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: o.color || 'hsl(var(--muted-foreground) / 0.5)' }"
            aria-hidden="true"
          />
          <span class="truncate">{{ o.name }}</span>
          <span v-if="o.hint" class="ml-auto truncate pl-2 text-xs text-muted-foreground">{{ o.hint }}</span>
          <Check
            v-if="!multiple && isSelected(o.id)"
            class="size-3.5 shrink-0 text-primary"
            :class="{ 'ml-auto': !o.hint }"
          />
        </CommandItem>
      </CommandGroup>
      <template v-if="canCreate">
        <CommandSeparator class="my-1" />
        <CommandGroup class="p-0">
          <CommandItem value="__create" class="gap-2 text-muted-foreground" @select.prevent="create">
            <Plus class="size-3.5" />
            {{ t("shell.create.create_option", { name: term }) }}
          </CommandItem>
        </CommandGroup>
      </template>
    </CommandList>
  </Command>
</template>
