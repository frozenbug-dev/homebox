import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { EntityList } from '@/components/entity-list'
import { useHeaderIcon } from '@/components/header-button'
import { toolbarMenu } from '@/components/toolbar-menu'
import { confirmDelete, useDeleteTag } from '@/lib/api/mutations'
import { tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

export default function TagDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tags = useQuery(tagsQuery(api))
  const remove = useDeleteTag()
  const addIcon = useHeaderIcon('plus', 'add')
  const title = tags.data?.find((t) => t.id === id)?.name ?? name ?? 'Tag'

  const onDelete = async () => {
    if (!(await confirmDelete(`tag “${title}”`, 'Items keep existing; they just lose this tag.'))) return
    await remove.mutateAsync(id)
    router.back()
  }

  // No wrapper view: on iOS the large title only collapses with scrolling
  // when the list is the screen's first native view.
  return (
    <>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          {...addIcon}
          accessibilityLabel="Add item with this tag"
          onPress={() => router.push({ pathname: '/new-item', params: { tagId: id } })}
        />
        {toolbarMenu({
          id: 'more',
          label: 'More actions',
          icon: { ios: 'ellipsis.circle', android: 'more_vert' },
          groups: [
            [
              {
                label: 'Edit tag',
                icon: { ios: 'pencil', android: 'edit' },
                onPress: () => router.push({ pathname: '/edit-tag', params: { id } }),
              },
            ],
            [{ label: 'Delete tag', icon: { ios: 'trash', android: 'delete' }, destructive: true, onPress: onDelete }],
          ],
        })}
      </Stack.Toolbar>
      <EntityList filters={{ tagIds: [id] }} emptyTitle="Nothing tagged yet" />
    </>
  )
}

