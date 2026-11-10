import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Icon } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SearchField } from '@/components/search-field'
import { SheetHeader } from '@/components/sheet-header'
import { TagDot } from '@/components/tag-chip'
import { MAX_TAG_DEPTH, tagSubtreeIds, tagTree, tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { useSheetRequest } from '@/lib/use-sheets'

const TOP_LEVEL = '__top__'

interface Row {
  id: string
  name: string
  color?: string
  depth: number
  path: string
}

/** Picks the parent of a tag: any tag outside its own subtree, or top level. */
export default function PickTagParentSheet() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const request = useSheetRequest('tagParent')
  const tags = useQuery(tagsQuery(api))
  const [search, setSearch] = useState('')

  // The React Compiler memoizes this; no useMemo needed.
  const rows = (() => {
    const all = tags.data ?? []
    const nodes = tagTree(all)
    const excluded = request?.excludeId ? tagSubtreeIds(all, request.excludeId) : new Set<string>()
    // How many levels the moving tag brings with it (itself and its sub-tags),
    // so the result stays within the backend's depth limit.
    const own = nodes.filter((n) => excluded.has(n.tag.id!))
    const height = own.length ? Math.max(...own.map((n) => n.depth)) - Math.min(...own.map((n) => n.depth)) + 1 : 1
    const q = search.trim().toLowerCase()
    const candidates: Row[] = nodes
      .filter((n) => !excluded.has(n.tag.id!) && n.depth + 1 + height <= MAX_TAG_DEPTH)
      .filter((n) => !q || (n.tag.name ?? '').toLowerCase().includes(q))
      .map((n) => ({
        id: n.tag.id!,
        name: n.tag.name ?? '',
        color: n.tag.color,
        depth: n.depth,
        path: [...n.trail, n.tag].map((t) => t.name).join(' › '),
      }))
    const top: Row[] = q ? [] : [{ id: TOP_LEVEL, name: 'None (top level)', depth: 0, path: '' }]
    return [...top, ...candidates]
  })()

  const select = (id: string | null, name: string) => {
    Haptics.selectionAsync()
    request?.onSelect({ id, name })
    router.back()
  }

  if (!request) return null

  return (
    <View style={styles.root}>
      <SheetHeader title="Parent tag" left={{ label: 'Cancel', onPress: () => router.back() }} />
      <SearchField placeholder="Search tags" value={search} onChangeText={setSearch} autoFocus={false} />
      {tags.isPending ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => r.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const top = item.id === TOP_LEVEL
            const selected = top ? request.selectedId === null : item.id === request.selectedId
            return (
              <PressableFeedback
                style={styles.row(search ? 0 : item.depth)}
                onPress={() => select(top ? null : item.id, item.name)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.path || item.name}>
                <View style={styles.dot}>
                  {top ? (
                    <Icon name={{ ios: 'minus.circle', android: 'block' }} size={18} />
                  ) : (
                    <TagDot color={item.color} size={10} />
                  )}
                </View>
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
  dot: {
    width: 18,
    alignItems: 'center',
  },
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
}))
