import { Stack } from 'expo-router'
import type { AndroidSymbol, SFSymbol } from 'expo-symbols'
import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { useMaterialSymbol } from '@/lib/use-material-symbol'

// The toolbar must always contain its items (it doesn't pick up ones that
// appear later), so until the Android icon image is ready they render hidden
// with a transparent placeholder (an undefined icon logs a warning).
const BLANK = require('@/assets/images/blank.png')

// Toolbar items render in the native header, outside the screen's React
// tree, so a colour override has to come in as a prop (not context).
function useToolbarIcon(sf: SFSymbol, md: AndroidSymbol, override?: string) {
  const { theme } = useUnistyles()
  const tint = override ?? theme.colors.text
  const source = useMaterialSymbol(md, 24, tint)
  return { icon: Platform.OS === 'ios' ? sf : (source ?? undefined), tint }
}

interface HeaderButtonProps {
  sf: SFSymbol
  md: AndroidSymbol
  label: string
  onPress: () => void
  /** Icon colour override, e.g. white over a cover photo (`useCover().tint`). */
  tint?: string
}

/** Icon button for a screen's `Stack.Toolbar` (SF Symbol on iOS, Material Symbol on Android). */
export function HeaderButton({ sf, md, label, onPress, tint: override }: HeaderButtonProps) {
  const { icon, tint } = useToolbarIcon(sf, md, override)
  return (
    <Stack.Toolbar.Button
      icon={icon ?? BLANK}
      hidden={!icon}
      tintColor={tint}
      accessibilityLabel={label}
      onPress={onPress}
    />
  )
}

/** Overflow ("more") menu for a screen's `Stack.Toolbar`. */
export function HeaderMenu({
  children,
  label = 'More actions',
  tint: override,
}: {
  children: ReactNode
  label?: string
  tint?: string
}) {
  const { icon, tint } = useToolbarIcon('ellipsis.circle', 'more_vert', override)
  return (
    <Stack.Toolbar.Menu icon={icon ?? BLANK} hidden={!icon} tintColor={tint} accessibilityLabel={label}>
      {children}
    </Stack.Toolbar.Menu>
  )
}
