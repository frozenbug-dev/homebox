import { Stack } from 'expo-router'
import type { AndroidSymbol, SFSymbol } from 'expo-symbols'
import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { useMaterialSymbol } from '@/lib/use-material-symbol'

function useToolbarIcon(sf: SFSymbol, md: AndroidSymbol) {
  const { theme } = useUnistyles()
  const source = useMaterialSymbol(md, 24, theme.colors.text)
  return Platform.OS === 'ios' ? sf : (source ?? undefined)
}

interface HeaderButtonProps {
  sf: SFSymbol
  md: AndroidSymbol
  label: string
  onPress: () => void
}

/** Icon button for a screen's `Stack.Toolbar` (SF Symbol on iOS, Material Symbol on Android). */
export function HeaderButton({ sf, md, label, onPress }: HeaderButtonProps) {
  const icon = useToolbarIcon(sf, md)
  return <Stack.Toolbar.Button icon={icon} hidden={!icon} accessibilityLabel={label} onPress={onPress} />
}

/** Overflow ("more") menu for a screen's `Stack.Toolbar`. */
export function HeaderMenu({ children, label = 'More actions' }: { children: ReactNode; label?: string }) {
  const icon = useToolbarIcon('ellipsis.circle', 'more_vert')
  return (
    <Stack.Toolbar.Menu icon={icon} hidden={!icon} accessibilityLabel={label}>
      {children}
    </Stack.Toolbar.Menu>
  )
}
