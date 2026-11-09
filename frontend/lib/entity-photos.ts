import type { EntityOut } from "~/lib/api/types/data-contracts";

export type EntityPhoto = {
  attachmentId: string;
  originalSrc: string;
  originalType?: string;
  thumbnailSrc: string;
  primary: boolean;
};

/** An item's or place's photos, the primary one first (it's the cover beside the title). */
export function entityPhotos(entity: EntityOut, authURL: (path: string) => string): EntityPhoto[] {
  const url = (id: string) => authURL(`/entities/${entity.id}/attachments/${id}`);
  return entity.attachments
    .filter(a => a.type === "photo")
    .map(a => ({
      attachmentId: a.id,
      originalSrc: url(a.id),
      originalType: a.mimeType,
      thumbnailSrc: a.thumbnail ? url(a.thumbnail.id) : url(a.id),
      primary: a.primary,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}
