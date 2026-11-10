import { useState } from 'react'

/**
 * Pull-to-refresh state that only reflects refreshes the user started.
 *
 * Binding `refreshing` to a query's background refetches makes iOS show the
 * spinner programmatically, and under a large title UIKit then never removes
 * the space it pushed the list down by.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = () => {
    setRefreshing(true)
    refetch().finally(() => setRefreshing(false))
  }
  return { refreshing, onRefresh }
}
