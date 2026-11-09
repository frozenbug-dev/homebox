import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import type { Session } from '@/lib/auth/storage'

import { fetchServerStatus, type RequestOptions } from './client'
import type { EntityListResult, UserOut } from './types'

type AuthedRequest = <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>

const ITEMS_PAGE_SIZE = 50

// Keys are scoped by server so switching servers never shows another server's data.

/** What a server supports (password / OIDC sign-in, version). Public, no session needed. */
export const serverStatusQuery = (serverUrl: string) =>
  queryOptions({
    queryKey: ['status', serverUrl],
    queryFn: ({ signal }) => fetchServerStatus(serverUrl, signal),
    retry: false,
  })

export const selfQuery = (session: Session | null, authedRequest: AuthedRequest) =>
  queryOptions({
    queryKey: ['self', session?.serverUrl, session?.token],
    queryFn: async ({ signal }) => (await authedRequest<{ item: UserOut }>('/users/self', { signal })).item,
    enabled: !!session,
  })

export const itemsQuery = (session: Session | null, authedRequest: AuthedRequest) =>
  infiniteQueryOptions({
    queryKey: ['entities', session?.serverUrl, 'items'],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(ITEMS_PAGE_SIZE),
        orderBy: 'name',
        orderDirection: 'asc',
      })
      return authedRequest<EntityListResult>(`/entities?${params}`, { signal })
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: !!session,
  })
