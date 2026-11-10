import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TabScreen } from '@/components/search-app-bar'
import { EmptyState } from '@/components/empty-state'
import { icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { ActionFab, FAB_SPACE } from '@/components/action-fab'
import { TagDot } from '@/components/tag-chip'
import { tagsQuery, tagTree } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'
import { usePullToRefresh } from '@/lib/use-pull-to-refresh'

export default function TagsScreen() {
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api } = useSession()
  const tags = useQuery(tagsQuery(api))
  const pull = usePullToRefresh(tags.refetch)

  // Top level, like places: sub-tags are listed on their parent's page, and
  // search looks through every level.
  const rows = useMemo(
    () =>
      tagTree(tags.data ?? [])
        .filter((n) => n.depth === 0)
        .map((n) => ({
          ...n.tag,
          subtitle: n.children.length ? pluralize(n.children.length, 'sub-tag') : n.tag.description || undefined,
        })),
    [tags.data],
  )

  return (
    <TabScreen>
      <FlashList
        data={rows}
        keyExtractor={(t) => t.id!}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: rt.insets.bottom + FAB_SPACE + theme.spacing(4) }}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          tags.isPending ? (
            <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
          ) : (
            <EmptyState icon={icons.tag} title="No tags yet" />
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
            title={item.name ?? ''}
            subtitle={item.subtitle}
            leading={
              <View style={styles.dot}>
                <TagDot color={item.color} size={12} />
              </View>
            }
            chevron
            onPress={() =>
              router.push({ pathname: '/tag/[id]', params: { id: item.id!, name: item.name, color: item.color } })
            }
          />
        )}
      />
      <ActionFab />
    </TabScreen>
  )
}

const styles = StyleSheet.create((theme) => ({
  dot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    paddingVertical: theme.spacing(16),
  },
}))
