import { Stack } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { AccountButton } from '@/components/account-button'
import { EntityList } from '@/components/entity-list'
import { SCAN_FAB_SPACE, ScanFab } from '@/components/scan-fab'
import { useDebounced } from '@/lib/use-debounced'

export default function ItemsScreen() {
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())

  return (
    <View style={styles.root}>
      <Stack.SearchBar
        placeholder="Search items"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      <Stack.Toolbar placement="right">
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
