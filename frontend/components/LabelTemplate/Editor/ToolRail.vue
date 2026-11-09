<script setup lang="ts">
  import {
    AlignCenterHorizontal,
    AlignCenterVertical,
    AlignEndHorizontal,
    AlignEndVertical,
    AlignStartHorizontal,
    AlignStartVertical,
    ImagePlus,
    Minus,
    MousePointer2,
    QrCode,
    Redo2,
    SquarePlus,
    Type,
    Undo2,
  } from "@lucide/vue";
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuSeparator,
    DropdownMenuLabel,
  } from "@/components/ui/dropdown-menu";
  import { compatibleEntitySources, compatibleLinkSources } from "./barcode-sources";

  export type AlignTarget = "left" | "center" | "right" | "top" | "middle" | "bottom";

  const props = defineProps<{
    hasSelection: boolean;
    /** Number of objects in the current selection; two or more enable "Align to selection". */
    selectionCount?: number;
    canUndo: boolean;
    canRedo: boolean;
  }>();

  const emit = defineEmits<{
    addText: [];
    addBarcode: [format: string, contentSource: string];
    addShape: [type: "rect" | "line"];
    addImage: [file: File];
    align: [target: AlignTarget];
    alignSelection: [target: AlignTarget];
    undo: [];
    redo: [];
  }>();

  const { t } = useI18n();
  const { formats } = useBarcodeFormats();

  // Image picking: small raster logos only; the data URL is stored inside the template JSON.
  const MAX_IMAGE_BYTES = 512 * 1024;
  const fileInput = ref<HTMLInputElement | null>(null);

  function pickImage() {
    fileInput.value?.click();
  }

  function onImagePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        t("components.label_template.editor.tools.image_too_large", {
          max: "512 KB",
        })
      );
      return;
    }
    emit("addImage", file);
  }

  const alignTargets: { target: AlignTarget; icon: Component; key: string }[] = [
    { target: "left", icon: AlignStartVertical, key: "left" },
    { target: "center", icon: AlignCenterVertical, key: "center" },
    { target: "right", icon: AlignEndVertical, key: "right" },
    { target: "top", icon: AlignStartHorizontal, key: "top" },
    { target: "middle", icon: AlignCenterHorizontal, key: "middle" },
    { target: "bottom", icon: AlignEndHorizontal, key: "bottom" },
  ];
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div
      role="toolbar"
      :aria-label="$t('components.label_template.editor.tools.title')"
      class="flex flex-col items-center gap-0.5 rounded-xl border bg-card p-1 shadow-md shadow-black/5"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 bg-accent text-accent-foreground"
            :aria-label="$t('components.label_template.editor.tools.select')"
          >
            <MousePointer2 class="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.tools.select") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :aria-label="$t('components.label_template.editor.toolbar.add_text')"
            @click="emit('addText')"
          >
            <Type class="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.toolbar.add_text") }}</TooltipContent>
      </Tooltip>

      <!--
        Each popover trigger registers with the nearest popper root above it, so a DropdownMenuTrigger
        nested inside a TooltipTrigger would anchor to the tooltip and the menu would never be positioned.
        The tooltip therefore wraps the whole menu through a plain span.
      -->
      <Tooltip>
        <TooltipTrigger as-child>
          <span class="inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :aria-label="$t('components.label_template.editor.toolbar.add_barcode')"
                >
                  <QrCode class="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" class="w-56">
                <template v-for="format in formats ?? []" :key="format.format">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {{ format.name }}
                      <span v-if="format.is2D" class="ml-1 text-xs text-muted-foreground">(2D)</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent class="max-h-80">
                      <template v-if="compatibleEntitySources(format).length > 0">
                        <DropdownMenuLabel class="text-xs text-muted-foreground">
                          {{ $t("components.label_template.editor.properties.entity_fields") }}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          v-for="source in compatibleEntitySources(format)"
                          :key="source.value"
                          @click="emit('addBarcode', format.format, source.value)"
                        >
                          {{ t(`components.label_template.editor.barcode_sources.${source.labelKey}`) }}
                        </DropdownMenuItem>
                      </template>
                      <template v-if="compatibleLinkSources(format).length > 0">
                        <DropdownMenuSeparator v-if="compatibleEntitySources(format).length > 0" />
                        <DropdownMenuLabel class="text-xs text-muted-foreground">
                          {{ $t("components.label_template.editor.properties.link_fields") }}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          v-for="source in compatibleLinkSources(format)"
                          :key="source.value"
                          @click="emit('addBarcode', format.format, source.value)"
                        >
                          {{ t(`components.label_template.editor.barcode_sources.${source.labelKey}`) }}
                        </DropdownMenuItem>
                      </template>
                      <DropdownMenuSeparator
                        v-if="compatibleEntitySources(format).length > 0 || compatibleLinkSources(format).length > 0"
                      />
                      <!-- A value typed in the Element tab; the only option for digits-only formats such as EAN and UPC -->
                      <DropdownMenuItem @click="emit('addBarcode', format.format, '')">
                        {{ $t("components.label_template.editor.barcode_sources.fixed_value") }}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.toolbar.add_barcode") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <span class="inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :aria-label="$t('components.label_template.editor.toolbar.add_shape')"
                >
                  <SquarePlus class="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem @click="emit('addShape', 'rect')">
                  <SquarePlus class="mr-2 size-4" />
                  {{ $t("components.label_template.editor.tools.rectangle") }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('addShape', 'line')">
                  <Minus class="mr-2 size-4" />
                  {{ $t("components.label_template.editor.tools.line") }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.toolbar.add_shape") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :aria-label="$t('components.label_template.editor.tools.image')"
            @click="pickImage"
          >
            <ImagePlus class="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.tools.image") }}</TooltipContent>
      </Tooltip>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/gif"
        class="hidden"
        @change="onImagePicked"
      />

      <div class="my-0.5 h-px w-6 bg-border" />

      <Tooltip>
        <TooltipTrigger as-child>
          <span class="inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :disabled="!props.hasSelection"
                  :aria-label="$t('components.label_template.editor.tools.align')"
                >
                  <AlignCenterVertical class="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuLabel class="text-xs text-muted-foreground">
                  {{ $t("components.label_template.editor.tools.align_to_label") }}
                </DropdownMenuLabel>
                <DropdownMenuItem v-for="a in alignTargets" :key="a.target" @click="emit('align', a.target)">
                  <component :is="a.icon" class="mr-2 size-4" />
                  {{ t(`components.label_template.editor.align.${a.key}`) }}
                </DropdownMenuItem>
                <template v-if="(props.selectionCount ?? 0) > 1">
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel class="text-xs text-muted-foreground">
                    {{ $t("components.label_template.editor.tools.align_to_selection") }}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    v-for="a in alignTargets"
                    :key="`sel-${a.target}`"
                    @click="emit('alignSelection', a.target)"
                  >
                    <component :is="a.icon" class="mr-2 size-4" />
                    {{ t(`components.label_template.editor.align.${a.key}`) }}
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.tools.align") }}</TooltipContent>
      </Tooltip>

      <div class="my-0.5 h-px w-6 bg-border" />

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :disabled="!props.canUndo"
            :aria-label="$t('components.label_template.editor.tools.undo')"
            @click="emit('undo')"
          >
            <Undo2 class="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.tools.undo") }} (⌘Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :disabled="!props.canRedo"
            :aria-label="$t('components.label_template.editor.tools.redo')"
            @click="emit('redo')"
          >
            <Redo2 class="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{{ $t("components.label_template.editor.tools.redo") }} (⇧⌘Z)</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
