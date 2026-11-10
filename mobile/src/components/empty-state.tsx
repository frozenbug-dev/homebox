import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Icon, type IconName } from './icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {icon ? <Icon name={icon} size={28} /> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(16),
    paddingHorizontal: theme.spacing(8),
  },
  title: {
    ...theme.type.rowTitle,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: theme.spacing(1),
  },
  message: {
    ...theme.type.body,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  action: {
    marginTop: theme.spacing(3),
    width: 200,
  },
}))
