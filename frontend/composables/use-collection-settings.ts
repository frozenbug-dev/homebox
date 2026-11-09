import type { Group, UserSummary } from "~~/lib/api/types/data-contracts";

/**
 * Data the collection settings pane and its sections share, cached by
 * collection so the nav and the open section read the same request.
 * Call `refresh()` after changing members or the collection itself.
 */
export function useCollectionSettingsData() {
  const api = useUserApi();
  const { selectedCollection } = useCollections();
  const id = computed(() => selectedCollection.value?.id ?? "");

  const group = useAsyncData(
    () => `collection-group:${id.value}`,
    async () => (id.value ? ((await api.group.get(id.value)).data ?? null) : null) as Group | null,
    { server: false }
  );

  const members = useAsyncData(
    () => `collection-members:${id.value}`,
    async () => (id.value ? ((await api.group.getMembers()).data ?? []) : []) as UserSummary[],
    { server: false, default: () => [] as UserSummary[] }
  );

  return { collection: selectedCollection, group, members };
}
