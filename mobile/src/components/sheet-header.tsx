import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { PressableFeedback } from './pressable-feedback'

interface SheetAction {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Emphasised (the primary action). */
  primary?: boolean
}

/** Title row for form sheets: cancel on the left, the primary action on the right. */
export function SheetHeader({ title, left, right }: { title: string; left?: SheetAction; right?: SheetAction }) {
  return (
    <View style={styles.root}>
      <View style={styles.side}>{left ? <HeaderAction {...left} /> : null}</View>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right ? <HeaderAction {...right} /> : null}</View>
    </View>
  )
}

function HeaderAction({ label, onPress, disabled, primary }: SheetAction) {
  return (
    <PressableFeedback
      onPress={onPress}
      disabled={disabled}
      style={styles.action}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}>
      <Text style={styles.actionText(!!primary, !!disabled)}>{label}</Text>
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  side: {
    flex: 1,
    alignItems: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    ...theme.type.rowTitle,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    maxWidth: '50%',
  },
  action: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionText: (primary: boolean, disabled: boolean) => ({
    ...theme.type.body,
    fontWeight: primary ? '600' : '400',
    color: disabled ? theme.colors.textFaint : primary ? theme.colors.primary : theme.colors.textMuted,
  }),
}))
