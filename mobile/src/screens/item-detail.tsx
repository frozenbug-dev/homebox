import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { CoverScrollView } from '@/components/cover-scroll-view'
import { PhotoPager } from '@/components/photo-pager'
import { EmptyState } from '@/components/empty-state'
import { useHeaderIcon } from '@/components/header-button'
import { toolbarMenu } from '@/components/toolbar-menu'
import { EmptyHeaderTitle } from '@/components/tab-stack'
import { PressableFeedback } from '@/components/pressable-feedback'
import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { PropertyChip } from '@/components/property-chip'
import { SectionHeader } from '@/components/section-header'
import { TagChip } from '@/components/tag-chip'
import { confirmDelete, useDeleteEntity, useDuplicateEntity, usePatchEntity, type EntityPatch } from '@/lib/api/mutations'
import { useSheets } from '@/lib/use-sheets'
import type { Entity } from '@/lib/api/api'
import { entityPathQuery, entityQuery, groupQuery, maintenanceQuery, seedEntityFromList } from '@/lib/api/queries'
import { splitAttachments } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'
import { printLabel } from '@/lib/print-label'
import { useAddPhotos } from '@/lib/use-add-photos'
import { useLeaving } from '@/lib/use-leaving'
import { usePullToRefresh } from '@/lib/use-pull-to-refresh'
import { formatDate, formatPrice, parseDate } from '@/lib/format'

import { ItemAttachments } from './item-attachments'


export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme, rt } = useUnistyles()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const qc = useQueryClient()
  const { api, session } = useSession()
  const item = useQuery({
    ...entityQuery(api, id),
    placeholderData: () => seedEntityFromList(qc, id),
  })
  const path = useQuery(entityPathQuery(api, id))
  const currency = useQuery(groupQuery(api)).data?.currency
  const patch = usePatchEntity(id)
  const remove = useDeleteEntity()
  const duplicate = useDuplicateEntity()
  const sheets = useSheets()
  // Android tints header icons itself: white over a cover photo, text colour past it.
  const deleteIcon = useHeaderIcon('trash', 'delete')
  const deleteIconOverCover = useHeaderIcon('trash', 'delete', '#ffffff')
  const pull = usePullToRefresh(() => Promise.all([item.refetch(), path.refetch()]))
  const hasPhotos = splitAttachments(item.data?.attachments).photos.length > 0
  const { takePhotos, pickPhotos } = useAddPhotos(id, hasPhotos)
  const moveIcon = useHeaderIcon('tray.and.arrow.down', 'drive_file_move')
  const tagsIcon = useHeaderIcon('tag', 'sell')
  const leaving = useLeaving()

  if (!item.data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
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
  const { photos } = splitAttachments(e.attachments)

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


  const coverHeight = Math.round(width * 0.95) + rt.insets.top
  const refresh = (
    <RefreshControl
      {...pull}
      progressViewOffset={photos.length ? rt.insets.top + 56 : undefined}
      colors={[theme.colors.primary]}
      tintColor={theme.colors.textMuted}
      progressBackgroundColor={theme.colors.elevated}
    />
  )

  // The header only holds delete; every other action lives in the bottom toolbar.
  const toolbar = (overCover = false) => (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button {...(overCover ? deleteIconOverCover : deleteIcon)} onPress={onDelete}>
        Delete
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  )

  // Everyday actions up front; the rest in "more".
  const bottomToolbar = leaving ? null : (
    // One centred group, rather than buttons spread across the bar, plus "more".
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button {...moveIcon} onPress={move}>
        Move to
      </Stack.Toolbar.Button>
      {toolbarMenu({
        id: 'photos',
        label: 'Add photos',
        showTitle: true,
        icon: { ios: 'camera', android: 'photo_camera' },
        groups: [
          [
            { label: 'Take photo', icon: { ios: 'camera', android: 'photo_camera' }, onPress: takePhotos },
            { label: 'Choose from library', icon: { ios: 'photo.on.rectangle', android: 'photo_library' }, onPress: pickPhotos },
          ],
        ],
      })}
      <Stack.Toolbar.Button {...tagsIcon} onPress={editTags}>
        Edit tags
      </Stack.Toolbar.Button>
      {/* Less frequent actions, in their own pill next to the group. */}
      <Stack.Toolbar.Spacer width={12} />
      {toolbarMenu({
        id: 'more',
        label: 'More',
        icon: { ios: 'ellipsis', android: 'more_vert' },
        groups: [
          [
            { label: 'Duplicate', icon: { ios: 'plus.square.on.square', android: 'content_copy' }, onPress: onDuplicate },
            {
              label: 'Print label',
              icon: { ios: 'printer', android: 'print' },
              onPress: () => session && printLabel(session, 'item', e.id!),
            },
            {
              label: 'Record maintenance',
              icon: { ios: 'wrench.and.screwdriver', android: 'build' },
              onPress: () => router.push({ pathname: '/maintenance', params: { entityId: e.id! } }),
            },
          ],
          [
            {
              label: 'Rename',
              icon: { ios: 'pencil', android: 'edit' },
              onPress: () => editText('Name', e.name, (name) => ({ name }), 'text', true),
            },
            {
              label: e.insured ? 'Mark as not insured' : 'Mark as insured',
              icon: e.insured
                ? { ios: 'checkmark.shield.fill', android: 'remove_moderator' }
                : { ios: 'checkmark.shield', android: 'verified_user' },
              onPress: () => save({ insured: !e.insured }),
            },
          ],
          [
            {
              label: e.archived ? 'Unarchive' : 'Archive',
              icon: e.archived ? { ios: 'tray.and.arrow.up', android: 'unarchive' } : { ios: 'archivebox', android: 'archive' },
              onPress: () => save({ archived: !e.archived }),
            },
          ],
        ],
      })}
      <Stack.Toolbar.Spacer />
    </Stack.Toolbar>
  )

  const body = (
    <>
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
          label={formatPrice(e.purchasePrice, currency) ?? 'Price'}
          empty={!e.purchasePrice}
          accessibilityLabel={`Purchase price ${formatPrice(e.purchasePrice, currency) ?? 'not set'}. Change`}
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

      <ItemAttachments entity={e} />

      <Details entity={e} onEdit={editText} />

      <Maintenance entityId={e.id!} currency={currency} />

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
    </>
  )

  const paddingBottom = rt.insets.bottom + theme.spacing(8)

  if (photos.length) {
    return (
      <CoverScrollView
        cover={<PhotoPager entityId={e.id!} photos={photos} height={coverHeight} />}
        coverHeight={coverHeight}
        title={e.name ?? ''}
        refreshControl={refresh}
        contentPaddingBottom={paddingBottom}
        renderToolbar={(_menu, tint) => (
          <>
            {toolbar(tint === '#ffffff')}
            {bottomToolbar}
          </>
        )}>
        {body}
      </CoverScrollView>
    )
  }

  // The scroll view stays the first native view so iOS insets it for the bars.
  return (
    <>
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom }}
        refreshControl={refresh}>
        {/* The name is in the page; `title` only names this screen in the back menu. */}
        <Stack.Screen options={{ title: e.name ?? '', headerTitle: EmptyHeaderTitle }} />
        {toolbar()}
        {body}
      </ScrollView>
      {bottomToolbar}
    </>
  )
}

/** SF Symbols for menu rows on iOS; Android menus only take images, so none there. */

/** Maintenance log under the notes: newest first, scheduled entries marked as such. */
function Maintenance({ entityId, currency }: { entityId: string; currency?: string }) {
  const router = useRouter()
  const { api } = useSession()
  const log = useQuery(maintenanceQuery(api, entityId))
  // "Now" for telling done from scheduled; fixed per visit is precise enough.
  const [now] = useState(() => Date.now())

  const when = (m: { completedDate?: string; scheduledDate?: string }) =>
    parseDate(m.completedDate)?.getTime() ?? parseDate(m.scheduledDate)?.getTime() ?? 0
  const entries = [...(log.data ?? [])].sort((a, b) => when(b) - when(a))
  const record = () => router.push({ pathname: '/maintenance', params: { entityId } })

  return (
    <>
      <SectionHeader title="Maintenance" count={entries.length || undefined} />
      {entries.map((m, i) => {
        // Same rule as the server's status filter: done means a completion date
        // that isn't in the future; anything else is still scheduled.
        const completed = parseDate(m.completedDate)
        const done = completed && completed.getTime() <= now ? formatDate(m.completedDate) : null
        const scheduled = formatDate(m.scheduledDate) ?? formatDate(m.completedDate)
        const cost = m.cost && Number(m.cost) ? formatPrice(Number(m.cost), currency) : null
        const meta = [done ?? (scheduled ? `Scheduled · ${scheduled}` : 'Scheduled'), cost].filter(Boolean).join(' · ')
        return (
          <View key={m.id}>
            {i > 0 ? <RowSeparator /> : null}
            <View style={styles.maintenanceRow} accessible accessibilityLabel={[m.name, meta, m.description].filter(Boolean).join('. ')}>
              <Icon
                name={done ? { ios: 'checkmark.circle', android: 'check_circle' } : { ios: 'calendar', android: 'event' }}
                size={18}
                style={styles.rowIcon}
              />
              <View style={styles.maintenanceText}>
                <Text style={styles.maintenanceName}>{m.name}</Text>
                {meta ? <Text style={styles.maintenanceMeta}>{meta}</Text> : null}
                {m.description ? <Text style={styles.maintenanceNotes}>{m.description}</Text> : null}
              </View>
            </View>
          </View>
        )
      })}
      {log.isError ? <Text style={[styles.maintenanceMeta, styles.maintenanceError]}>Couldn’t load maintenance</Text> : null}
      <View style={styles.details}>
        <PressableFeedback style={styles.detailRow} onPress={record} accessibilityRole="button">
          <Text style={[styles.detailLabel, styles.addField]}>Record maintenance</Text>
        </PressableFeedback>
      </View>
    </>
  )
}

type EditText = (
  title: string,
  value: string | undefined,
  toPatch: (v: string) => EntityPatch,
  kind?: 'text' | 'multiline' | 'integer' | 'decimal',
) => void

function Details({ entity: e, onEdit }: { entity: Entity; onEdit: EditText }) {
  const router = useRouter()
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
  ]
  const visible = rows.filter(([, v]) => !!v)
  const fieldValue = (f: NonNullable<Entity['fields']>[number]) =>
    f.type === 'boolean' ? (f.booleanValue ? 'Yes' : 'No') : f.type === 'number' ? String(f.numberValue ?? '') : (f.textValue ?? '')
  const editField = (fieldId?: string) =>
    router.push({ pathname: '/edit-field', params: fieldId ? { entityId: e.id!, fieldId } : { entityId: e.id! } })

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
      {/* Custom fields: tap one to edit or delete it. */}
      <View style={styles.details}>
        {(e.fields ?? []).map((f) => {
          const value = fieldValue(f)
          return (
            <PressableFeedback
              key={f.id ?? f.name}
              style={styles.detailRow}
              onPress={() => editField(f.id)}
              accessibilityRole="button"
              accessibilityLabel={`${f.name}: ${value || 'empty'}. Edit`}>
              <Text style={styles.detailLabel}>{f.name}</Text>
              <Text style={[styles.detailValue, !value && styles.placeholder]} numberOfLines={2}>
                {value || 'Empty'}
              </Text>
            </PressableFeedback>
          )
        })}
        <PressableFeedback style={styles.detailRow} onPress={() => editField()} accessibilityRole="button">
          <Text style={[styles.detailLabel, styles.addField]}>Add field</Text>
        </PressableFeedback>
      </View>
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
  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
  maintenanceText: {
    flex: 1,
    gap: 2,
  },
  maintenanceName: {
    ...theme.type.body,
    color: theme.colors.text,
  },
  maintenanceMeta: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  maintenanceNotes: {
    ...theme.type.meta,
    color: theme.colors.text,
    marginTop: 2,
  },
  maintenanceError: {
    paddingHorizontal: theme.spacing(4),
  },
  addField: {
    width: undefined,
    color: theme.colors.primary,
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
}))
