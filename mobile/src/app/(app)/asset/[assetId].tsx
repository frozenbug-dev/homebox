import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { useSession } from '@/lib/auth/session'
import { scanCodeQuery } from '@/lib/scan'

/** Opens whatever an asset ID link (homecrate://a/000-123) points at. */
export default function AssetLinkScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>()
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const result = useQuery(scanCodeQuery(api, assetId))

  useEffect(() => {
    if (result.data?.kind !== 'entity') return
    const e = result.data.entity
    // withAnchor puts the tab's root screen underneath, so back works.
    router.replace(
      { pathname: e.entityType?.isLocation ? '/place/[id]' : '/item/[id]', params: { id: e.id!, name: e.name } },
      { withAnchor: true },
    )
  }, [result.data, router])

  const failed = result.isError || (result.data && result.data.kind !== 'entity')

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {failed ? (
          <>
            <Text style={styles.title}>Nothing found</Text>
            <Text style={styles.message}>
              {result.data?.kind === 'not-found' ? result.data.message : `Couldn’t open asset ${assetId}.`}
            </Text>
            <ActionButton label="Close" variant="outlined" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.colors.textMuted} />
            <Text style={styles.message}>Opening asset {assetId}…</Text>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(8),
    backgroundColor: theme.colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(6),
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.elevated,
  },
  title: {
    ...theme.type.rowTitle,
    fontSize: 17,
    color: theme.colors.text,
  },
  message: {
    ...theme.type.body,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
}))
