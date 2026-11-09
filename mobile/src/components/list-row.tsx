import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Icon, icons } from './icon'
import { PressableFeedback } from './pressable-feedback'

interface ListRowProps {
  title: string
  subtitle?: ReactNode
  leading?: ReactNode
  /** Small trailing text, e.g. a count or quantity. */
  detail?: string
  trailing?: ReactNode
  onPress?: () => void
  onLongPress?: () => void
  /** Shows a disclosure chevron (navigates somewhere). */
  chevron?: boolean
  accessibilityHint?: string
}

/** Dense, flat list row (Linear-style): one title line, one muted context line. */
export function ListRow({
  title,
  subtitle,
  leading,
  detail,
  trailing,
  onPress,
  onLongPress,
  chevron,
  accessibilityHint,
}: ListRowProps) {
  const content = (
    <>
      {leading}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {trailing}
      {chevron ? <Icon name={icons.chevron} size={16} /> : null}
    </>
  )

  if (!onPress && !onLongPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={title}>
        {content}
      </View>
    )
  }

  return (
    <PressableFeedback
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={[title, typeof subtitle === 'string' ? subtitle : null, detail].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}>
      {content}
    </PressableFeedback>
  )
}

export function RowSeparator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 56,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(2),
    backgroundColor: theme.colors.background,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.type.rowTitle,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  detail: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: theme.spacing(4) + 40 + theme.spacing(3),
    backgroundColor: theme.colors.separator,
  },
}))
