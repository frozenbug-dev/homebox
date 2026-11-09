import { useI18n } from "vue-i18n";
import type { EntityTemplateCreate, EntityTemplateSummary } from "~/lib/api/types/data-contracts";
import { NIL_UUID, templateField } from "~/lib/api/template-fields";
import { toast } from "@/components/ui/sonner";

/** Duplicate and delete item templates; `changed` runs after either. */
export function useTemplateActions(changed: () => void) {
  const api = useUserApi();
  const confirm = useConfirm();
  const { t } = useI18n();

  async function remove(templates: EntityTemplateSummary[]) {
    if (!templates.length) return;
    const message =
      templates.length === 1
        ? t("components.template.confirm_delete")
        : t("shell.templates_page.delete_confirm", { n: templates.length });
    const { isCanceled } = await confirm.open(message);
    if (isCanceled) return;
    const results = await Promise.all(templates.map(tpl => api.templates.delete(tpl.id)));
    if (results.some(r => r.error)) toast.error(t("components.template.toast.delete_failed"));
    else toast.success(t("components.template.toast.deleted"));
    changed();
  }

  async function duplicate(template: EntityTemplateSummary) {
    const { data: full, error: getError } = await api.templates.get(template.id);
    if (getError || !full) {
      toast.error(t("components.template.toast.load_failed"));
      return;
    }

    const copy: EntityTemplateCreate = {
      name: `${full.name} (Copy)`,
      description: full.description,
      notes: full.notes,
      defaultName: full.defaultName,
      defaultDescription: full.defaultDescription,
      defaultQuantity: full.defaultQuantity,
      defaultInsured: full.defaultInsured,
      defaultManufacturer: full.defaultManufacturer,
      defaultModelNumber: full.defaultModelNumber,
      defaultLifetimeWarranty: full.defaultLifetimeWarranty,
      defaultWarrantyDetails: full.defaultWarrantyDetails,
      defaultLocationId: full.defaultLocation?.id ?? null,
      defaultTagIds: full.defaultTags?.map(l => l.id) ?? [],
      includeWarrantyFields: full.includeWarrantyFields,
      includePurchaseFields: full.includePurchaseFields,
      includeSoldFields: full.includeSoldFields,
      fields: full.fields.map(field => templateField({ ...field, id: NIL_UUID })),
    };

    const { error } = await api.templates.create(copy);
    if (error) {
      toast.error(t("components.template.toast.duplicate_failed"));
      return;
    }
    toast.success(t("components.template.toast.duplicated", { name: copy.name }));
    changed();
  }

  return { remove, duplicate };
}
