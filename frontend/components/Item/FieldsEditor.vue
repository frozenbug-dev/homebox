<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { ExternalLink, X } from "@lucide/vue";
  import type { EntityFieldData } from "~/lib/api/types/data-contracts";
  import InlineText from "~/components/Item/Inline/Text.vue";

  /**
   * An item's custom fields, edited in place: click a name or value to change it,
   * × removes the row. `add()` opens a new row with its name focused; the row is
   * saved once it has a name and dropped if you leave it empty.
   */
  const props = defineProps<{ fields: EntityFieldData[] }>();
  const emit = defineEmits<{ save: [fields: EntityFieldData[]] }>();

  const { t } = useI18n();

  const adding = ref(false);
  const draftName = useTemplateRef<InstanceType<typeof InlineText>>("draftName");
  // By position: the server gives new fields their ids, so keying rows by id would remount them.
  const valueRefs: (InstanceType<typeof InlineText> | null)[] = [];

  async function add() {
    adding.value = true;
    await nextTick();
    draftName.value?.$el?.scrollIntoView?.({ block: "nearest" });
    draftName.value?.edit();
  }
  defineExpose({ add });

  async function saveDraft(name: string) {
    adding.value = false;
    if (!name) return;
    const field = {
      id: null,
      name,
      type: "text",
      textValue: "",
      numberValue: 0,
      booleanValue: false,
    } as unknown as EntityFieldData;
    const index = props.fields.length;
    emit("save", [...props.fields, field]);
    // Go straight on to the new field's value.
    await nextTick();
    requestAnimationFrame(() => valueRefs[index]?.edit());
  }

  // Leaving the new row without typing a name drops it (blur with no change emits no save).
  function onDraftBlur() {
    setTimeout(() => {
      if (adding.value && !draftName.value?.$el?.contains(document.activeElement)) adding.value = false;
    });
  }

  function change(index: number, changes: Partial<EntityFieldData>) {
    emit(
      "save",
      props.fields.map((f, i) => (i === index ? { ...f, ...changes } : f))
    );
  }

  function remove(index: number) {
    emit(
      "save",
      props.fields.filter((_, i) => i !== index)
    );
  }

  function asUrl(v: string): string | null {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
    } catch {
      return null;
    }
  }
</script>

<template>
  <section v-if="fields.length > 0 || adding">
    <h2 class="mb-2 text-[13px] font-semibold text-foreground/80">{{ t("shell.item_page.fields") }}</h2>
    <div class="divide-y divide-border/70 overflow-hidden rounded-lg border border-border text-sm">
      <div
        v-for="(field, i) in fields"
        :key="i"
        class="group grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1"
      >
        <InlineText
          :value="field.name"
          :label="t('global.name')"
          class="text-muted-foreground"
          @save="name => name && change(i, { name })"
        />
        <div class="flex min-w-0 items-center gap-1">
          <InlineText
            :ref="el => (valueRefs[i] = el as InstanceType<typeof InlineText> | null)"
            :value="field.textValue"
            :label="field.name"
            :placeholder="t('shell.item_page.empty_value')"
            class="min-w-0 flex-1"
            @save="textValue => change(i, { textValue })"
          />
          <a
            v-if="asUrl(field.textValue)"
            :href="asUrl(field.textValue)!"
            target="_blank"
            rel="noopener noreferrer"
            class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            :aria-label="t('shell.item_page.open_link')"
          >
            <ExternalLink class="size-3.5" />
          </a>
        </div>
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
          :aria-label="t('shell.item_page.remove_field', { name: field.name })"
          @click="remove(i)"
        >
          <X class="size-3.5" />
        </button>
      </div>

      <div v-if="adding" class="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1">
        <InlineText
          ref="draftName"
          value=""
          :label="t('global.name')"
          :placeholder="t('shell.item_page.field_name')"
          @save="saveDraft"
          @focusout="onDraftBlur"
        />
        <span class="px-1.5 text-muted-foreground">—</span>
        <span class="size-7" />
      </div>
    </div>
  </section>
</template>
