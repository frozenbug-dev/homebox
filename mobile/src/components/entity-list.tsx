import { FlashList } from '@shopify/flash-list'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import type { ReactElement } from 'react'
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import type { EntitySummary } from '@/lib/api/api'
import { itemsQuery, type ItemFilters } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

import { ActionButton } from './action-button'
import { EmptyState } from './empty-state'
import { EntityThumb } from './entity-thumb'
import { icons } from './icon'
import { ListRow, RowSeparator } from './list-row'
import { TagInline } from './tag-chip'

interface EntityListProps {
  filters: ItemFilters
  /** Rendered above the rows (e.g. sub-places, filters). */
  header?: ReactElement | null
  emptyTitle?: string
  emptyMessage?: string
  /** Extra bottom padding (e.g. for a FAB). */
  bottomSpace?: number
  /** Show the place in the subtitle (off when listing one place's contents). */
  showPlace?: boolean
}

export function EntityList({
  filters,
  header,
  emptyTitle = 'No items',
  emptyMessage,
  bottomSpace = 0,
  showPlace = true,
}: EntityListProps) {
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api } = useSession()
  const query = useInfiniteQuery(itemsQuery(api, filters))

  const items = query.data?.pages.flatMap((p) => p.items ?? []) ?? []

  const footer = query.isFetchingNextPage ? (
    <ActivityIndicator style={styles.footer} color={theme.colors.textMuted} />
  ) : null

  let empty: ReactElement
  if (query.isPending) {
    empty = <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
  } else if (query.isError) {
    empty = (
      <EmptyState
        title="Couldn’t load items"
        message={query.error.message}
        action={<ActionButton label="Try again" variant="outlined" onPress={() => query.refetch()} />}
      />
    )
  } else {
    empty = <EmptyState icon={icons.item} title={emptyTitle} message={emptyMessage} />
  }

  return (
    <FlashList
      data={items}
      keyExtractor={(item) => item.id!}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: rt.insets.bottom + bottomSpace + theme.spacing(4) }}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      ItemSeparatorComponent={RowSeparator}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            query.refetch()
          }}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.textMuted}
          progressBackgroundColor={theme.colors.elevated}
        />
      }
      renderItem={({ item }) => (
        <EntityRow
          entity={item}
          showPlace={showPlace}
          onPress={() =>
            item.entityType?.isLocation
              ? router.push({ pathname: '/place/[id]', params: { id: item.id!, name: item.name } })
              : router.push({ pathname: '/item/[id]', params: { id: item.id!, name: item.name } })
          }
        />
      )}
    />
  )
}

export function EntityRow({
  entity,
  showPlace = true,
  onPress,
}: {
  entity: EntitySummary
  showPlace?: boolean
  onPress: () => void
}) {
  const place = showPlace ? entity.parent?.name : undefined
  const hasTags = !!entity.tags?.length

  return (
    <ListRow
      title={entity.name ?? ''}
      leading={<EntityThumb entity={entity} />}
      detail={entity.quantity && entity.quantity > 1 ? `×${entity.quantity}` : undefined}
      onPress={onPress}
      subtitle={
        place || hasTags ? (
          <View style={styles.subtitle}>
            {place ? (
              <Text style={styles.place} numberOfLines={1}>
                {place}
              </Text>
            ) : null}
            <TagInline tags={entity.tags} />
          </View>
        ) : undefined
      }
    />
  )
}

const styles = StyleSheet.create((theme) => ({
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2.5),
    overflow: 'hidden',
  },
  place: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    flexShrink: 1,
  },
  loading: {
    paddingVertical: theme.spacing(16),
  },
  footer: {
    paddingVertical: theme.spacing(4),
  },
}))
