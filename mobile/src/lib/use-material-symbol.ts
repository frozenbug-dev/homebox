import { useQueries, useQuery } from '@tanstack/react-query'
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

/** Several Material Symbols at once, keyed by name (empty on iOS and until ready). */
export function useMaterialSymbols(names: AndroidSymbol[], size: number, color: string) {
  const unique = [...new Set(names)]
  return useQueries({
    queries: unique.map((name) => ({
      queryKey: ['material-symbol', name, size, color],
      queryFn: () => unstable_getMaterialSymbolSourceAsync(name, size, color),
      enabled: Platform.OS === 'android',
      staleTime: Infinity,
      gcTime: Infinity,
    })),
    combine: (results) =>
      Object.fromEntries(unique.flatMap((name, i) => (results[i].data ? [[name, results[i].data]] : []))) as Partial<
        Record<AndroidSymbol, NonNullable<(typeof results)[number]['data']>>
      >,
  })
}
