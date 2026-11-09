import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AccountButton } from '@/components/account-button'
import { EntityList } from '@/components/entity-list'
import { HeaderButton } from '@/components/header-button'
import { SCAN_FAB_SPACE, ScanFab } from '@/components/scan-fab'
import { useDebounced } from '@/lib/use-debounced'

export default function ItemsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())

  return (
    <View style={styles.root}>
      <Stack.SearchBar
        placeholder="Search items"
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
        <HeaderButton sf="plus" md="add" label="New item" onPress={() => router.push('/new-item')} />
        <Stack.Toolbar.View>
          <AccountButton />
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      <EntityList
        filters={{ q }}
        bottomSpace={SCAN_FAB_SPACE}
        emptyTitle={q ? 'No matches' : 'No items yet'}
        emptyMessage={q ? `Nothing matches “${q}”.` : 'Items you add show up here.'}
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
}))
