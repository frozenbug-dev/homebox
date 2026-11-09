import { Stack } from 'expo-router'
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
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name={root} options={{ title, headerLargeTitle: true }} />
      <Stack.Screen name="item/[id]" options={{ title: '' }} />
      <Stack.Screen name="place/[id]" options={{ title: '' }} />
      <Stack.Screen name="tag/[id]" options={{ title: '' }} />
    </Stack>
  )
}
