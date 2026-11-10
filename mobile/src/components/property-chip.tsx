import { Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Icon, type IconName } from './icon'
import { PressableFeedback } from './pressable-feedback'

interface PropertyChipProps {
  icon: IconName
  label: string
  /** Muted styling for "not set" values ("No place"). */
  empty?: boolean
  onPress?: () => void
  accessibilityLabel?: string
}

/** Linear-style property pill: icon + value, tap to change. */
export function PropertyChip({ icon, label, empty, onPress, accessibilityLabel }: PropertyChipProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      disabled={!onPress}
      feedback="scale"
      style={styles.chip}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}>
      <Icon name={icon} size={15} />
      <Text style={styles.label(!!empty)} numberOfLines={1}>
        {label}
      </Text>
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    height: 32,
    maxWidth: '100%',
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  label: (empty: boolean) => ({
    ...theme.type.meta,
    fontWeight: '500',
    flexShrink: 1,
    color: empty ? theme.colors.textMuted : theme.colors.text,
  }),
}))
