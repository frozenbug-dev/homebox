import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FormField } from '@/components/form-field'
import { icons } from '@/components/icon'
import { PropertyChip } from '@/components/property-chip'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SheetHeader } from '@/components/sheet-header'
import { isNil } from '@/lib/api/api'
import { useSaveTag } from '@/lib/api/mutations'
import { tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { TAG_COLORS } from '@/lib/tag-colors'
import { useSheets } from '@/lib/use-sheets'

/**
 * Create (no id) or edit a tag: name, colour and parent tag. `parentId`
 * pre-selects the parent of a new tag (a sub-tag).
 */
export default function EditTagSheet() {
  const params = useLocalSearchParams<{ id?: string; parentId?: string }>()
  const id = params.id
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const sheets = useSheets()
  const tags = useQuery(tagsQuery(api))
  const existing = id ? tags.data?.find((t) => t.id === id) : undefined
  const save = useSaveTag()

  const [name, setName] = useState(existing?.name ?? '')
  const [parentId, setParentId] = useState<string | null>(() =>
    existing ? (isNil(existing.parentId) ? null : existing.parentId!) : (params.parentId ?? null),
  )
  const parent = parentId ? tags.data?.find((t) => t.id === parentId) : undefined
  // A new sub-tag starts in its parent's colour.
  const [color, setColor] = useState<string>(
    () =>
      existing?.color ||
      (params.parentId && tags.data?.find((t) => t.id === params.parentId)?.color) ||
      TAG_COLORS[(tags.data?.length ?? 0) % TAG_COLORS.length].value,
  )

  const pickParent = () =>
    sheets.pickTagParent({
      selectedId: parentId,
      excludeId: id,
      onSelect: (t) => setParentId(t.id),
    })

  const submit = async () => {
    if (!name.trim()) return
    await save.mutateAsync({
      id,
      name: name.trim(),
      color,
      description: existing?.description,
      icon: existing?.icon,
      parentId,
    })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    router.back()
  }

  return (
    <View style={styles.root}>
      <SheetHeader
        title={id ? 'Edit tag' : 'New tag'}
        left={{ label: 'Cancel', onPress: () => router.back() }}
        right={{ label: save.isPending ? 'Saving…' : 'Save', primary: true, disabled: !name.trim() || save.isPending, onPress: submit }}
      />
      {/* Same setup as the new-item sheet: a plain ScrollView gets scrolled up
          under the header when the autofocused field opens the keyboard (iOS). */}
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        <FormField
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus={!id}
          submitKeyType="done"
          onSubmit={submit}
        />
        <View style={styles.group}>
          <Text style={styles.label}>Parent tag</Text>
          <View style={styles.chipRow}>
            <PropertyChip
              icon={icons.tag}
              label={parent?.name ?? 'None (top level)'}
              empty={!parent}
              accessibilityLabel={`Parent tag: ${parent?.name ?? 'none'}. Change`}
              onPress={pickParent}
            />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Colour</Text>
          <View style={styles.swatches} accessibilityRole="radiogroup">
            {TAG_COLORS.map((c) => {
              const selected = c.value.toLowerCase() === color.toLowerCase()
              return (
                <PressableFeedback
                  key={c.value}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setColor(c.value)
                  }}
                  borderless
                  feedback="scale"
                  style={styles.swatch(selected)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={c.name}>
                  <View style={[styles.swatchFill, { backgroundColor: c.value }]} />
                </PressableFeedback>
              )
            })}
          </View>
        </View>
        <View style={styles.preview}>
          <View style={[styles.previewDot, { backgroundColor: color }]} />
          <Text style={styles.previewText}>{name.trim() || 'Tag name'}</Text>
        </View>
        {save.isError ? <Text style={{ color: theme.colors.danger }}>{save.error.message}</Text> : null}
      </KeyboardAwareScrollView>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.spacing(6),
    padding: theme.spacing(4),
  },
  group: {
    gap: theme.spacing(2),
  },
  chipRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  swatch: (selected: boolean) => ({
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 4,
    borderWidth: 2,
    borderColor: selected ? theme.colors.text : 'transparent',
  }),
  swatchFill: {
    flex: 1,
    borderRadius: 18,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewText: {
    ...theme.type.meta,
    fontWeight: '500',
    color: theme.colors.text,
  },
}))
