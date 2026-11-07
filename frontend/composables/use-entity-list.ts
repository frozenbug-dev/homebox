import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import type { ItemsQuery } from "~/lib/api/classes/items";
import type { EntityPatch, EntitySummary, PaginationResultEntitySummary } from "~/lib/api/types/data-contracts";
import { toast } from "@/components/ui/sonner";

export const ENTITY_LIST_PAGE_SIZE = 50;

/**
 * An infinitely scrolling entity list. Pages are fetched on demand; `total`
 * comes from the first page. The key starts with "entities" so server events
 * invalidate it (see layouts/default.vue).
 */
export function useEntityList(query: MaybeRefOrGetter<ItemsQuery>, enabled: MaybeRefOrGetter<boolean> = true) {
  const api = useUserApi();
  const preferences = useViewPreferences();

  const result = useInfiniteQuery({
    queryKey: computed(() => ["entities", "list", preferences.value.collectionId, toValue(query)]),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.items.getAll({
        ...toValue(query),
        page: pageParam,
        pageSize: ENTITY_LIST_PAGE_SIZE,
      });
      if (error) throw new Error("Failed to load items");
      return data as PaginationResultEntitySummary;
    },
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? pages.length + 1 : undefined;
    },
    enabled: computed(() => toValue(enabled)),
    placeholderData: previous => previous,
  });

  const rows = computed<EntitySummary[]>(() => result.data.value?.pages.flatMap(p => p.items) ?? []);
  const total = computed(() => result.data.value?.pages[0]?.total ?? 0);

  return { ...result, rows, total };
}

/**
 * PATCH an entity's quantity, place or tags, updating every cached list
 * optimistically and rolling back if the request fails.
 */
export function usePatchEntity() {
  const api = useUserApi();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  type Vars = { patch: EntityPatch; optimistic?: Partial<EntitySummary> };
  type Snapshot = [readonly unknown[], InfiniteData<PaginationResultEntitySummary> | undefined][];

  return useMutation<unknown, Error, Vars, { snapshot: Snapshot }>({
    mutationFn: async ({ patch }) => {
      const { data, error } = await api.items.patch(patch.id, patch);
      if (error) throw new Error("patch failed");
      return data;
    },
    onMutate: async ({ patch, optimistic }) => {
      await queryClient.cancelQueries({ queryKey: ["entities", "list"] });
      const snapshot = queryClient.getQueriesData<InfiniteData<PaginationResultEntitySummary>>({
        queryKey: ["entities", "list"],
      });
      if (optimistic) {
        queryClient.setQueriesData<InfiniteData<PaginationResultEntitySummary>>(
          { queryKey: ["entities", "list"] },
          old =>
            old
              ? {
                  ...old,
                  pages: old.pages.map(page => ({
                    ...page,
                    items: page.items.map(item => (item.id === patch.id ? { ...item, ...optimistic } : item)),
                  })),
                }
              : old
        );
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(t("items.toast.failed_save"));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["entities"] }),
  });
}
