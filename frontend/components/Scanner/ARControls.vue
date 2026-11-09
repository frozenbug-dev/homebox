<template>
  <div class="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between">
    <!-- Top bar -->
    <div class="pointer-events-auto flex items-center gap-3 bg-background/60 p-3 backdrop-blur-xs">
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('scanner_ar.back')"
        :title="t('scanner_ar.back')"
        @click="$emit('back')"
      >
        <ArrowLeft class="size-5" />
      </Button>
      <span class="text-sm font-semibold text-foreground">{{ t("scanner_ar.title") }}</span>
      <div class="grow" />
      <div v-if="isScanning" class="flex items-center gap-1.5">
        <span class="size-2 animate-pulse rounded-full bg-green-500" />
        <span class="text-xs text-muted-foreground">{{ t("scanner_ar.scanning") }}</span>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="pointer-events-auto flex items-center justify-center gap-4 bg-background/60 p-3 backdrop-blur-xs">
      <Button variant="outline" size="sm" @click="$emit('switchCamera')">
        <SwitchCamera class="mr-1.5 size-4" />
        {{ t("scanner_ar.switch_camera") }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft, SwitchCamera } from "@lucide/vue";
  import { useI18n } from "vue-i18n";
  import { Button } from "@/components/ui/button";

  defineProps<{
    isScanning: boolean;
  }>();

  defineEmits<{
    back: [];
    switchCamera: [];
  }>();

  const { t } = useI18n();
</script>
