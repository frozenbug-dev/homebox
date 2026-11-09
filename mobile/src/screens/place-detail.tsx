import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useCover } from '@/components/cover-scroll-view'

import { EntityList } from '@/components/entity-list'
import { useHeaderIcon, useMoreMenuIcon } from '@/components/header-button'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { PhotoPager } from '@/components/photo-pager'
import { SectionHeader } from '@/components/section-header'
import { confirmDelete, useDeleteEntity, usePatchEntity } from '@/lib/api/mutations'
import { entityKeys, entityQuery, findInTree, placesTreeQuery } from '@/lib/api/queries'
import { splitAttachments } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'
import { useAddPhotos } from '@/lib/use-add-photos'
import { useSheets } from '@/lib/use-sheets'
import { useUploads } from '@/lib/uploads'

export default function PlaceDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))
  const place = useQuery(entityQuery(api, id))
  const { theme, rt } = useUnistyles()
  const { width } = useWindowDimensions()
  const qc = useQueryClient()
  const sheets = useSheets()
  const patch = usePatchEntity(id)
  const remove = useDeleteEntity()

  const found = tree.data ? findInTree(tree.data, id) : null
  const title = found?.node.name ?? name ?? 'Place'
  const subPlaces = found?.node.children ?? []
  const trail = found?.trail ?? []
  const parentId = trail.at(-1)?.id ?? null

  const { photos } = splitAttachments(place.data?.attachments)
  const hasCover = photos.length > 0
  const uploading = useUploads(id).filter((u) => u.status !== 'failed').length
  const { addPhotos } = useAddPhotos(id, hasCover)
  const coverHeight = Math.round(width * 0.8) + rt.insets.top
  const cover = useCover({ coverHeight, title })
  const tint = hasCover ? cover.tint : undefined
  const addIcon = useHeaderIcon('plus', 'add', tint)
  const menuIcon = useMoreMenuIcon(tint)

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
    <View style={hasCover ? cover.sheetStyle : undefined}>
      {hasCover ? <Text style={styles.title}>{title}</Text> : null}
      {uploading ? (
        <View style={styles.uploading}>
          <ActivityIndicator size="small" color={theme.colors.textMuted} />
          <Text style={styles.uploadingText}>Uploading {pluralize(uploading, 'photo')}…</Text>
        </View>
      ) : null}
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
      {hasCover ? null : <Stack.Screen options={{ title }} />}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button {...addIcon} accessibilityLabel="Add item here" onPress={addItem} />
        <Stack.Toolbar.Menu {...menuIcon}>
          <Stack.Toolbar.MenuAction onPress={addItem}>Add item here</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            onPress={() =>
              router.push({ pathname: '/new-item', params: { kind: 'place', parentId: id, parentName: title } })
            }>
            Add place inside
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={addPhotos}>{hasCover ? 'Add photos' : 'Add a cover photo'}</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={rename}>Rename</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={move}>Move…</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction destructive onPress={onDelete}>
            Delete
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <EntityList
        filters={{ parentIds: [id] }}
        header={
          hasCover ? (
            <View>
              {cover.renderCover(<PhotoPager entityId={id} photos={photos} height={coverHeight} />)}
              {header}
            </View>
          ) : (
            header
          )
        }
        showPlace={false}
        emptyTitle="Nothing here yet"
        emptyMessage={subPlaces.length ? 'Items stored directly in this place show up here.' : undefined}
        onScroll={hasCover ? cover.onScroll : undefined}
        edgeToEdge={hasCover}
        refreshOffset={cover.headerHeight}
        minContentHeight={hasCover ? cover.minContentHeight : undefined}
      />
      {hasCover ? cover.chrome : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(4),
  },
  uploading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(2),
  },
  uploadingText: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
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
