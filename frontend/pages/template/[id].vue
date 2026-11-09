<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Copy, Ellipsis, LayoutTemplate, Link as LinkIcon, Plus, Trash2 } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import InlineText from "~/components/Item/Inline/Text.vue";
  import InlineMarkdown from "~/components/Item/Inline/Markdown.vue";
  import TemplatePropertiesPanel from "~/components/Template/PropertiesPanel.vue";
  import type { EntityTemplateOut } from "~~/lib/api/types/data-contracts";
  import { toTemplateUpdate, type TemplateChanges } from "~/lib/template-update";

  definePageMeta({
    middleware: ["auth"],
  });

  const { t } = useI18n();
  const route = useRoute();
  const api = useUserApi();
  const { openDialog } = useDialog();

  const templateId = computed<string>(() => route.params.id as string);

  const { data: template } = useAsyncData(
    () => `template-${templateId.value}`,
    async () => {
      const { data, error } = await api.templates.get(templateId.value);
      if (error) {
        toast.error(t("components.template.toast.load_failed"));
        navigateTo("/templates");
        return;
      }
      return data;
    }
  );

  usePageHeader(() => [{ label: t("pages.templates.title"), to: "/templates" }, { label: template.value?.name ?? "" }]);

  /**
   * Every edit is a full PUT built from the current template, shown
   * optimistically. `optimistic` covers fields whose response shape differs
   * from the request, like the place and tags.
   */
  async function update(changes: TemplateChanges, optimistic: Partial<EntityTemplateOut> = {}) {
    const prev = template.value;
    if (!prev) return;
    template.value = { ...prev, ...(changes as Partial<EntityTemplateOut>), ...optimistic };
    const { data, error } = await api.templates.update(templateId.value, toTemplateUpdate(prev, changes));
    if (error) {
      template.value = prev;
      toast.error(t("components.template.toast.update_failed"));
      return;
    }
    template.value = data;
  }

  const actions = useTemplateActions(() => {});

  const confirm = useConfirm();
  async function remove() {
    const { isCanceled } = await confirm.open(t("components.template.confirm_delete"));
    if (isCanceled) return;
    const { error } = await api.templates.delete(templateId.value);
    if (error) {
      toast.error(t("components.template.toast.delete_failed"));
      return;
    }
    toast.success(t("components.template.toast.deleted"));
    navigateTo("/templates");
  }

  function newItem() {
    openDialog(DialogID.CreateEntity, { params: { baseType: "item", templateId: templateId.value } });
  }

  const { copy } = useClipboard();
  function copyLink() {
    copy(window.location.href);
    toast.success(t("shell.item_page.link_copied"));
  }

  const wide = useMediaQuery("(width >= 64rem)");
</script>

<template>
  <div v-if="template" class="flex flex-1 flex-col">
    <Title>{{ template.name }}</Title>

    <AppHeaderActions>
      <Button
        variant="outline"
        size="sm"
        class="h-[30px] text-[13px] max-sm:hidden"
        @click="actions.duplicate(template)"
      >
        {{ t("shell.item_page.duplicate") }}
      </Button>
      <Button size="sm" class="h-[30px] text-[13px]" @click="newItem">
        <Plus />
        {{ t("shell.template_page.new_item") }}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="icon" class="size-[30px]" :aria-label="t('shell.item_page.more')">
            <Ellipsis class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuItem class="sm:hidden" @select="actions.duplicate(template)">
            <Copy class="size-4" />
            {{ t("shell.item_page.duplicate") }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="copyLink">
            <LinkIcon class="size-4" />
            {{ t("shell.item_page.copy_link") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @select="remove">
            <Trash2 class="size-4" />
            {{ $t("global.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </AppHeaderActions>

    <!-- Properties sit beside the content on wide screens and right below the title on narrow ones -->
    <div class="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)]">
      <div class="flex min-w-0 flex-col gap-[22px] px-4 py-6 sm:px-10 sm:pt-7 sm:pb-10">
        <header class="flex max-w-190 items-start gap-4">
          <span
            class="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground"
            aria-hidden="true"
          >
            <LayoutTemplate class="size-6" />
          </span>
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <InlineText
              :value="template.name"
              :label="t('components.template.form.template_name')"
              wrap
              class="-mx-1.5 text-[26px] leading-tight font-semibold tracking-tight"
              @save="name => name && update({ name })"
            />
            <InlineMarkdown
              :value="template.description"
              :label="t('components.template.form.template_description')"
              :placeholder="t('shell.item_page.add_description')"
              @save="description => update({ description })"
            />
          </div>
        </header>

        <div v-if="!wide" class="-mx-4 border-y border-border/70 bg-muted/20 p-4 sm:-mx-10 sm:px-10">
          <TemplatePropertiesPanel :template="template" @update="update" />
        </div>

        <div class="h-px bg-border/70" />

        <!-- What a new item is filled in with, shown as the item it will become -->
        <section class="max-w-190">
          <h2 class="mb-0.5 text-[13px] font-semibold text-foreground/80">
            {{ t("shell.template_page.new_items_start_as") }}
          </h2>
          <p class="mb-2.5 text-xs text-muted-foreground">
            {{ t("shell.template_page.new_items_hint") }}
          </p>
          <div class="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
            <InlineText
              :value="template.defaultName"
              :label="t('components.template.form.item_name')"
              :placeholder="t('shell.template_page.item_name_placeholder')"
              class="-mx-1.5 text-base font-semibold"
              @save="defaultName => update({ defaultName })"
            />
            <InlineMarkdown
              :value="template.defaultDescription"
              :label="t('components.template.form.item_description')"
              :placeholder="t('shell.item_page.add_description')"
              @save="defaultDescription => update({ defaultDescription })"
            />
          </div>
        </section>

        <section class="max-w-190">
          <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">
            {{ t("shell.item_page.warranty_details") }}
          </h2>
          <InlineMarkdown
            :value="template.defaultWarrantyDetails"
            :label="t('shell.item_page.warranty_details')"
            :placeholder="t('shell.item_page.add_warranty_details')"
            @save="defaultWarrantyDetails => update({ defaultWarrantyDetails })"
          />
        </section>

        <section class="max-w-190">
          <h2 class="mb-1 text-[13px] font-semibold text-foreground/80">
            {{ $t("items.notes") }}
          </h2>
          <InlineMarkdown
            :value="template.notes"
            :label="t('items.notes')"
            :placeholder="t('shell.template_page.add_notes')"
            @save="notes => update({ notes })"
          />
        </section>
      </div>

      <aside v-if="wide" class="border-l border-border/70 bg-muted/20">
        <div class="sticky top-(--header-height) px-4 py-[18px]">
          <TemplatePropertiesPanel :template="template" @update="update" />
        </div>
      </aside>
    </div>
  </div>
</template>
