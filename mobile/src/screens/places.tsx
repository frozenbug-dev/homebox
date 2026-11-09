import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AccountButton } from '@/components/account-button'
import { HeaderButton } from '@/components/header-button'
import { EmptyState } from '@/components/empty-state'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { SCAN_FAB_SPACE, ScanFab } from '@/components/scan-fab'
import { flattenTree, placesTreeQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'

export default function PlacesScreen() {
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))
  const [search, setSearch] = useState('')

  // Top level by default; searching looks through every level and shows full paths.
  const rows = useMemo(() => {
    const data = tree.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) {
      return data.map((p) => ({
        id: p.id!,
        name: p.name ?? '',
        subtitle: p.children?.length ? pluralize(p.children.length, 'place') : undefined,
      }))
    }
    return flattenTree(data)
      .filter((p) => p.name.toLowerCase().includes(q))
      .map((p) => ({ id: p.id, name: p.name, subtitle: p.depth > 0 ? p.path : undefined }))
  }, [tree.data, search])

  return (
    <View style={styles.root}>
      <Stack.SearchBar
        placeholder="Search places"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      <Stack.Toolbar placement="right">
        <HeaderButton
          sf="plus"
          md="add"
          label="New place"
          onPress={() => router.push({ pathname: '/new-item', params: { kind: 'place' } })}
        />
        <Stack.Toolbar.View>
          <AccountButton />
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      <FlashList
        data={rows}
        keyExtractor={(p) => p.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: rt.insets.bottom + SCAN_FAB_SPACE + theme.spacing(4) }}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          tree.isPending ? (
            <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
          ) : (
            <EmptyState
              icon={icons.placeFolder}
              title={search ? 'No matches' : 'No places yet'}
              message={search ? undefined : 'Rooms, shelves and boxes you add show up here.'}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={tree.isRefetching}
            onRefresh={() => {
              tree.refetch()
            }}
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
      <ScanFab />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
