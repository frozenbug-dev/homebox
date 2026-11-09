import { Stack, useRouter } from 'expo-router'

/** Space to leave at the bottom of lists for the FAB (none on iOS). */
export const SCAN_FAB_SPACE = 0

/**
 * iOS has no FABs (HIG), so the scanner lives in the navigation bar instead.
 * Rendered inside a screen, it adds a toolbar button to that screen's header.
 */
export function ScanFab() {
  const router = useRouter()
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button icon="qrcode.viewfinder" accessibilityLabel="Scan" onPress={() => router.push('/scan')} />
    </Stack.Toolbar>
  )
}
