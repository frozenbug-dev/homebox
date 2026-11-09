import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { EntityList } from '@/components/entity-list'
import { HeaderButton, HeaderMenu } from '@/components/header-button'
import { confirmDelete, useDeleteTag } from '@/lib/api/mutations'
import { tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

export default function TagDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tags = useQuery(tagsQuery(api))
  const remove = useDeleteTag()
  const title = tags.data?.find((t) => t.id === id)?.name ?? name ?? 'Tag'

  const onDelete = async () => {
    if (!(await confirmDelete(`tag “${title}”`, 'Items keep existing; they just lose this tag.'))) return
    await remove.mutateAsync(id)
    router.back()
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="right">
        <HeaderButton
          sf="plus"
          md="add"
          label="Add item with this tag"
          onPress={() => router.push({ pathname: '/new-item', params: { tagId: id } })}
        />
        <HeaderMenu>
          <Stack.Toolbar.MenuAction onPress={() => router.push({ pathname: '/edit-tag', params: { id } })}>
            Edit tag
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction destructive onPress={onDelete}>
            Delete tag
          </Stack.Toolbar.MenuAction>
        </HeaderMenu>
      </Stack.Toolbar>
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
