import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AccountButton } from '@/components/account-button'
import { HeaderButton } from '@/components/header-button'
import { EmptyState } from '@/components/empty-state'
import { icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { SCAN_FAB_SPACE, ScanFab } from '@/components/scan-fab'
import { TagDot } from '@/components/tag-chip'
import { isNil } from '@/lib/api/api'
import { tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

export default function TagsScreen() {
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api } = useSession()
  const tags = useQuery(tagsQuery(api))
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const all = tags.data ?? []
    const byId = new Map(all.map((t) => [t.id, t]))
    const q = search.trim().toLowerCase()
    return all
      .filter((t) => !q || (t.name ?? '').toLowerCase().includes(q))
      .map((t) => ({ ...t, parentName: isNil(t.parentId) ? undefined : byId.get(t.parentId!)?.name }))
  }, [tags.data, search])

  return (
    <View style={styles.root}>
      <Stack.SearchBar
        placeholder="Search tags"
        autoCapitalize="none"
        hideWhenScrolling={false}
        headerIconColor={theme.colors.text}
        tintColor={theme.colors.primary}
        textColor={theme.colors.text}
        hintTextColor={theme.colors.placeholder}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      <Stack.Toolbar placement="right">
        <HeaderButton sf="plus" md="add" label="New tag" onPress={() => router.push('/edit-tag')} />
        <Stack.Toolbar.View>
          <AccountButton />
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      <FlashList
        data={rows}
        keyExtractor={(t) => t.id!}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: rt.insets.bottom + SCAN_FAB_SPACE + theme.spacing(4) }}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          tags.isPending ? (
            <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
          ) : (
            <EmptyState icon={icons.tag} title={search ? 'No matches' : 'No tags yet'} />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={tags.isRefetching}
            onRefresh={() => {
              tags.refetch()
            }}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.textMuted}
            progressBackgroundColor={theme.colors.elevated}
          />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name ?? ''}
            subtitle={item.parentName ? `in ${item.parentName}` : item.description || undefined}
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
      <ScanFab />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
