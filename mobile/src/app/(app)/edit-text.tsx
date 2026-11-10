import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { SheetHeader } from '@/components/sheet-header'
import { useSheetRequest } from '@/lib/use-sheets'

/** One-field editor sheet (name, description, quantity, price, …). */
export default function EditTextSheet() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const request = useSheetRequest('text')
  const [value, setValue] = useState(request?.value ?? '')

  if (!request) return null

  const kind = request.kind ?? 'text'
  const trimmed = value.trim()
  const numeric = kind === 'integer' || kind === 'decimal'
  const parsed = numeric ? Number(trimmed.replace(',', '.')) : NaN
  const invalid =
    (request.required && !trimmed) ||
    (numeric && trimmed !== '' && (!Number.isFinite(parsed) || parsed < 0 || (kind === 'integer' && !Number.isInteger(parsed))))

  const save = () => {
    if (invalid) return
    if (value !== request.value) request.onSave(numeric ? (trimmed === '' ? '' : String(parsed)) : kind === 'multiline' ? value.trim() : trimmed)
    router.back()
  }

  return (
    <View style={styles.root}>
      <SheetHeader
        title={request.title}
        left={{ label: 'Cancel', onPress: () => router.back() }}
        right={{ label: 'Save', primary: true, disabled: invalid, onPress: save }}
      />
      <View style={styles.body}>
        <TextInput
          value={value}
          onChangeText={setValue}
          autoFocus
          selectTextOnFocus={numeric}
          placeholder={request.placeholder}
          placeholderTextColor={theme.colors.placeholder}
          cursorColor={theme.colors.primary}
          selectionColor={theme.colors.primary}
          multiline={kind === 'multiline'}
          keyboardType={kind === 'integer' ? 'number-pad' : kind === 'decimal' ? 'decimal-pad' : 'default'}
          inputMode={kind === 'integer' ? 'numeric' : kind === 'decimal' ? 'decimal' : 'text'}
          autoCapitalize={kind === 'multiline' ? 'sentences' : 'words'}
          returnKeyType={kind === 'multiline' ? 'default' : 'done'}
          submitBehavior={kind === 'multiline' ? 'newline' : 'blurAndSubmit'}
          onSubmitEditing={kind === 'multiline' ? undefined : save}
          style={styles.input(kind === 'multiline')}
          accessibilityLabel={request.title}
        />
        {invalid && trimmed ? <Text style={styles.error}>Enter a valid number.</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  body: {
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  input: (multiline: boolean) => ({
    minHeight: multiline ? 140 : 48,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 17,
    textAlignVertical: multiline ? 'top' : 'center',
  }),
  error: {
    ...theme.type.meta,
    color: theme.colors.danger,
  },
}))
