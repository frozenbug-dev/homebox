<script setup lang="ts">
  import { Ban, Search } from "@lucide/vue";
  import { useI18n } from "vue-i18n";
  import { iconLabel, searchIcons } from "~/lib/icons";

  const props = withDefaults(defineProps<{ modelValue?: string; autofocus?: boolean }>(), {
    modelValue: "",
    autofocus: true,
  });
  const emit = defineEmits<{ "update:modelValue": [value: string] }>();

  const { t } = useI18n();
  const query = ref("");
  const results = computed(() => searchIcons(query.value));
  const input = ref<HTMLInputElement>();

  onMounted(() => {
    if (props.autofocus) nextTick(() => input.value?.focus());
  });

  function select(name: string) {
    emit("update:modelValue", props.modelValue === name ? "" : name);
  }

  function onEnter() {
    const first = results.value[0];
    if (first) select(first.name);
  }
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref="input"
        v-model="query"
        type="search"
        :placeholder="t('components.form.icon_selector.search')"
        :aria-label="t('components.form.icon_selector.search')"
        class="h-8 w-full rounded-md border border-border bg-transparent pr-2 pl-7 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 max-md:text-base"
        @keydown.enter.prevent="onEnter"
      />
    </div>
    <div class="-mr-1 max-h-56 overflow-y-auto pr-1">
      <div
        v-if="results.length || !query"
        class="grid grid-cols-8 gap-0.5"
        role="group"
        :aria-label="t('components.form.icon_selector.search')"
      >
        <button
          v-if="!query"
          type="button"
          class="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          :class="{ 'bg-muted text-foreground': !modelValue }"
          :aria-label="t('components.form.icon_selector.no_icon')"
          :title="t('components.form.icon_selector.no_icon')"
          :aria-pressed="!modelValue"
          @click="emit('update:modelValue', '')"
        >
          <Ban class="size-4" />
        </button>
        <button
          v-for="ic in results"
          :key="ic.name"
          type="button"
          class="flex size-8 items-center justify-center rounded-md hover:bg-muted"
          :class="modelValue === ic.name ? 'bg-primary/15 text-primary' : 'text-foreground/80'"
          :aria-label="iconLabel(ic.name)"
          :title="iconLabel(ic.name)"
          :aria-pressed="modelValue === ic.name"
          @click="select(ic.name)"
        >
          <component :is="ic.component" class="size-[18px]" />
        </button>
      </div>
      <p v-else class="py-6 text-center text-xs text-muted-foreground">
        {{ t("components.form.icon_selector.no_results") }}
      </p>
    </div>
  </div>
</template>
