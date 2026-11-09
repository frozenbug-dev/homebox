import * as QuickActions from 'expo-quick-actions'
import { useQuickActionRouting, type RouterAction } from 'expo-quick-actions/router'
import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

/** Native form sheet starting at the smallest detent that shows the primary action. */
function sheet(detents: number[]) {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    headerShown: false,
  } as const
}

/**
 * Home-screen shortcuts (long-press the app icon). Android icons are generated
 * by the expo-quick-actions config plugin from assets/shortcuts.
 */
const QUICK_ACTIONS: RouterAction[] = [
  { id: 'scan', title: 'Scan', icon: Platform.select({ ios: 'symbol:qrcode.viewfinder', default: 'shortcut_scan' }), params: { href: '/scan' } },
  { id: 'item', title: 'New item', icon: Platform.select({ ios: 'symbol:shippingbox', default: 'shortcut_item' }), params: { href: '/new-item' } },
  {
    id: 'place',
    title: 'New place',
    icon: Platform.select({ ios: 'symbol:square.stack.3d.up', default: 'shortcut_place' }),
    params: { href: '/new-item?kind=place' },
  },
  { id: 'tag', title: 'New tag', icon: Platform.select({ ios: 'symbol:tag', default: 'shortcut_tag' }), params: { href: '/edit-tag' } },
]

export default function AppLayout() {
  const { theme } = useUnistyles()

  // Only registered while signed in (this layout is behind the auth guard),
  // and cleared again on sign-out by the root layout.
  useQuickActionRouting()
  useEffect(() => {
    QuickActions.setItems(QUICK_ACTIONS).catch(() => {})
  }, [])

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="account"
        options={{
          title: 'Account',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="asset/[assetId]" options={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="photos" options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="new-item" options={sheet([0.75, 1])} />
      <Stack.Screen name="edit-tag" options={sheet([0.6, 1])} />
      <Stack.Screen name="edit-text" options={sheet([0.5, 1])} />
      <Stack.Screen name="pick-place" options={sheet([0.7, 1])} />
      <Stack.Screen name="pick-tags" options={sheet([0.7, 1])} />
    </Stack>
  )
}
