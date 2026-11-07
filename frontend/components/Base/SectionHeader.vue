<template>
  <div class="pb-3">
    <CardTitle class="flex items-center text-xl">
      <slot />
    </CardTitle>
    <slot name="subtitle" />
    <CardDescription v-if="$slots.description" class="mt-1 font-normal">
      <slot name="description" />
    </CardDescription>
    <div v-if="$slots.after">
      <slot name="after" />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { CardDescription, CardTitle } from "@/components/ui/card";
</script>
