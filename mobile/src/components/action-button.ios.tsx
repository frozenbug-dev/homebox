import type { ButtonVariant } from '@expo/ui'
import { ActivityIndicator, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { PressableFeedback } from './pressable-feedback'

interface ActionButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  busyLabel?: string
  busy?: boolean
}

/**
 * Full-width iOS button in the system's prominent / bordered / plain styles.
 * Built on PressableFeedback (press-scale) because @expo/ui's SwiftUI Button
 * sizes to its label inside a React Native host and ignores frame /
 * controlSize there, so it can't fill the width.
 */
export function ActionButton({ label, onPress, variant = 'filled', disabled, busy, busyLabel }: ActionButtonProps) {
  const { theme } = useUnistyles()
  const inactive = !!(disabled || busy)
  const textColor = variant === 'filled' ? theme.colors.onPrimary : theme.colors.primary

  return (
    <PressableFeedback
      onPress={onPress}
      disabled={inactive}
      feedback="scale"
      style={styles.button(variant, inactive)}
      accessibilityRole="button"
      accessibilityLabel={busy && busyLabel ? busyLabel : label}
      accessibilityState={{ disabled: inactive, busy: !!busy }}>
      {busy ? <ActivityIndicator color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  button: (variant: ButtonVariant, inactive: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    width: '100%',
    height: 50,
    borderRadius: 25,
    opacity: inactive ? 0.4 : 1,
    backgroundColor:
      variant === 'filled' ? theme.colors.primary : variant === 'outlined' ? theme.colors.primarySoft : 'transparent',
  }),
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
}))
