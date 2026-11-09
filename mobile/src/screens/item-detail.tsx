import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { EmptyState } from '@/components/empty-state'
import { HeaderMenu } from '@/components/header-button'
import { PressableFeedback } from '@/components/pressable-feedback'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { PropertyChip } from '@/components/property-chip'
import { SectionHeader } from '@/components/section-header'
import { TagChip } from '@/components/tag-chip'
import { confirmDelete, useDeleteEntity, useDuplicateEntity, usePatchEntity, type EntityPatch } from '@/lib/api/mutations'
import { useSheets } from '@/lib/use-sheets'
import type { Attachment, Entity } from '@/lib/api/api'
import { apiUrl } from '@/lib/api/client'
import { entityPathQuery, entityQuery } from '@/lib/api/queries'
import { attachmentSource } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'
import { formatDate, formatPrice } from '@/lib/format'

const PHOTO_HEIGHT = 280

export default function ItemDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api, session } = useSession()
  const item = useQuery(entityQuery(api, id))
  const path = useQuery(entityPathQuery(api, id))
  const patch = usePatchEntity(id)
  const remove = useDeleteEntity()
  const duplicate = useDuplicateEntity()
  const sheets = useSheets()

  if (!item.data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: name ?? '' }} />
        {item.isError ? (
          <EmptyState
            title="Couldn’t load this item"
            message={item.error.message}
            action={<ActionButton label="Try again" variant="outlined" onPress={() => item.refetch()} />}
          />
        ) : (
          <ActivityIndicator color={theme.colors.textMuted} />
        )}
      </View>
    )
  }

  const e = item.data
  const attachments = e.attachments ?? []
  const photos = attachments
    .filter((a) => a.type === 'photo' || a.mimeType?.startsWith('image/'))
    .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
  const files = attachments.filter((a) => !photos.includes(a))

  // Path to the item, without the item itself: "Downstairs › Kitchen".
  const containers = (path.data ?? []).filter((p) => p.id !== e.id)
  const placeLabel = containers.length
    ? containers
        .slice(-2)
        .map((p) => p.name)
        .join(' › ')
    : 'No place'
  const parent = containers.at(-1)

  const save = (body: EntityPatch) => patch.mutate(body)
  const editText = (
    title: string,
    value: string | undefined,
    toPatch: (v: string) => EntityPatch,
    kind: 'text' | 'multiline' | 'integer' | 'decimal' = 'text',
    required = false,
  ) => sheets.editText({ title, value: value ?? '', kind, required, onSave: (v) => save(toPatch(v)) })

  const move = () =>
    sheets.pickPlace({
      title: 'Move to',
      selectedId: parent?.id ?? null,
      onSelect: (p) => {
        if (p.id && p.id !== parent?.id) {
          save({ parentId: p.id })
          path.refetch()
        }
      },
    })

  const editTags = () =>
    sheets.pickTags({
      selectedIds: (e.tags ?? []).map((t) => t.id!),
      onChange: (tagIds) => save({ tagIds }),
    })

  const onDelete = async () => {
    if (!(await confirmDelete(`“${e.name}”`, 'The item, its photos and attachments are removed for everyone.'))) return
    await remove.mutateAsync(e.id!)
    router.back()
  }

  const onDuplicate = async () => {
    const copy = await duplicate.mutateAsync(e.id!)
    router.push({ pathname: '/item/[id]', params: { id: copy.id!, name: copy.name } })
  }

  const openFile = (a: Attachment) => {
    if (!session) return
    const url = `${apiUrl(session.serverUrl, `/entities/${e.id}/attachments/${a.id}`)}?access_token=${encodeURIComponent(session.attachmentToken)}`
    WebBrowser.openBrowserAsync(url)
  }

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: rt.insets.bottom + theme.spacing(8) }}
      refreshControl={
        <RefreshControl
          refreshing={item.isRefetching}
          onRefresh={() => {
            item.refetch()
            path.refetch()
          }}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.textMuted}
          progressBackgroundColor={theme.colors.elevated}
        />
      }>
      <Stack.Screen options={{ title: '' }} />
      <Stack.Toolbar placement="right">
        <HeaderMenu>
          <Stack.Toolbar.MenuAction onPress={() => editText('Name', e.name, (name) => ({ name }), 'text', true)}>
            Rename
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={move}>Move to…</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={onDuplicate}>Duplicate</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={() => save({ insured: !e.insured })}>
            {e.insured ? 'Mark as not insured' : 'Mark as insured'}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={() => save({ archived: !e.archived })}>
            {e.archived ? 'Unarchive' : 'Archive'}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction destructive onPress={onDelete}>
            Delete
          </Stack.Toolbar.MenuAction>
        </HeaderMenu>
      </Stack.Toolbar>

      {photos.length ? <PhotoPager entityId={e.id!} photos={photos} /> : null}

      <View style={styles.head}>
        {containers.length ? (
          <View style={styles.breadcrumb}>
            {containers.map((c, i) => (
              <Text key={c.id} style={styles.crumb} numberOfLines={1}>
                {i > 0 ? ' › ' : ''}
                <Text
                  accessibilityRole="link"
                  onPress={() =>
                    c.type === 'location'
                      ? router.push({ pathname: '/place/[id]', params: { id: c.id!, name: c.name } })
                      : router.push({ pathname: '/item/[id]', params: { id: c.id!, name: c.name } })
                  }>
                  {c.name}
                </Text>
              </Text>
            ))}
          </View>
        ) : null}
        <PressableFeedback
          onPress={() => editText('Name', e.name, (name) => ({ name }), 'text', true)}
          accessibilityRole="button"
          accessibilityHint="Rename"
          style={styles.titlePress}>
          <Text style={styles.title}>{e.name}</Text>
        </PressableFeedback>
        {e.assetId && e.assetId !== '000-000' ? <Text style={styles.asset}>#{e.assetId}</Text> : null}
      </View>

      <View style={styles.chips}>
        <PropertyChip
          icon={icons.place}
          label={placeLabel}
          empty={!parent}
          accessibilityLabel={`Place: ${placeLabel}. Move`}
          onPress={move}
        />
        <PropertyChip
          icon={icons.quantity}
          label={`×${e.quantity ?? 1}`}
          accessibilityLabel={`Quantity ${e.quantity ?? 1}. Change`}
          onPress={() =>
            editText('Quantity', String(e.quantity ?? 1), (v) => ({ quantity: v === '' ? 1 : Number(v) }), 'integer')
          }
        />
        <PropertyChip
          icon={icons.price}
          label={formatPrice(e.purchasePrice) ?? 'Price'}
          empty={!e.purchasePrice}
          accessibilityLabel={`Purchase price ${formatPrice(e.purchasePrice) ?? 'not set'}. Change`}
          onPress={() =>
            editText(
              'Purchase price',
              e.purchasePrice ? String(e.purchasePrice) : '',
              (v) => ({ purchasePrice: v === '' ? 0 : Number(v) }),
              'decimal',
            )
          }
        />
        {e.insured ? <PropertyChip icon={icons.insured} label="Insured" onPress={() => save({ insured: false })} accessibilityLabel="Insured. Tap to unmark" /> : null}
        {e.archived ? <PropertyChip icon={icons.archived} label="Archived" onPress={() => save({ archived: false })} accessibilityLabel="Archived. Tap to unarchive" /> : null}
        {e.tags?.map((t) => <TagChip key={t.id} tag={t} onPress={editTags} />)}
        <PropertyChip
          icon={icons.tag}
          label={e.tags?.length ? 'Edit tags' : 'Add tags'}
          empty
          onPress={editTags}
        />
      </View>

      <PressableFeedback
        onPress={() => editText('Description', e.description, (description) => ({ description }), 'multiline')}
        accessibilityRole="button"
        accessibilityLabel={e.description ? `Description: ${e.description}. Edit` : 'Add a description'}>
        <Text style={[styles.description, !e.description && styles.placeholder]}>
          {e.description || 'Add a description…'}
        </Text>
      </PressableFeedback>

      <Details entity={e} onEdit={editText} />

      {e.children?.length ? (
        <>
          <SectionHeader title="Inside" count={e.children.length} />
          {e.children.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <RowSeparator /> : null}
              <ListRow
                title={c.name ?? ''}
                leading={<Icon name={icons.item} size={18} style={styles.rowIcon} />}
                chevron
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: c.id!, name: c.name } })}
              />
            </View>
          ))}
        </>
      ) : null}

      {files.length ? (
        <>
          <SectionHeader title="Attachments" count={files.length} />
          {files.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <RowSeparator /> : null}
              <ListRow
                title={a.title || 'Attachment'}
                subtitle={attachmentKind(a)}
                leading={<Icon name={icons.document} size={18} style={styles.rowIcon} />}
                onPress={() => openFile(a)}
                accessibilityHint="Opens the file"
              />
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  )
}

function attachmentKind(a: Attachment) {
  const kinds: Record<string, string> = { manual: 'Manual', receipt: 'Receipt', warranty: 'Warranty' }
  return kinds[a.type ?? ''] ?? a.mimeType ?? 'File'
}

function PhotoPager({ entityId, photos }: { entityId: string; photos: Attachment[] }) {
  const { width } = useWindowDimensions()
  const { session } = useSession()
  const [index, setIndex] = useState(0)
  if (!session) return null

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(ev) => setIndex(Math.round(ev.nativeEvent.contentOffset.x / width))}>
        {photos.map((p) => (
          <Image
            key={p.id}
            source={attachmentSource(session, entityId, p.id!)}
            placeholder={p.thumbnail?.id ? attachmentSource(session, entityId, p.thumbnail.id) : undefined}
            style={{ width, height: PHOTO_HEIGHT }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={p.title || 'Photo'}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((p, i) => (
            <View key={p.id} style={styles.pageDot(i === index)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

type EditText = (
  title: string,
  value: string | undefined,
  toPatch: (v: string) => EntityPatch,
  kind?: 'text' | 'multiline' | 'integer' | 'decimal',
) => void

function Details({ entity: e, onEdit }: { entity: Entity; onEdit: EditText }) {
  const purchased = [formatDate(e.purchaseDate), e.purchaseFrom].filter(Boolean).join(' · ')
  const warranty = e.lifetimeWarranty ? 'Lifetime' : formatDate(e.warrantyExpires)
  // Editable text fields are always listed so they can be filled in.
  const editable: [string, string | undefined, (v: string) => EntityPatch][] = [
    ['Manufacturer', e.manufacturer, (manufacturer) => ({ manufacturer })],
    ['Model', e.modelNumber, (modelNumber) => ({ modelNumber })],
    ['Serial number', e.serialNumber, (serialNumber) => ({ serialNumber })],
  ]
  const rows: [string, string | null | undefined][] = [
    ['Purchased', purchased],
    ['Warranty', warranty ? `${warranty}${e.warrantyDetails ? ` · ${e.warrantyDetails}` : ''}` : null],
    ['Sold', [formatDate(e.soldDate), e.soldTo].filter(Boolean).join(' · ')],
    ...(e.fields ?? []).map(
      (f): [string, string | null] => [
        f.name ?? '',
        f.type === 'boolean' ? (f.booleanValue ? 'Yes' : 'No') : f.type === 'number' ? String(f.numberValue ?? '') : (f.textValue ?? ''),
      ],
    ),
  ]
  const visible = rows.filter(([, v]) => !!v)

  return (
    <>
      <SectionHeader title="Details" />
      <View style={styles.details}>
        {editable.map(([label, value, toPatch]) => (
          <PressableFeedback
            key={label}
            style={styles.detailRow}
            onPress={() => onEdit(label, value, toPatch)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value || 'not set'}. Edit`}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, !value && styles.placeholder]} numberOfLines={2}>
              {value || 'Add'}
            </Text>
          </PressableFeedback>
        ))}
      </View>
      {visible.length ? (
        <>
          <View style={styles.details}>
            {visible.map(([label, value]) => (
              <View key={label} style={styles.detailRow} accessible accessibilityLabel={`${label}: ${value}`}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue} selectable>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <SectionHeader title="Notes" />
      <PressableFeedback
        onPress={() => onEdit('Notes', e.notes, (notes) => ({ notes }), 'multiline')}
        accessibilityRole="button"
        accessibilityLabel={e.notes ? `Notes: ${e.notes}. Edit` : 'Add notes'}>
        <Text style={[styles.notes, !e.notes && styles.placeholder]}>{e.notes || 'Add notes…'}</Text>
      </PressableFeedback>
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  head: {
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(4),
    gap: theme.spacing(1),
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
  },
  titlePress: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.sm,
  },
  breadcrumb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  crumb: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  placeholder: {
    color: theme.colors.textFaint,
  },
  notes: {
    ...theme.type.body,
    lineHeight: 22,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(2),
  },
  asset: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(4),
  },
  description: {
    ...theme.type.body,
    lineHeight: 22,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(4),
  },
  details: {
    paddingHorizontal: theme.spacing(4),
  },
  detailRow: {
    flexDirection: 'row',
    gap: theme.spacing(4),
    paddingVertical: theme.spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
  },
  detailLabel: {
    ...theme.type.body,
    width: 120,
    color: theme.colors.textMuted,
  },
  detailValue: {
    ...theme.type.body,
    flex: 1,
    color: theme.colors.text,
  },
  rowIcon: {
    width: 40,
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing(3),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
  },
  pageDot: (active: boolean) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: active ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
  }),
}))
