import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { selfQuery, serverStatusQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

export default function AccountScreen() {
  const { session, api, signOut } = useSession()
  const self = useQuery(selfQuery(api))
  const status = useQuery({ ...serverStatusQuery(session?.serverUrl ?? ''), enabled: !!session })

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You’ll need to sign in again to see your items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          signOut()
        },
      },
    ])
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">
        Account
      </Text>
      <View style={styles.card}>
        <Row label="Name" value={self.data?.name} />
        <View style={styles.separator} />
        <Row label="Email" value={self.data?.email} />
      </View>

      <View style={styles.card}>
        <Row label="Server" value={session?.serverUrl} />
        <View style={styles.separator} />
        <Row label="Version" value={status.data?.build.version} />
      </View>

      <ActionButton label="Sign out" variant="outlined" onPress={confirmSignOut} />
    </ScrollView>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value ?? 'loading'}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} selectable>
        {value ?? '—'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  heading: {
    ...theme.type.title,
    color: theme.colors.text,
  },
  content: {
    gap: theme.spacing(5),
    padding: theme.spacing(5),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
  },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.separator,
    paddingHorizontal: theme.spacing(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(4),
    minHeight: 48,
    paddingVertical: theme.spacing(3),
  },
  label: {
    fontSize: 16,
    color: theme.colors.text,
  },
  value: {
    flexShrink: 1,
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
  },
}))
