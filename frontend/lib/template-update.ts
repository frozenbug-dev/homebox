import type { EntityTemplateOut, EntityTemplateUpdate } from "~/lib/api/types/data-contracts";
import { templateField } from "~/lib/api/template-fields";

export type TemplateChanges = Partial<Omit<EntityTemplateUpdate, "id">>;

/**
 * Builds a full PUT /templates/{id} body from a template as the API returned
 * it, with `changes` applied on top. The update endpoint has no PATCH, so
 * single-field edits on the template page go through this.
 */
export function toTemplateUpdate(template: EntityTemplateOut, changes: TemplateChanges = {}): EntityTemplateUpdate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    notes: template.notes,
    defaultName: template.defaultName,
    defaultDescription: template.defaultDescription,
    defaultQuantity: template.defaultQuantity,
    defaultInsured: template.defaultInsured,
    defaultManufacturer: template.defaultManufacturer,
    defaultModelNumber: template.defaultModelNumber,
    defaultLifetimeWarranty: template.defaultLifetimeWarranty,
    defaultWarrantyDetails: template.defaultWarrantyDetails,
    defaultLocationId: template.defaultLocation?.id ?? null,
    defaultTagIds: (template.defaultTags ?? []).map(tag => tag.id),
    includeWarrantyFields: template.includeWarrantyFields,
    includePurchaseFields: template.includePurchaseFields,
    includeSoldFields: template.includeSoldFields,
    fields: template.fields.map(field => templateField(field)),
    ...changes,
  };
}
