import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { selfQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

import { PressableFeedback } from './pressable-feedback'

function initials(name?: string, email?: string) {
  const source = name?.trim() || email || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Avatar in the header that opens the account sheet. */
export function AccountButton() {
  const router = useRouter()
  const { api } = useSession()
  const { data: self } = useQuery(selfQuery(api))

  return (
    <PressableFeedback
      onPress={() => router.push('/account')}
      borderless
      feedback="scale"
      style={styles.avatar}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Account">
      <Text style={styles.initials}>{initials(self?.name, self?.email)}</Text>
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  initials: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
}))
