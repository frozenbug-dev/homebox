<script setup lang="ts">
  import type { Component } from "vue";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { cn } from "@/lib/utils";

  /**
   * A property of the thing being created, as a small button that opens its
   * picker. Empty, it shows `label` greyed out with a dashed border; set, it shows its value
   * (default slot of `value`, or the `value` prop) after an optional muted
   * `prefix` such as "Qty".
   */
  const props = withDefaults(
    defineProps<{
      label: string;
      icon?: Component;
      value?: string;
      prefix?: string;
      /** Set even without a `value` string, e.g. when the `value` slot draws it. */
      filled?: boolean;
      iconClass?: string;
      contentClass?: string;
      align?: "start" | "center" | "end";
    }>(),
    {
      icon: undefined,
      value: undefined,
      prefix: undefined,
      filled: false,
      iconClass: undefined,
      contentClass: undefined,
      align: "start",
    }
  );

  defineSlots<{ value?(): unknown; default(props: { close: () => void }): unknown }>();

  const open = defineModel<boolean>("open", { default: false });
  const isSet = computed(() => props.filled || !!props.value);
  const close = () => (open.value = false);
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="
          cn(
            'inline-flex h-7 max-w-full items-center gap-1.5 rounded-[7px] border border-border bg-background px-2.5 text-[13px] whitespace-nowrap transition-colors hover:bg-muted max-md:h-9 max-md:px-3 max-md:text-sm',
            !isSet && 'border-dashed border-input text-muted-foreground',
            open && 'border-primary ring-[3px] ring-primary/15'
          )
        "
        :aria-label="isSet ? undefined : label"
      >
        <component :is="icon" v-if="icon" :class="cn('size-3.5 shrink-0 text-muted-foreground', iconClass)" />
        <template v-if="isSet">
          <span v-if="prefix" class="text-muted-foreground">{{ prefix }}</span>
          <slot name="value">
            <span class="truncate">{{ value }}</span>
          </slot>
        </template>
        <span v-else>{{ label }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent :align="align" :class="cn('w-64 p-0', contentClass)" @keydown.esc.stop="close">
      <slot :close="close" />
    </PopoverContent>
  </Popover>
</template>
