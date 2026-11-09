import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { EntityList } from '@/components/entity-list'
import { HeaderButton, HeaderMenu } from '@/components/header-button'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { SectionHeader } from '@/components/section-header'
import { confirmDelete, useDeleteEntity, usePatchEntity } from '@/lib/api/mutations'
import { entityKeys, findInTree, placesTreeQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'
import { useSheets } from '@/lib/use-sheets'

export default function PlaceDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))
  const qc = useQueryClient()
  const sheets = useSheets()
  const patch = usePatchEntity(id)
  const remove = useDeleteEntity()

  const found = tree.data ? findInTree(tree.data, id) : null
  const title = found?.node.name ?? name ?? 'Place'
  const subPlaces = found?.node.children ?? []
  const trail = found?.trail ?? []
  const parentId = trail.at(-1)?.id ?? null

  const rename = () =>
    sheets.editText({
      title: 'Rename place',
      value: title,
      required: true,
      onSave: (name) => patch.mutate({ name }, { onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.tree() }) }),
    })

  const move = () =>
    sheets.pickPlace({
      title: 'Move inside',
      selectedId: parentId,
      excludeId: id,
      allowTopLevel: true,
      onSelect: (p) => {
        if (p.id === parentId) return
        patch.mutate(p.id ? { parentId: p.id } : { clearParent: true })
      },
    })

  const onDelete = async () => {
    const detail = subPlaces.length
      ? 'Places and items inside it are deleted too. This can’t be undone.'
      : 'Items stored here are deleted too. This can’t be undone.'
    if (!(await confirmDelete(`“${title}”`, detail))) return
    await remove.mutateAsync(id)
    router.back()
  }

  const addItem = () => router.push({ pathname: '/new-item', params: { parentId: id, parentName: title } })

  const header = (
    <View>
      {trail.length ? (
        <Text style={styles.trail} numberOfLines={1}>
          {trail.map((t) => t.name).join(' › ')}
        </Text>
      ) : null}
      {subPlaces.length ? (
        <>
          <SectionHeader title="Places inside" count={subPlaces.length} />
          {subPlaces.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowSeparator /> : null}
              <ListRow
                title={p.name ?? ''}
                subtitle={p.children?.length ? pluralize(p.children.length, 'place') : undefined}
                leading={
                  <View style={styles.icon}>
                    <Icon name={icons.placeFolder} size={18} />
                  </View>
                }
                chevron
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: p.id!, name: p.name } })}
              />
            </View>
          ))}
        </>
      ) : null}
      <SectionHeader title="Items" />
    </View>
  )

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="right">
        <HeaderButton sf="plus" md="add" label="Add item here" onPress={addItem} />
        <HeaderMenu>
          <Stack.Toolbar.MenuAction onPress={addItem}>Add item here</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            onPress={() =>
              router.push({ pathname: '/new-item', params: { kind: 'place', parentId: id, parentName: title } })
            }>
            Add place inside
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={rename}>Rename</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={move}>Move…</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction destructive onPress={onDelete}>
            Delete
          </Stack.Toolbar.MenuAction>
        </HeaderMenu>
      </Stack.Toolbar>
      <EntityList
        filters={{ parentIds: [id] }}
        header={header}
        showPlace={false}
        emptyTitle="Nothing here yet"
        emptyMessage={subPlaces.length ? 'Items stored directly in this place show up here.' : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  trail: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(1),
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
}))
