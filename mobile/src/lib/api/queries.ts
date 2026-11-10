import { infiniteQueryOptions, queryOptions, skipToken, type InfiniteData, type QueryClient } from '@tanstack/react-query'

import { unwrap, type ApiClient, type Entity, type EntitySummary, type TreeItem } from './api'
import { fetchServerStatus } from './client'

const ITEMS_PAGE_SIZE = 50

/**
 * The query cache is cleared on every sign-in and sign-out, so keys don't need
 * the server. Mutations invalidate by prefix: `entityKeys.all` refreshes every
 * list and detail.
 */
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters: ItemFilters) => [...entityKeys.lists(), filters] as const,
  detail: (id: string) => [...entityKeys.all, 'detail', id] as const,
  path: (id: string) => [...entityKeys.all, 'path', id] as const,
  tree: () => [...entityKeys.all, 'tree'] as const,
}

export const tagKeys = {
  all: ['tags'] as const,
}

/** What a server supports (password / OIDC sign-in, version). Public, no session needed. */
export const serverStatusQuery = (serverUrl: string) =>
  queryOptions({
    queryKey: ['status', serverUrl],
    queryFn: ({ signal }) => fetchServerStatus(serverUrl, signal),
    retry: false,
  })

export const selfQuery = (api: ApiClient | null) =>
  queryOptions({
    queryKey: ['self'],
    queryFn: api
      ? async ({ signal }) => (await unwrap(api.GET('/v1/users/self', { signal }))).item as { name?: string; email?: string; defaultGroupId?: string }
      : skipToken,
  })

export interface ItemFilters {
  q?: string
  tagIds?: string[]
  /** Places (or containers) whose contents to list. */
  parentIds?: string[]
  /** true = places, false = items, undefined = items. */
  isLocation?: boolean
  orderBy?: 'name' | 'createdAt' | 'updatedAt'
}

export const itemsQuery = (api: ApiClient | null, filters: ItemFilters = {}) =>
  infiniteQueryOptions({
    queryKey: entityKeys.list(filters),
    queryFn: api
      ? ({ pageParam, signal }) =>
          unwrap(
            api.GET('/v1/entities', {
              signal,
              params: {
                query: {
                  q: filters.q || undefined,
                  tags: filters.tagIds?.length ? filters.tagIds : undefined,
                  parentIds: filters.parentIds?.length ? filters.parentIds : undefined,
                  orderBy: filters.orderBy ?? 'name',
                  page: pageParam,
                  pageSize: ITEMS_PAGE_SIZE,
                  ...(filters.isLocation !== undefined ? { isLocation: filters.isLocation } : {}),
                } as never,
              },
            }),
          )
      : skipToken,
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const page = last.page ?? 1
      const size = last.pageSize ?? ITEMS_PAGE_SIZE
      return page > 0 && page * size < (last.total ?? 0) ? page + 1 : undefined
    },
  })

export const entityQuery = (api: ApiClient | null, id: string) =>
  queryOptions({
    queryKey: entityKeys.detail(id),
    queryFn: api ? ({ signal }) => unwrap(api.GET('/v1/entities/{id}', { signal, params: { path: { id } } })) : skipToken,
  })

/**
 * An item's maintenance log, done and scheduled. Keyed under the item's detail
 * key, so invalidating the item refreshes it too.
 */
export const maintenanceQuery = (api: ApiClient | null, id: string) =>
  queryOptions({
    queryKey: [...entityKeys.detail(id), 'maintenance'] as const,
    queryFn: api
      ? ({ signal }) =>
          unwrap(
            api.GET('/v1/entities/{id}/maintenance', { signal, params: { path: { id }, query: { status: 'both' } } }),
          )
      : skipToken,
  })

/**
 * Builds a placeholder `Entity` from any cached list row so the item screen
 * renders its final header/cover layout and toolbar immediately during the push
 * transition instead of morphing once the detail request resolves.
 */
export function seedEntityFromList(qc: QueryClient, id: string): Entity | undefined {
  const lists = qc.getQueriesData<InfiniteData<{ items?: EntitySummary[] }>>({ queryKey: entityKeys.lists() })
  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      const summary = page.items?.find((item) => item.id === id)
      if (summary) {
        return {
          ...summary,
          attachments: summary.imageId
            ? [
                {
                  id: summary.imageId,
                  type: 'photo',
                  primary: true,
                  thumbnail: summary.thumbnailId ? { id: summary.thumbnailId } : undefined,
                },
              ]
            : [],
        }
      }
    }
  }
  return undefined
}

/** Breadcrumb of containers from the top-level place down to the entity. */
export const entityPathQuery = (api: ApiClient | null, id: string) =>
  queryOptions({
    queryKey: entityKeys.path(id),
    queryFn: api
      ? ({ signal }) => unwrap(api.GET('/v1/entities/{id}/path', { signal, params: { path: { id } } }))
      : skipToken,
  })

/** The place hierarchy (no items). */
export const placesTreeQuery = (api: ApiClient | null) =>
  queryOptions({
    queryKey: entityKeys.tree(),
    queryFn: api ? ({ signal }) => unwrap(api.GET('/v1/entities/tree', { signal })) : skipToken,
  })

export const tagsQuery = (api: ApiClient | null) =>
  queryOptions({
    queryKey: tagKeys.all,
    queryFn: api ? ({ signal }) => unwrap(api.GET('/v1/tags', { signal })) : skipToken,
    select: (tags) => [...tags].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  })

/** Collections the user belongs to. */
export const groupsQuery = (api: ApiClient | null) =>
  queryOptions({
    queryKey: ['groups'],
    queryFn: api ? ({ signal }) => unwrap(api.GET('/v1/groups/all', { signal })) : skipToken,
  })

/** The current collection (name, currency). */
export const groupQuery = (api: ApiClient | null) =>
  queryOptions({
    queryKey: ['group'],
    queryFn: api ? ({ signal }) => unwrap(api.GET('/v1/groups', { signal })) : skipToken,
    staleTime: 5 * 60_000,
  })

export const entityTypesQuery = (api: ApiClient | null) =>
  queryOptions({
    queryKey: ['entity-types'],
    queryFn: api ? ({ signal }) => unwrap(api.GET('/v1/entity-types', { signal })) : skipToken,
    staleTime: 5 * 60_000,
  })

/** Finds a place in the tree, returning it with its ancestors (outermost first). */
export function findInTree(tree: TreeItem[], id: string, trail: TreeItem[] = []): { node: TreeItem; trail: TreeItem[] } | null {
  for (const node of tree) {
    if (node.id === id) return { node, trail }
    const found = findInTree(node.children ?? [], id, [...trail, node])
    if (found) return found
  }
  return null
}

/** Every place id in a subtree, including the root. */
export function subtreeIds(node: TreeItem): string[] {
  return [node.id!, ...(node.children ?? []).flatMap(subtreeIds)]
}

/** Flattens the tree for pickers: each place with its depth and full path label. */
export function flattenTree(tree: TreeItem[], depth = 0, path: string[] = []) {
  const out: { id: string; name: string; depth: number; path: string }[] = []
  for (const node of tree) {
    const nodePath = [...path, node.name ?? '']
    out.push({ id: node.id!, name: node.name ?? '', depth, path: nodePath.join(' › ') })
    out.push(...flattenTree(node.children ?? [], depth + 1, nodePath))
  }
  return out
}
