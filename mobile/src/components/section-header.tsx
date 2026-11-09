import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

/** Quiet group label above a section ("Sub-places · 3"). */
export function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.root} accessibilityRole="header">
      <Text style={styles.title}>{title}</Text>
      {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(2),
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.type.label,
    color: theme.colors.textMuted,
  },
  count: {
    ...theme.type.label,
    color: theme.colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
}))
