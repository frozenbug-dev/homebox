import { FlashList } from '@shopify/flash-list'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { SymbolView } from 'expo-symbols'
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { apiUrl } from '@/lib/api/client'
import { itemsQuery } from '@/lib/api/queries'
import type { EntitySummary } from '@/lib/api/types'
import { useSession } from '@/lib/auth/session'
import type { Session } from '@/lib/auth/storage'

export default function ItemsScreen() {
  const { theme } = useUnistyles()
  const { session, authedRequest } = useSession()
  const query = useInfiniteQuery(itemsQuery(session, authedRequest))

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0

  if (query.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    )
  }

  if (query.isError && !query.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Couldn’t load items</Text>
        <Text style={styles.emptyText}>{query.error.message}</Text>
        <View style={styles.retry}>
          <ActionButton label="Try again" variant="outlined" onPress={() => query.refetch()} />
        </View>
      </View>
    )
  }

  return (
    <FlashList
      data={items}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        total > 0 ? <Text style={styles.count}>{total === 1 ? '1 item' : `${total} items`}</Text> : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptyText}>Items you add in Homebox show up here.</Text>
        </View>
      }
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} /> : null
      }
      ItemSeparatorComponent={Separator}
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
          tintColor={theme.colors.primary}
          progressBackgroundColor={theme.colors.surface}
        />
      }
      renderItem={({ item }) => <ItemRow item={item} session={session} />}
    />
  )
}

function ItemRow({ item, session }: { item: EntitySummary; session: Session | null }) {
  const { theme } = useUnistyles()
  const imageId = item.thumbnailId ?? item.imageId
  const details = [item.parent?.name, item.quantity > 1 ? `×${item.quantity}` : null].filter(Boolean).join(' · ')

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[item.name, details].filter(Boolean).join(', ')}>
      <View style={styles.thumb}>
        {imageId && session ? (
          <Image
            source={{
              uri: apiUrl(session.serverUrl, `/entities/${item.id}/attachments/${imageId}`),
              headers: { Authorization: session.token },
              cacheKey: `${session.serverUrl}/${imageId}`,
            }}
            style={styles.thumbImage}
            contentFit="cover"
            transition={150}
            recyclingKey={item.id}
          />
        ) : (
          <SymbolView
            name={{ ios: 'shippingbox', android: 'inventory_2' }}
            size={22}
            tintColor={theme.colors.textMuted}
          />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
        {details ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {details}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

const THUMB = 44

const styles = StyleSheet.create((theme, rt) => ({
  list: {
    paddingHorizontal: theme.spacing(4),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(6),
    backgroundColor: theme.colors.background,
  },
  retry: {
    width: 200,
    marginTop: theme.spacing(3),
  },
  count: {
    fontSize: 13,
    color: theme.colors.textMuted,
    paddingVertical: theme.spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 64,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2.5),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSelected,
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  separator: {
    height: theme.spacing(2),
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(16),
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  footer: {
    paddingVertical: theme.spacing(4),
  },
}))
