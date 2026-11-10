import type { AndroidSymbol, SFSymbol } from 'expo-symbols'
import { Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { useMaterialSymbol } from '@/lib/use-material-symbol'

// The toolbar must always contain its items (it doesn't pick up ones that
// appear later), so until the Android icon image is ready they render hidden
// with a transparent placeholder (an undefined icon logs a warning).
const BLANK = require('@/assets/images/blank.png')

// Toolbar items render in the native header, outside the screen's React
// tree, so a colour override has to come in as a prop (not context).
// On iOS, buttons sit inside Liquid Glass pills, so an explicit white
// override for full-bleed covers would make the icon unreadable against the
// light glass background.
function useToolbarIcon(sf: SFSymbol, md: AndroidSymbol, override?: string) {
  const { theme } = useUnistyles()
  const tint = (Platform.OS === 'ios' ? undefined : override) ?? theme.colors.text
  const source = useMaterialSymbol(md, 24, tint)
  return { icon: Platform.OS === 'ios' ? sf : (source ?? undefined), tint }
}

/**
 * Props for a `Stack.Toolbar.Button` / `Stack.Toolbar.Menu` icon: an SF Symbol
 * on iOS, a Material Symbol image on Android, plus its tint.
 *
 * These are props, not wrapper components, because on iOS `Stack.Toolbar`
 * only keeps its direct Button / Menu / View / Spacer children and silently
 * drops anything else (Android renders wrappers, iOS doesn't).
 *
 * @example
 * <Stack.Toolbar.Button {...useHeaderIcon('plus', 'add', tint)} accessibilityLabel="Add" onPress={add} />
 */
export function useHeaderIcon(sf: SFSymbol, md: AndroidSymbol, tintOverride?: string) {
  const { icon, tint } = useToolbarIcon(sf, md, tintOverride)
  return { icon: icon ?? BLANK, hidden: !icon, tintColor: tint }
}

/** Props for the overflow ("more") `Stack.Toolbar.Menu`. */
export function useMoreMenuIcon(tintOverride?: string) {
  return { ...useHeaderIcon('ellipsis.circle', 'more_vert', tintOverride), accessibilityLabel: 'More actions' }
}
