/**
 * Quick add remembers the last place and tags for this app session, so
 * adding a batch of things to the same shelf takes one field per item.
 */
export const quickAddMemory: {
  place: { id: string; name: string } | null
  tagIds: string[]
} = { place: null, tagIds: [] }
