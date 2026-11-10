import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { EntityList } from '@/components/entity-list'
import { useHeaderIcon } from '@/components/header-button'
import { ListRow, RowSeparator } from '@/components/list-row'
import { SectionHeader } from '@/components/section-header'
import { TagDot } from '@/components/tag-chip'
import { toolbarMenu } from '@/components/toolbar-menu'
import { confirmDelete, useDeleteTag } from '@/lib/api/mutations'
import { MAX_TAG_DEPTH, tagsQuery, tagTree } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'

export default function TagDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tags = useQuery(tagsQuery(api))
  const remove = useDeleteTag()
  const addIcon = useHeaderIcon('plus', 'add')

  const nodes = useMemo(() => tagTree(tags.data ?? []), [tags.data])
  const node = nodes.find((n) => n.tag.id === id)
  const title = node?.tag.name ?? name ?? 'Tag'
  const trail = node?.trail ?? []
  const subTags = node?.children ?? []
  const childCount = (tagId: string) => nodes.find((n) => n.tag.id === tagId)?.children.length ?? 0
  // The backend allows five levels of tags.
  const canNest = !node || node.depth + 1 < MAX_TAG_DEPTH

  const onDelete = async () => {
    const detail = subTags.length
      ? 'Items keep existing; they just lose this tag. Its sub-tags move up to the top level.'
      : 'Items keep existing; they just lose this tag.'
    if (!(await confirmDelete(`tag “${title}”`, detail))) return
    await remove.mutateAsync(id)
    router.back()
  }

  // Always in the menu (toolbar menus don't like changing items); explain
  // the limit instead of hiding it.
  const addSubTag = () => {
    if (!canNest) {
      Alert.alert('Can’t nest deeper', `Tags can be nested up to ${MAX_TAG_DEPTH} levels.`)
      return
    }
    router.push({ pathname: '/edit-tag', params: { parentId: id } })
  }

  const openTag = (tagId: string, tagName?: string, color?: string) =>
    router.push({ pathname: '/tag/[id]', params: { id: tagId, name: tagName, color } })

  const header =
    trail.length || subTags.length ? (
      <View>
        {trail.length ? (
          <Text style={styles.trail} numberOfLines={1}>
            {trail.map((t) => t.name).join(' › ')}
          </Text>
        ) : null}
        {subTags.length ? (
          <>
            <SectionHeader title="Sub-tags" count={subTags.length} />
            {subTags.map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <RowSeparator /> : null}
                <ListRow
                  title={t.name ?? ''}
                  subtitle={childCount(t.id!) ? pluralize(childCount(t.id!), 'sub-tag') : t.description || undefined}
                  leading={
                    <View style={styles.dot}>
                      <TagDot color={t.color} size={12} />
                    </View>
                  }
                  chevron
                  onPress={() => openTag(t.id!, t.name, t.color)}
                />
              </View>
            ))}
            <SectionHeader title="Items" />
          </>
        ) : null}
      </View>
    ) : null

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
              { label: 'New sub-tag', icon: { ios: 'tag', android: 'new_label' }, onPress: addSubTag },
            ],
            [{ label: 'Delete tag', icon: { ios: 'trash', android: 'delete' }, destructive: true, onPress: onDelete }],
          ],
        })}
      </Stack.Toolbar>
      {/* Items tagged with this tag or any of its sub-tags (the backend expands them). */}
      <EntityList filters={{ tagIds: [id] }} header={header} emptyTitle="Nothing tagged yet" />
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  trail: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(1),
  },
  dot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
