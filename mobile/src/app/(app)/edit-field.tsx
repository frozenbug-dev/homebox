import { Host, Switch } from '@expo/ui'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { StyleSheet } from 'react-native-unistyles'

import { FormField } from '@/components/form-field'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SegmentedControl } from '@/components/segmented-control'
import { SheetHeader } from '@/components/sheet-header'
import type { Schemas } from '@/lib/api/api'
import { confirmDelete, usePatchEntity } from '@/lib/api/mutations'
import { entityQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

type Field = Schemas['repo.EntityFieldData']
type Kind = 'text' | 'number' | 'boolean'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
]

/**
 * Add (no fieldId) or edit one custom field of an entity. Saving sends the
 * entity's whole field list, since the API replaces the set.
 */
export default function EditFieldSheet() {
  const { entityId, fieldId } = useLocalSearchParams<{ entityId: string; fieldId?: string }>()
  const router = useRouter()
  const { api } = useSession()
  const entity = useQuery(entityQuery(api, entityId))
  const patch = usePatchEntity(entityId)

  const fields = entity.data?.fields ?? []
  const existing = fieldId ? fields.find((f) => f.id === fieldId) : undefined
  // "time" fields (set on the web) keep their type; only their text is editable here.
  const lockedType = existing?.type && !KINDS.some((k) => k.value === existing.type) ? existing.type : null

  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<Kind>((lockedType ? 'text' : (existing?.type as Kind)) || 'text')
  const [text, setText] = useState(existing?.textValue ?? '')
  const [number, setNumber] = useState(existing?.type === 'number' ? String(existing.numberValue ?? '') : '')
  const [bool, setBool] = useState(!!existing?.booleanValue)

  const trimmedName = name.trim()
  const parsedNumber = Number(number.trim())
  const numberInvalid = kind === 'number' && number.trim() !== '' && !Number.isInteger(parsedNumber)
  const duplicateName = fields.some((f) => f.id !== existing?.id && f.name?.trim().toLowerCase() === trimmedName.toLowerCase())
  const canSave = !!trimmedName && !numberInvalid && !duplicateName && !patch.isPending

  const save = (next: Field[]) => patch.mutate({ fields: next }, { onSuccess: () => router.back() })

  const submit = () => {
    if (!canSave) return
    const field: Field = {
      ...existing,
      name: trimmedName,
      type: lockedType ?? kind,
      textValue: kind === 'text' ? text : '',
      numberValue: kind === 'number' && number.trim() ? parsedNumber : 0,
      booleanValue: kind === 'boolean' ? bool : false,
    }
    save(existing ? fields.map((f) => (f.id === existing.id ? field : f)) : [...fields, field])
  }

  const remove = async () => {
    if (!existing || !(await confirmDelete(`“${existing.name}”`))) return
    save(fields.filter((f) => f.id !== existing.id))
  }

  return (
    <View style={styles.root}>
      <SheetHeader
        title={existing ? 'Edit field' : 'New field'}
        left={{ label: 'Cancel', onPress: () => router.back() }}
        right={{ label: patch.isPending ? 'Saving…' : 'Save', primary: true, disabled: !canSave, onPress: submit }}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        <FormField
          label="Name"
          placeholder="e.g. Colour, Wattage"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          autoFocus={!existing}
          error={duplicateName ? 'This item already has a field with that name' : undefined}
        />
        {lockedType ? null : <SegmentedControl options={KINDS} value={kind} onChange={setKind} />}
        {kind === 'text' ? (
          <FormField label="Value" value={text} onChangeText={setText} submitKeyType="done" onSubmit={submit} />
        ) : kind === 'number' ? (
          <FormField
            label="Value"
            placeholder="0"
            value={number}
            onChangeText={setNumber}
            keyboardType="numbers-and-punctuation"
            error={numberInvalid ? 'Whole numbers only' : undefined}
            submitKeyType="done"
            onSubmit={submit}
          />
        ) : (
          <Host matchContents={{ vertical: true }} style={styles.switch}>
            <Switch label={trimmedName || 'Value'} value={bool} onValueChange={setBool} />
          </Host>
        )}
        {existing ? (
          <PressableFeedback onPress={remove} style={styles.delete} accessibilityRole="button" disabled={patch.isPending}>
            <Text style={styles.deleteText}>Delete field</Text>
          </PressableFeedback>
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
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.spacing(5),
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(10),
  },
  switch: {
    width: '100%',
  },
  delete: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.md,
  },
  deleteText: {
    ...theme.type.body,
    color: theme.colors.danger,
  },
}))
