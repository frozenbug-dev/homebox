import { Stack } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { EmptyState } from '@/components/empty-state'
import { icons } from '@/components/icon'
import { SearchResults } from '@/components/search-results'
import { recentSearches } from '@/lib/recent-searches'
import { useDebounced } from '@/lib/use-debounced'

/**
 * iOS search tab (the system search button next to the tab bar): searches
 * items, places and tags at once. Android opens the search view (`/find`)
 * from the search bar on the list tabs.
 */
export default function SearchScreen() {
  const { theme } = useUnistyles()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())

  return (
    <>
      <Stack.SearchBar
        placeholder="Items, places and tags"
        autoCapitalize="none"
        hideWhenScrolling={false}
        tintColor={theme.colors.primary}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onSearchButtonPress={(e) => recentSearches.add(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      {q ? (
        <SearchResults q={q} onOpen={() => recentSearches.add(q)} />
      ) : (
        <View style={styles.idle}>
          <EmptyState
            icon={icons.search}
            title="Search everything"
            message="Find items by name, serial or model number, notes or tags, and jump to places and tags."
          />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  idle: {
    flex: 1,
    paddingTop: rt.insets.top + theme.spacing(16),
    backgroundColor: theme.colors.background,
  },
}))
