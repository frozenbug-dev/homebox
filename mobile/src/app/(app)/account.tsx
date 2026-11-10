import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { Icon } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { groupsQuery, selfQuery, serverStatusQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

export default function AccountScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session, api, signOut, setTenant } = useSession()
  const self = useQuery(selfQuery(api))
  const groups = useQuery(groupsQuery(api))
  const status = useQuery({ ...serverStatusQuery(session?.serverUrl ?? ''), enabled: !!session })
  const currentGroup = session?.tenantId ?? self.data?.defaultGroupId

  const switchTo = async (id: string) => {
    if (id === currentGroup) return
    Haptics.selectionAsync()
    await setTenant(id)
    router.back()
  }

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

      {groups.data && groups.data.length > 1 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Collections</Text>
          <View style={styles.card} accessibilityRole="radiogroup">
            {groups.data.map((g, i) => {
              const selected = g.id === currentGroup
              return (
                <View key={g.id}>
                  {i > 0 ? <View style={styles.separator} /> : null}
                  <PressableFeedback
                    onPress={() => switchTo(g.id!)}
                    style={styles.row}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${g.name}${g.currency ? `, ${g.currency}` : ''}`}>
                    <Text style={styles.label}>{g.name}</Text>
                    {selected ? (
                      <Icon name={{ ios: 'checkmark', android: 'check' }} size={18} color={theme.colors.primary} />
                    ) : (
                      <Text style={styles.value}>{g.currency}</Text>
                    )}
                  </PressableFeedback>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

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
  group: {
    gap: theme.spacing(2),
  },
  groupLabel: {
    ...theme.type.label,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing(1),
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
  },
}))
