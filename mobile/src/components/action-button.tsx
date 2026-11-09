import { Button, Host, type ButtonVariant } from '@expo/ui'
import { StyleSheet } from 'react-native-unistyles'

interface ActionButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  /** Shown instead of the label while an action runs; also disables the button. */
  busyLabel?: string
  busy?: boolean
}

/** Full-width native button (SwiftUI on iOS, Material 3 on Android). */
export function ActionButton({ label, onPress, variant = 'filled', disabled, busy, busyLabel }: ActionButtonProps) {
  return (
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <Button
        variant={variant}
        label={busy && busyLabel ? busyLabel : label}
        onPress={onPress}
        disabled={disabled || busy}
        style={styles.button}
      />
    </Host>
  )
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
  },
  button: {
    width: '100%' as const,
    height: 52,
  },
})
