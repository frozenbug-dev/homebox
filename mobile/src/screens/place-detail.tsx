import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { EntityList } from '@/components/entity-list'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { SectionHeader } from '@/components/section-header'
import { findInTree, placesTreeQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'

export default function PlaceDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))

  const found = tree.data ? findInTree(tree.data, id) : null
  const title = found?.node.name ?? name ?? 'Place'
  const subPlaces = found?.node.children ?? []
  const trail = found?.trail ?? []

  const header = (
    <View>
      {trail.length ? (
        <Text style={styles.trail} numberOfLines={1}>
          {trail.map((t) => t.name).join(' › ')}
        </Text>
      ) : null}
      {subPlaces.length ? (
        <>
          <SectionHeader title="Places inside" count={subPlaces.length} />
          {subPlaces.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowSeparator /> : null}
              <ListRow
                title={p.name ?? ''}
                subtitle={p.children?.length ? pluralize(p.children.length, 'place') : undefined}
                leading={
                  <View style={styles.icon}>
                    <Icon name={icons.placeFolder} size={18} />
                  </View>
                }
                chevron
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: p.id!, name: p.name } })}
              />
            </View>
          ))}
        </>
      ) : null}
      <SectionHeader title="Items" />
    </View>
  )

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      <EntityList
        filters={{ parentIds: [id] }}
        header={header}
        showPlace={false}
        emptyTitle="Nothing here yet"
        emptyMessage={subPlaces.length ? 'Items stored directly in this place show up here.' : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  trail: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(1),
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
}))
