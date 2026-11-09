import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Icon, icons } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SearchField } from '@/components/search-field'
import { SheetHeader } from '@/components/sheet-header'
import { useCreateEntity } from '@/lib/api/mutations'
import { entityTypesQuery, findInTree, flattenTree, placesTreeQuery, subtreeIds } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { useSheetRequest } from '@/lib/use-sheets'

const TOP_LEVEL = '__top__'

export default function PickPlaceSheet() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const request = useSheetRequest('place')
  const tree = useQuery(placesTreeQuery(api))
  const types = useQuery(entityTypesQuery(api))
  const create = useCreateEntity()
  const [search, setSearch] = useState('')

  // The React Compiler memoizes this; no useMemo needed.
  const rows = (() => {
    const data = tree.data ?? []
    const excluded = new Set<string>()
    if (request?.excludeId) {
      const found = findInTree(data, request.excludeId)
      if (found) subtreeIds(found.node).forEach((id) => excluded.add(id))
    }
    const q = search.trim().toLowerCase()
    const places = flattenTree(data).filter((p) => !excluded.has(p.id))
    const filtered = q ? places.filter((p) => p.name.toLowerCase().includes(q)) : places
    const top = request?.allowTopLevel && !q ? [{ id: TOP_LEVEL, name: 'Top level', depth: 0, path: '' }] : []
    return [...top, ...filtered]
  })()

  const select = (id: string | null, name: string) => {
    Haptics.selectionAsync()
    request?.onSelect({ id, name })
    router.back()
  }

  const query = search.trim()
  const canCreate = !!query && !rows.some((r) => r.name.toLowerCase() === query.toLowerCase())

  const createPlace = async () => {
    const locationType = types.data?.find((t) => t.isLocation)
    const place = await create.mutateAsync({ name: query, entityTypeId: locationType?.id })
    select(place.id!, place.name ?? query)
  }

  if (!request) return null

  return (
    <View style={styles.root}>
      <SheetHeader title={request.title ?? 'Move to'} left={{ label: 'Cancel', onPress: () => router.back() }} />
      <SearchField placeholder="Search places" value={search} onChangeText={setSearch} autoFocus={false} />
      {tree.isPending ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => r.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            canCreate ? (
              <PressableFeedback
                style={styles.row(0)}
                onPress={createPlace}
                disabled={create.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Create place ${query}`}>
                <Icon name={{ ios: 'plus', android: 'add' }} size={18} color={theme.colors.primary} />
                <Text style={styles.create}>{create.isPending ? 'Creating…' : `Create “${query}”`}</Text>
              </PressableFeedback>
            ) : null
          }
          renderItem={({ item }) => {
            const selected =
              item.id === TOP_LEVEL ? request.selectedId === null : item.id === request.selectedId
            return (
              <PressableFeedback
                style={styles.row(search ? 0 : item.depth)}
                onPress={() => select(item.id === TOP_LEVEL ? null : item.id, item.name)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.path || item.name}>
                <Icon name={item.id === TOP_LEVEL ? { ios: 'house', android: 'home' } : icons.placeFolder} size={18} />
                <View style={styles.text}>
                  <Text style={styles.name(selected)} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {search && item.depth > 0 ? (
                    <Text style={styles.path} numberOfLines={1}>
                      {item.path}
                    </Text>
                  ) : null}
                </View>
                {selected ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={18} color={theme.colors.primary} /> : null}
              </PressableFeedback>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    paddingVertical: theme.spacing(10),
  },
  row: (depth: number) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 48,
    paddingLeft: theme.spacing(4) + depth * theme.spacing(5),
    paddingRight: theme.spacing(4),
    overflow: 'hidden',
  }),
  text: {
    flex: 1,
  },
  name: (selected: boolean) => ({
    ...theme.type.body,
    fontWeight: selected ? '600' : '400',
    color: selected ? theme.colors.primary : theme.colors.text,
  }),
  path: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  create: {
    ...theme.type.body,
    color: theme.colors.primary,
  },
}))
