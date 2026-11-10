import { Platform, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Icon } from './icon'
import { PressableFeedback } from './pressable-feedback'

interface SheetAction {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Emphasised (the primary action). */
  primary?: boolean
}

interface SheetHeaderProps {
  title: string
  /** Dismisses the sheet (Cancel / Done). Android shows it as a close icon. */
  left?: SheetAction
  right?: SheetAction
}

/**
 * Title row for form sheets.
 * iOS: text buttons either side of a centred title (Cancel · Title · Save).
 * Android (Material 3): close icon, start-aligned title, filled primary button.
 */
export function SheetHeader({ title, left, right }: SheetHeaderProps) {
  if (Platform.OS === 'android') return <MaterialSheetHeader title={title} left={left} right={right} />

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

function MaterialSheetHeader({ title, left, right }: SheetHeaderProps) {
  const { theme } = useUnistyles()
  return (
    <View style={[styles.root, styles.materialRoot]}>
      {left ? (
        <PressableFeedback
          onPress={left.onPress}
          disabled={left.disabled}
          borderless
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={left.label}>
          <Icon name={{ ios: 'xmark', android: 'close' }} size={24} color={theme.colors.text} />
        </PressableFeedback>
      ) : (
        <View style={styles.inset} />
      )}
      <Text style={styles.materialTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {right ? (
        right.primary ? (
          <PressableFeedback
            onPress={right.onPress}
            disabled={right.disabled}
            style={styles.filled(!!right.disabled)}
            accessibilityRole="button"
            accessibilityLabel={right.label}
            accessibilityState={{ disabled: right.disabled }}>
            <Text style={styles.filledText(!!right.disabled)}>{right.label}</Text>
          </PressableFeedback>
        ) : (
          <HeaderAction {...right} />
        )
      ) : null}
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
  materialRoot: {
    gap: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(4),
  },
  close: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inset: {
    width: theme.spacing(3),
  },
  materialTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.text,
  },
  filled: (disabled: boolean) => ({
    height: 40,
    paddingHorizontal: theme.spacing(6),
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: disabled ? theme.colors.surfaceSelected : theme.colors.primary,
  }),
  filledText: (disabled: boolean) => ({
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: disabled ? theme.colors.textFaint : theme.colors.onPrimary,
  }),
}))
