import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useCover } from '@/components/cover-scroll-view'

import { EntityList } from '@/components/entity-list'
import { useHeaderIcon } from '@/components/header-button'
import { toolbarMenu } from '@/components/toolbar-menu'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { PhotoPager } from '@/components/photo-pager'
import { SectionHeader } from '@/components/section-header'
import { confirmDelete, useDeleteEntity, usePatchEntity } from '@/lib/api/mutations'
import { entityKeys, entityQuery, findInTree, placesTreeQuery, seedEntityFromList } from '@/lib/api/queries'
import { splitAttachments } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'
import { useAddPhotos } from '@/lib/use-add-photos'
import { useLeaving } from '@/lib/use-leaving'
import { useSheets } from '@/lib/use-sheets'
import { useUploads } from '@/lib/uploads'

export default function PlaceDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))
  const qc = useQueryClient()
  const place = useQuery({
    ...entityQuery(api, id),
    placeholderData: () => seedEntityFromList(qc, id),
  })
  const { theme, rt } = useUnistyles()
  const { width } = useWindowDimensions()
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
  const { takePhotos, pickPhotos } = useAddPhotos(id, hasCover)
  const coverHeight = Math.round(width * 0.8) + rt.insets.top
  const cover = useCover({ coverHeight, title })
  const tint = hasCover ? cover.tint : undefined
  const addItemIcon = useHeaderIcon('plus', 'add')
  const addPlaceIcon = useHeaderIcon('folder.badge.plus', 'create_new_folder')
  const moveIcon = useHeaderIcon('tray.and.arrow.down', 'drive_file_move')
  // Cleared as soon as a swipe back starts (see useLeaving).
  const leaving = useLeaving()
  const photoLabel = hasCover ? 'Add photos' : 'Add a cover photo'

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
  const addPlace = () =>
    router.push({ pathname: '/new-item', params: { kind: 'place', parentId: id, parentName: title } })

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

  // No wrapper view: on iOS the large title only collapses with scrolling
  // when the list is the screen's first native view.
  return (
    <>
      {hasCover ? null : <Stack.Screen options={{ title }} />}
      <Stack.Toolbar placement="right">
        {toolbarMenu({
          id: 'more',
          label: 'More actions',
          icon: { ios: 'ellipsis.circle', android: 'more_vert' },
          tint,
          groups: [
            [{ label: 'Rename', icon: { ios: 'pencil', android: 'edit' }, onPress: rename }],
            [{ label: 'Delete', icon: { ios: 'trash', android: 'delete' }, destructive: true, onPress: onDelete }],
          ],
        })}
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
        bottomSpace={hasCover ? cover.bottomBarSpace : undefined}
        refreshOffset={cover.headerHeight}
        minContentHeight={hasCover ? cover.minContentHeight : undefined}
      />
      {hasCover ? cover.chrome : null}
      {/* Everyday actions sit in the bottom toolbar; rarer ones stay in the ⋯ menu. */}
      {/* One centred group, rather than buttons spread across the bar. */}
      {leaving ? null : (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button {...addItemIcon} onPress={addItem}>
            Add item here
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Button {...addPlaceIcon} onPress={addPlace}>
            Add place inside
          </Stack.Toolbar.Button>
          {toolbarMenu({
            id: 'photos',
            label: photoLabel,
            showTitle: true,
            icon: { ios: 'camera', android: 'photo_camera' },
            groups: [
              [
                { label: 'Take photo', icon: { ios: 'camera', android: 'photo_camera' }, onPress: takePhotos },
                {
                  label: 'Choose from library',
                  icon: { ios: 'photo.on.rectangle', android: 'photo_library' },
                  onPress: pickPhotos,
                },
              ],
            ],
          })}
          <Stack.Toolbar.Button {...moveIcon} onPress={move}>
            Move inside
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Spacer />
        </Stack.Toolbar>
      )}
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
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
