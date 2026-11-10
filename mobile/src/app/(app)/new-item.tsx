import { Host, Switch } from '@expo/ui'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Alert, ScrollView, Text, View, type TextInputInstance } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FormField } from '@/components/form-field'
import { Icon, icons } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { PropertyChip } from '@/components/property-chip'
import { SheetHeader } from '@/components/sheet-header'
import { unwrap } from '@/lib/api/api'
import { useCreateEntity } from '@/lib/api/mutations'
import { entityTypesQuery, tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { quickAddMemory } from '@/lib/quick-add-memory'
import { attachRemotePhoto, enqueueUploads } from '@/lib/uploads'
import { useSheets } from '@/lib/use-sheets'

interface PendingPhoto {
  uri: string
  name: string
  mimeType?: string
}

/**
 * Quick add for items and places. Opened with optional `parentId` / `tagId`
 * (from a place or tag page); otherwise it reuses the last place and tags.
 * Photos taken here upload once the item exists.
 */
export default function NewItemSheet() {
  const params = useLocalSearchParams<{
    kind?: 'item' | 'place'
    parentId?: string
    parentName?: string
    tagId?: string
    // Prefill from a scanned product barcode.
    name?: string
    description?: string
    manufacturer?: string
    modelNumber?: string
    imageUrl?: string
    barcode?: string
  }>()
  const isPlace = params.kind === 'place'
  const router = useRouter()
  const { api, session } = useSession()
  const sheets = useSheets()
  const { theme } = useUnistyles()
  const create = useCreateEntity()
  const types = useQuery(entityTypesQuery(api))
  const tags = useQuery(tagsQuery(api))
  const nameRef = useRef<TextInputInstance>(null)

  const [place, setPlace] = useState<{ id: string | null; name: string } | null>(() =>
    params.parentId
      ? { id: params.parentId, name: params.parentName ?? 'Place' }
      : isPlace
        ? null
        : quickAddMemory.place,
  )
  const [tagIds, setTagIds] = useState<string[]>(() =>
    params.tagId ? [params.tagId] : isPlace ? [] : quickAddMemory.tagIds,
  )
  const [addAnother, setAddAnother] = useState(false)
  const [added, setAdded] = useState(0)
  const [photos, setPhotos] = useState<PendingPhoto[]>([])

  // A barcode the product lookup didn't recognise still identifies the
  // item, so keep it in the notes rather than losing it.
  const barcodeNotes = params.barcode && !params.name ? `Barcode: ${params.barcode}` : ''

  const takePhotos = () =>
    sheets.capturePhotos({ onDone: (shots) => setPhotos((p) => [...p, ...shots.map((s) => ({ ...s, mimeType: 'image/jpeg' }))]) })


  const form = useForm({
    defaultValues: { name: params.name ?? '', quantity: '1', description: params.description ?? '', notes: barcodeNotes },
    onSubmit: async ({ value, formApi }) => {
      const quantity = Number(value.quantity.replace(',', '.'))
      const locationType = types.data?.find((t) => t.isLocation)
      const created = await create.mutateAsync({
        name: value.name.trim(),
        manufacturer: params.manufacturer || undefined,
        modelNumber: params.modelNumber || undefined,
        description: value.description.trim() || undefined,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        parentId: place?.id ?? undefined,
        tagIds: tagIds.length ? tagIds : undefined,
        entityTypeId: isPlace ? locationType?.id : undefined,
      })
      if (created.id && session) {
        // Your own first photo is the cover; otherwise the product photo is.
        if (photos.length) {
          enqueueUploads(
            session,
            created.id,
            photos.map((p, i) => ({ ...p, kind: 'photo', primary: i === 0 })),
          )
        }
        // Failures just mean no product photo.
        if (params.imageUrl) void attachRemotePhoto(session, created.id, params.imageUrl, !photos.length)
      }
      // Notes can't be set on create, so they follow in a patch.
      const notes = value.notes.trim()
      if (notes && created.id && api) {
        const id = created.id
        await unwrap(api.PATCH('/v1/entities/{id}', { params: { path: { id } }, body: { id, notes } })).catch(() =>
          Alert.alert(`${created.name ?? 'The item'} was added`, 'But its notes couldn’t be saved. Add them from the item page.'),
        )
      }
      if (!isPlace) {
        quickAddMemory.place = place?.id ? { id: place.id, name: place.name } : null
        quickAddMemory.tagIds = tagIds
      }
      if (addAnother) {
        setAdded((n) => n + 1)
        setPhotos([])
        formApi.reset()
        nameRef.current?.focus()
      } else {
        router.back()
      }
    },
  })

  const tagNames = tagIds.map((id) => tags.data?.find((t) => t.id === id)?.name).filter(Boolean)
  const what = isPlace ? 'place' : 'item'

  return (
    <View style={styles.root}>
      <form.Subscribe selector={(s) => [s.isSubmitting, !s.values.name.trim()] as const}>
        {([isSubmitting, empty]) => (
          <SheetHeader
            title={isPlace ? 'New place' : 'New item'}
            left={{ label: added ? 'Done' : 'Cancel', onPress: () => router.back() }}
            right={{
              label: isSubmitting ? 'Adding…' : 'Add',
              primary: true,
              disabled: isSubmitting || empty,
              onPress: form.handleSubmit,
            }}
          />
        )}
      </form.Subscribe>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}>
        <form.Field name="name" validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Give it a name') }}>
          {(field) => (
            <FormField
              ref={nameRef}
              label="Name"
              placeholder={isPlace ? 'Garage, Shelf 2, Blue box…' : 'Cordless drill'}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0] as string | undefined}
              autoCapitalize="words"
              autoFocus
            />
          )}
        </form.Field>

        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            <PressableFeedback
              onPress={takePhotos}
              feedback="scale"
              style={[styles.camera, styles.photo]}
              accessibilityRole="button"
              accessibilityLabel="Take more photos">
              <Icon name={{ ios: 'camera', android: 'photo_camera' }} size={22} color={theme.colors.textMuted} />
              <Text style={styles.cameraLabel}>Add</Text>
            </PressableFeedback>
            {photos.map((p, i) => (
              <PressableFeedback
                key={p.uri}
                onPress={() => {
                  Haptics.selectionAsync()
                  setPhotos((all) => all.filter((x) => x.uri !== p.uri))
                }}
                feedback="scale"
                style={styles.photo}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${i + 1}${i === 0 ? ', cover' : ''}. Remove`}>
                <Image source={{ uri: p.uri }} style={styles.photoImage} contentFit="cover" />
                <View style={styles.remove}>
                  <Icon name={{ ios: 'xmark', android: 'close' }} size={12} color="#ffffff" />
                </View>
              </PressableFeedback>
            ))}
          </ScrollView>
        ) : (
          <PressableFeedback
            onPress={takePhotos}
            feedback="scale"
            style={[styles.camera, styles.cameraWide]}
            accessibilityRole="button"
            accessibilityLabel="Take photos">
            <Icon name={{ ios: 'camera', android: 'photo_camera' }} size={26} color={theme.colors.textMuted} />
            <Text style={styles.cameraLabel}>Take photos</Text>
          </PressableFeedback>
        )}

        <View style={styles.chips}>
          <PropertyChip
            icon={icons.place}
            label={place?.name ?? (isPlace ? 'Top level' : 'No place')}
            empty={!place}
            accessibilityLabel={`${isPlace ? 'Inside' : 'Place'}: ${place?.name ?? 'none'}. Change`}
            onPress={() =>
              sheets.pickPlace({
                title: isPlace ? 'Inside' : 'Place',
                selectedId: place?.id ?? null,
                allowTopLevel: isPlace,
                onSelect: (p) => {
                  setPlace(p.id ? p : null)
                  Haptics.selectionAsync()
                },
              })
            }
          />
          {!isPlace ? (
            <PropertyChip
              icon={icons.tag}
              label={tagNames.length ? tagNames.join(', ') : 'Tags'}
              empty={!tagNames.length}
              onPress={() => sheets.pickTags({ selectedIds: tagIds, onChange: setTagIds })}
            />
          ) : null}
        </View>

        {!isPlace ? (
          <form.Field name="quantity">
            {(field) => (
              <FormField
                label="Quantity"
                value={field.state.value}
                onChangeText={field.handleChange}
                keyboardType="number-pad"
                inputMode="numeric"
                selectTextOnFocus
              />
            )}
          </form.Field>
        ) : null}

        <form.Field name="description">
          {(field) => (
            <FormField
              label="Description"
              placeholder="Optional"
              value={field.state.value}
              onChangeText={field.handleChange}
              multiline
              autoCapitalize="sentences"
              style={styles.multiline}
            />
          )}
        </form.Field>

        <form.Field name="notes">
          {(field) => (
            <FormField
              label="Notes"
              placeholder="Optional"
              value={field.state.value}
              onChangeText={field.handleChange}
              multiline
              autoCapitalize="sentences"
              style={styles.multiline}
              onSubmit={form.handleSubmit}
            />
          )}
        </form.Field>

        <Host matchContents={{ vertical: true }} style={styles.switch}>
          <Switch label={`Add another ${what} after this`} value={addAnother} onValueChange={setAddAnother} />
        </Host>
        {added ? (
          <Text style={styles.added} accessibilityLiveRegion="polite">
            {added} added
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    gap: theme.spacing(5),
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(10),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  photos: {
    gap: theme.spacing(2),
  },
  // Same dashed "add" tile as the photos on the item page.
  camera: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cameraWide: {
    gap: theme.spacing(1),
    height: 104,
    borderRadius: theme.radius.md,
  },
  cameraLabel: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: 72,
    height: 72,
  },
  remove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  switch: {
    width: '100%',
  },
  added: {
    ...theme.type.meta,
    color: theme.colors.success,
  },
}))
