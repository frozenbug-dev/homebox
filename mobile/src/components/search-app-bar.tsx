import { useRouter } from 'expo-router'
import { useRef, type ComponentRef, type ReactNode } from 'react'
import { Platform, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { setSearchOrigin } from '@/lib/search-transition'

import { AccountButton } from './account-button'
import { Icon, icons } from './icon'
import { PressableFeedback } from './pressable-feedback'

/** Height of the search app bar below the status bar. */
export const SEARCH_APP_BAR_HEIGHT = 72

/**
 * Android top app bar of the list tabs: a Material 3 search bar (one search
 * for items, places and tags) with the account avatar at its trailing edge.
 * Tapping it opens the full-screen search view (`/find`).
 */
export function SearchAppBar() {
  const { theme } = useUnistyles()
  const router = useRouter()
  const bar = useRef<ComponentRef<typeof View>>(null)

  // The search view expands out of the bar, so it needs to know where it is.
  const open = () => {
    const view = bar.current
    if (!view) {
      setSearchOrigin(null)
      router.push('/find')
      return
    }
    view.measureInWindow((x, y, width, height) => {
      setSearchOrigin(width > 0 ? { x, y, width, height } : null)
      router.push('/find')
    })
  }

  return (
    <View style={styles.root}>
      <View ref={bar} collapsable={false}>
        <PressableFeedback
          onPress={open}
          style={styles.bar}
          accessibilityRole="button"
          accessibilityHint="Opens search"
          accessibilityLabel="Search items, places and tags">
          <Icon name={icons.search} size={24} color={theme.colors.text} />
          <Text style={styles.placeholder} numberOfLines={1}>
            Search items, places and tags
          </Text>
          <AccountButton />
        </PressableFeedback>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  root: {
    paddingTop: rt.insets.top + theme.spacing(2),
    paddingBottom: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    backgroundColor: theme.colors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(4),
    height: 56,
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(3),
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textMuted,
  },
}))

/**
 * Root of a list tab. Android: the search app bar above the content. iOS:
 * nothing extra, and no wrapper view, since the large title only collapses
 * with scrolling when the list is the screen's first native view.
 */
export function TabScreen({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') return <>{children}</>
  return (
    <View style={styles.screen}>
      <SearchAppBar />
      {children}
    </View>
  )
}
