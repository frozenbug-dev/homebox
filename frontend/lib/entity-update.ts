import type { EntityOut, EntityUpdate } from "~/lib/api/types/data-contracts";

/**
 * Builds a full PUT /entities/{id} body from an entity as the API returned it,
 * with `changes` applied on top. Used for single-field edits of fields that
 * PATCH doesn't cover (it only handles quantity, place, type and tags).
 *
 * `locationId` is only present on EntityOut when the entity has an explicit
 * location override (it sits inside another item), so echoing it back keeps
 * that override and never pins an inherited location (#1688).
 */
export function toEntityUpdate(entity: EntityOut, changes: Partial<EntityUpdate> = {}): EntityUpdate {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    notes: entity.notes,
    quantity: entity.quantity,
    insured: entity.insured,
    archived: entity.archived,
    assetId: entity.assetId,
    entityTypeId: entity.entityType?.id ?? "",
    parentId: entity.parent?.id ?? null,
    locationId: entity.locationId ?? null,
    tagIds: entity.tags.map(t => t.id),
    fields: entity.fields,
    syncChildEntityLocations: entity.syncChildEntityLocations,
    manufacturer: entity.manufacturer,
    modelNumber: entity.modelNumber,
    serialNumber: entity.serialNumber,
    lifetimeWarranty: entity.lifetimeWarranty,
    warrantyExpires: entity.warrantyExpires,
    warrantyDetails: entity.warrantyDetails,
    purchaseFrom: entity.purchaseFrom,
    purchasePrice: entity.purchasePrice,
    purchaseDate: entity.purchaseDate,
    soldTo: entity.soldTo,
    soldPrice: entity.soldPrice,
    soldDate: entity.soldDate,
    soldNotes: entity.soldNotes,
    ...changes,
  };
}
