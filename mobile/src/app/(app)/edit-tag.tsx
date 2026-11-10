import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FormField } from '@/components/form-field'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SheetHeader } from '@/components/sheet-header'
import { useSaveTag } from '@/lib/api/mutations'
import { tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { TAG_COLORS } from '@/lib/tag-colors'

/** Create (no id) or edit a tag: name + colour. */
export default function EditTagSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const tags = useQuery(tagsQuery(api))
  const existing = id ? tags.data?.find((t) => t.id === id) : undefined
  const save = useSaveTag()

  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState<string>(existing?.color || TAG_COLORS[(tags.data?.length ?? 0) % TAG_COLORS.length].value)

  const submit = async () => {
    if (!name.trim()) return
    await save.mutateAsync({
      id,
      name: name.trim(),
      color,
      description: existing?.description,
      icon: existing?.icon,
      parentId: existing?.parentId,
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    gap: theme.spacing(6),
    padding: theme.spacing(4),
  },
  group: {
    gap: theme.spacing(2),
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
