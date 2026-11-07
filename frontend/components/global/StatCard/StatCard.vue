<template>
  <Card class="flex flex-col gap-3 p-4 sm:p-5">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm text-muted-foreground">{{ title }}</span>
      <span
        v-if="icon"
        class="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"
        aria-hidden="true"
      >
        <component :is="icon" class="size-4" />
      </span>
    </div>
    <div class="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
      <Currency v-if="type === 'currency'" :amount="value" />
      <template v-if="type === 'number'">{{ value }}</template>
    </div>
    <p v-if="subtitle" class="text-sm text-muted-foreground">{{ subtitle }}</p>
  </Card>
</template>

<script setup lang="ts">
  import type { Component } from "vue";
  import Currency from "../Currency.vue";
  import type { StatsFormat } from "./types";
  import { Card } from "@/components/ui/card";

  type Props = {
    title: string;
    value: number;
    subtitle?: string;
    type?: StatsFormat;
    icon?: Component;
  };

  withDefaults(defineProps<Props>(), {
    type: "number",
    subtitle: undefined,
    icon: undefined,
  });
</script>
