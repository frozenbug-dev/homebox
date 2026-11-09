<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Plus } from "@lucide/vue";
  import { toast } from "@/components/ui/sonner";
  import { Button } from "@/components/ui/button";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import AppHeaderActions from "~/components/App/HeaderActions.vue";
  import TemplateCreateModal from "~/components/Template/CreateModal.vue";
  import ResourceList from "~/components/Resource/List.vue";
  import TemplateResource from "~/components/Resource/TemplateResource.vue";
  import SelectionBar from "~/components/Resource/SelectionBar.vue";
  import SelectionAction from "~/components/Resource/SelectionAction.vue";

  definePageMeta({ middleware: ["auth"] });

  const { t } = useI18n();
  useHead({ title: () => `HomeBox | ${t("pages.templates.title")}` });
  usePageHeader(() => [{ label: t("pages.templates.title") }]);

  const api = useUserApi();
  const { openDialog } = useDialog();

  const { data: templates, refresh } = useAsyncData("templates", async () => {
    const { data, error } = await api.templates.getAll();
    if (error) {
      toast.error(t("components.template.toast.load_failed"));
      return [];
    }
    return [...data].sort((a, b) => a.name.localeCompare(b.name));
  });

  const actions = useTemplateActions(() => refresh());
  const create = () => openDialog(DialogID.CreateTemplate);
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeaderActions>
      <Button size="sm" class="h-[30px] text-[13px]" @click="create">
        <Plus />
        {{ t("shell.templates_page.new_template") }}
      </Button>
    </AppHeaderActions>
    <TemplateCreateModal @created="refresh()" />

    <ResourceList
      class="py-1.5"
      :items="templates ?? []"
      :get-key="tpl => tpl.id"
      :to="tpl => `/template/${tpl.id}`"
      :label="t('pages.templates.title')"
    >
      <template #default="{ item }">
        <TemplateResource :template="item" @duplicate="actions.duplicate" @delete="actions.remove" />
      </template>
      <template #selection="{ items, clear }">
        <SelectionBar :count="items.length" @clear="clear">
          <SelectionAction destructive @click="actions.remove(items).then(clear)">
            {{ t("shell.items_page.delete") }}
          </SelectionAction>
        </SelectionBar>
      </template>
    </ResourceList>

    <!-- Empty state; "New template" sits in the header -->
    <p v-if="templates && !templates.length" class="px-4 py-6 text-center text-sm text-muted-foreground">
      {{ t("pages.templates.no_templates") }}
    </p>
  </div>
</template>
