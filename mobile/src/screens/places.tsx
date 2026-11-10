import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TabScreen } from '@/components/search-app-bar'
import { EmptyState } from '@/components/empty-state'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { ActionFab, FAB_SPACE } from '@/components/action-fab'
import { placesTreeQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { usePullToRefresh } from '@/lib/use-pull-to-refresh'
import { pluralize } from '@/lib/format'

export default function PlacesScreen() {
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))
  const pull = usePullToRefresh(tree.refetch)
  // Top level; search (the search bar / tab) looks through every level.
  const rows = useMemo(
    () =>
      (tree.data ?? []).map((p) => ({
        id: p.id!,
        name: p.name ?? '',
        subtitle: p.children?.length ? pluralize(p.children.length, 'place') : undefined,
      })),
    [tree.data],
  )

  return (
    <TabScreen>
      <FlashList
        data={rows}
        keyExtractor={(p) => p.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: rt.insets.bottom + FAB_SPACE + theme.spacing(4) }}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          tree.isPending ? (
            <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
          ) : (
            <EmptyState
              icon={icons.placeFolder}
              title="No places yet"
              message="Rooms, shelves and boxes you add show up here."
            />
          )
        }
        refreshControl={
          <RefreshControl
            {...pull}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.textMuted}
            progressBackgroundColor={theme.colors.elevated}
          />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={item.subtitle}
            leading={
              <View style={styles.icon}>
                <Icon name={icons.placeFolder} size={18} />
              </View>
            }
            chevron
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id, name: item.name } })}
          />
        )}
      />
      <ActionFab />
    </TabScreen>
  )
}

const styles = StyleSheet.create((theme) => ({
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  loading: {
    paddingVertical: theme.spacing(16),
  },
}))
