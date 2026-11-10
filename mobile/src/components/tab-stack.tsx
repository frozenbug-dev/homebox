import { Stack } from 'expo-router'
import { Platform, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

/**
 * `headerTitle` for screens that draw their name themselves (in the page or
 * over a cover) but still set `title`: the bar stays empty while `title`
 * names the screen in the back button's long-press menu and for VoiceOver.
 */
export function EmptyHeaderTitle() {
  return <View />
}

/** Header look shared by the tab stacks and the item / place detail screens. */
export function useHeaderOptions() {
  const { theme } = useUnistyles()
  return {
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    // iOS draws its own (glass) bar background and adapts button vibrancy to
    // the backdrop; setting a fixed color disables that adaptation.
    headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: theme.colors.background },
    headerTintColor: Platform.OS === 'ios' ? undefined : theme.colors.text,
    contentStyle: { backgroundColor: theme.colors.background },
  }
}

/**
 * Native stack used by every tab. Tag details are a shared route, so drilling
 * in keeps you inside the tab you started from. Items and places open above
 * the tabs (see the app layout) so they can show their own bottom toolbar.
 */
export function TabStack({ root, title }: { root: string; title: string }) {
  const headerOptions = useHeaderOptions()

  // iOS centers the collapsed title when it fits between the bar buttons and
  // only moves it to the leading edge when it doesn't, so short titles ("Tags")
  // ended up centered while longer ones sat on the left. UIKit has no alignment
  // setting, so we pad the title with braille blanks (U+2800) to make it too
  // wide to center. They render empty but, unlike spaces, UIKit doesn't drop them.
  const rootTitle = Platform.OS === 'ios' ? `${title}\u2800\u2800\u2800\u2800` : title

  return (
    <Stack
      screenOptions={({ navigation, route }) => ({
        // Keep the padding out of the back button on the first pushed screen.
        headerBackTitle:
          navigation.getState()?.routes.findIndex((r: { key: string }) => r.key === route.key) === 1
            ? title
            : undefined,
        ...headerOptions,
      })}>
      {/* Android: the screen draws a Material 3 search bar as its top app bar instead. */}
      <Stack.Screen
        name={root}
        options={{ title: rootTitle, headerLargeTitle: true, headerShown: Platform.OS === 'ios' }}
      />
      {/* Lists get a large title that collapses into the bar as you scroll (iOS). */}
      <Stack.Screen name="tag/[id]" options={{ title: '', headerLargeTitle: true }} />
    </Stack>
  )
}
