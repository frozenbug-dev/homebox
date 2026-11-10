import { Platform } from 'react-native'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { useUnistyles } from 'react-native-unistyles'

import { EntityList } from '@/components/entity-list'
import { ActionFab, FAB_SPACE, ListHeaderActions } from '@/components/action-fab'
import { useDebounced } from '@/lib/use-debounced'

export default function ItemsScreen() {
  const { theme } = useUnistyles()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())

  // No wrapper view: on iOS the large title only collapses with scrolling
  // when the list is the screen's first native view.
  return (
    <>
      {/* iOS searches from the search tab next to the tab bar. */}
      {Platform.OS === 'android' ? (
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
      ) : null}
      <ListHeaderActions />

      <EntityList
        filters={{ q }}
        bottomSpace={FAB_SPACE}
        emptyTitle={q ? 'No matches' : 'No items yet'}
        emptyMessage={q ? `Nothing matches “${q}”.` : 'Items you add show up here.'}
      />
      <ActionFab />
    </>
  )
}

