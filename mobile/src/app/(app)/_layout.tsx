import * as QuickActions from 'expo-quick-actions'
import { useQuickActionRouting, type RouterAction } from 'expo-quick-actions/router'
import { Stack } from 'expo-router'
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { useHeaderOptions } from '@/components/tab-stack'

const TAB_TITLES: Record<string, string> = { '(items)': 'Items', '(places)': 'Places', '(tags)': 'Tags', '(search)': 'Search' }

// Deep links straight to an item or place still get the tabs behind them.
export const unstable_settings = { anchor: '(tabs)' }

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
  const headerOptions = useHeaderOptions()
  // Item and place pages sit above the tabs: no tab bar, a bottom toolbar of
  // their own actions instead. The back button is just the chevron, since the
  // screen behind them may be any tab.
  // Transparent overlays: the stack's default content background would cover
  // the screen underneath, so clear it.
  const overlay = {
    presentation: 'transparentModal',
    headerShown: false,
    contentStyle: { backgroundColor: 'transparent' },
  } as const
  const detailOptions = { ...headerOptions, headerShown: true, headerBackButtonDisplayMode: 'minimal', title: '' } as const

  // Only registered while signed in (this layout is behind the auth guard),
  // and cleared again on sign-out by the root layout.
  useQuickActionRouting()
  useEffect(() => {
    QuickActions.setItems(QUICK_ACTIONS).catch(() => {})
  }, [])

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
      {/* Titled after the open tab: it names the way back from item / place pages
          (back button long-press menu, VoiceOver). */}
      <Stack.Screen
        name="(tabs)"
        options={({ route }) => ({ headerShown: false, title: TAB_TITLES[getFocusedRouteNameFromRoute(route) ?? ''] ?? 'Items' })}
      />
      <Stack.Screen name="item/[id]" options={detailOptions} />
      {/* Places list their items, so they get a large title that collapses as you scroll (iOS). */}
      <Stack.Screen name="place/[id]" options={{ ...detailOptions, headerLargeTitle: true }} />
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
      {/* Android search view: transparent, since it expands itself out of the
          search bar on the list tabs (and shrinks back into it). */}
      <Stack.Screen name="find" options={{ ...overlay, animation: 'none' }} />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="asset/[assetId]" options={{ ...overlay, animation: 'fade' }} />
      <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      {/* Transparent so the screen underneath shows through; the viewer animates
          itself (morphing out of / back into the tapped photo). */}
      <Stack.Screen name="photos" options={{ ...overlay, animation: 'none' }} />
      <Stack.Screen name="new-item" options={sheet([0.75, 1])} />
      <Stack.Screen name="edit-tag" options={sheet([0.6, 1])} />
      <Stack.Screen name="edit-text" options={sheet([0.5, 1])} />
      <Stack.Screen name="pick-place" options={sheet([0.7, 1])} />
      <Stack.Screen name="pick-tags" options={sheet([0.7, 1])} />
      <Stack.Screen name="maintenance" options={sheet([0.7, 1])} />
      <Stack.Screen name="edit-field" options={sheet([0.6, 1])} />
    </Stack>
  )
}
