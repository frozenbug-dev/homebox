import { Stack, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { EntityList } from '@/components/entity-list'

export default function TagDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: name ?? 'Tag' }} />
      <EntityList filters={{ tagIds: [id] }} emptyTitle="Nothing tagged yet" />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}))
