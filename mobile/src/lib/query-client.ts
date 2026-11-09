import { QueryClient, focusManager } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'

// React Native has no window focus events; refetch on app foreground instead.
AppState.addEventListener('change', (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active')
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})
