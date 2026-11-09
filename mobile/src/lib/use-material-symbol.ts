import { useQuery } from '@tanstack/react-query'
import { unstable_getMaterialSymbolSourceAsync, type AndroidSymbol } from 'expo-symbols'
import { Platform } from 'react-native'

/**
 * Image source for a Material Symbol, for native Android components that take
 * an image (Compose FAB, toolbar buttons). Null on iOS and until it's ready.
 */
export function useMaterialSymbol(name: AndroidSymbol, size: number, color: string) {
  const { data } = useQuery({
    queryKey: ['material-symbol', name, size, color],
    queryFn: () => unstable_getMaterialSymbolSourceAsync(name, size, color),
    enabled: Platform.OS === 'android',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return data ?? null
}
