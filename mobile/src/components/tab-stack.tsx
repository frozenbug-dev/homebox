import { Stack } from 'expo-router'
import { Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

/**
 * Native stack used by every tab. Item, place and tag details are shared
 * routes, so drilling in keeps you inside the tab you started from.
 */
export function TabStack({ root, title }: { root: string; title: string }) {
  const { theme } = useUnistyles()

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        // iOS draws its own (glass) bar background and adapts button vibrancy to
        // the backdrop; setting a fixed color disables that adaptation.
        headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: theme.colors.background },
        headerTintColor: Platform.OS === 'ios' ? undefined : theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name={root} options={{ title, headerLargeTitle: true }} />
      <Stack.Screen name="item/[id]" options={{ title: '' }} />
      {/* Lists get a large title that collapses into the bar as you scroll (iOS). */}
      <Stack.Screen name="place/[id]" options={{ title: '', headerLargeTitle: true }} />
      <Stack.Screen name="tag/[id]" options={{ title: '', headerLargeTitle: true }} />
    </Stack>
  )
}
