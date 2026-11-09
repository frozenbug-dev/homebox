<template>
  <div class="relative" :class="wrapperClass()">
    <FormTextField
      v-bind="fieldAttrs()"
      v-model="value"
      :placeholder="localizedPlaceholder"
      :label="localizedLabel"
      :type="inputType"
    />
    <TooltipProvider :delay-duration="0">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="absolute top-6 right-3 mt-auto mb-3 ml-1 inline-flex justify-center p-1"
            @click="toggle()"
          >
            <Eye name="mdi-eye" class="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ $t("components.form.password.toggle_show") }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
  import { Eye } from "@lucide/vue";
  import { useI18n } from "vue-i18n";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import FormTextField from "@/components/Form/TextField.vue";

  defineOptions({
    inheritAttrs: false,
  });

  const attrs = useAttrs();

  const { t } = useI18n();
  type Props = {
    modelValue: string;
    placeholder?: string;
    label: string;
  };

  const props = defineProps<Props>();

  const [hide, toggle] = useToggle(true);

  const localizedPlaceholder = computed(() => props.placeholder ?? t("global.password"));
  const localizedLabel = computed(() => props.label ?? t("global.password"));

  const inputType = computed(() => {
    return hide.value ? "password" : "text";
  });

  function wrapperClass() {
    return attrs.class;
  }

  function fieldAttrs() {
    const { class: _class, ...rest } = attrs;
    return rest;
  }

  const value = useVModel(props, "modelValue");
</script>
