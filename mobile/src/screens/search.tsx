import { useQuery } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { EmptyState } from '@/components/empty-state'
import { EntityList } from '@/components/entity-list'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { SectionHeader } from '@/components/section-header'
import { TagDot } from '@/components/tag-chip'
import { flattenTree, placesTreeQuery, tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { useDebounced } from '@/lib/use-debounced'

/**
 * iOS search tab (the system search button next to the tab bar): searches
 * items, places and tags at once. Android searches from each list's header.
 */
export default function SearchScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const tree = useQuery(placesTreeQuery(api))
  const tags = useQuery(tagsQuery(api))

  const needle = q.toLowerCase()
  const places = needle ? flattenTree(tree.data ?? []).filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 5) : []
  const matchingTags = needle ? (tags.data ?? []).filter((t) => (t.name ?? '').toLowerCase().includes(needle)).slice(0, 5) : []

  const header = (
    <View>
      {places.length ? (
        <>
          <SectionHeader title="Places" count={places.length} />
          {places.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowSeparator /> : null}
              <ListRow
                title={p.name}
                subtitle={p.depth > 0 ? p.path : undefined}
                leading={
                  <View style={styles.icon}>
                    <Icon name={icons.placeFolder} size={18} />
                  </View>
                }
                chevron
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: p.id, name: p.name } })}
              />
            </View>
          ))}
        </>
      ) : null}
      {matchingTags.length ? (
        <>
          <SectionHeader title="Tags" count={matchingTags.length} />
          {matchingTags.map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <RowSeparator /> : null}
              <ListRow
                title={t.name ?? ''}
                leading={
                  <View style={styles.icon}>
                    <TagDot color={t.color} size={12} />
                  </View>
                }
                chevron
                onPress={() => router.push({ pathname: '/tag/[id]', params: { id: t.id!, name: t.name } })}
              />
            </View>
          ))}
        </>
      ) : null}
      <SectionHeader title="Items" />
    </View>
  )

  return (
    <>
      <Stack.SearchBar
        placeholder="Items, places and tags"
        autoCapitalize="none"
        hideWhenScrolling={false}
        tintColor={theme.colors.primary}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      {q ? (
        <EntityList
          filters={{ q }}
          header={header}
          emptyTitle="No items match"
          emptyMessage={places.length || matchingTags.length ? undefined : `Nothing matches “${q}”.`}
        />
      ) : (
        <View style={styles.idle}>
          <EmptyState
            icon={icons.search}
            title="Search everything"
            message="Find items by name, serial or model number, notes or tags, and jump to places and tags."
          />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  idle: {
    flex: 1,
    paddingTop: rt.insets.top + theme.spacing(16),
    backgroundColor: theme.colors.background,
  },
}))
