import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FormField } from '@/components/form-field'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SheetHeader } from '@/components/sheet-header'
import { useAddMaintenance } from '@/lib/api/mutations'
import { formatDate } from '@/lib/format'

/** Local calendar day as YYYY-MM-DD (what the API's date fields accept). */
function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Record maintenance done on an item: what, when, cost and notes. */
export default function MaintenanceSheet() {
  const { entityId } = useLocalSearchParams<{ entityId: string }>()
  const router = useRouter()
  const { theme } = useUnistyles()
  const add = useAddMaintenance(entityId)

  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date())
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  // Android shows the picker as a dialog, mounted only while open.
  const [picking, setPicking] = useState(false)

  const canSave = !!name.trim() && !add.isPending

  const submit = async () => {
    if (!canSave) return
    await add.mutateAsync({
      name: name.trim(),
      completedDate: isoDay(date),
      cost: cost.trim() || undefined,
      description: notes.trim() || undefined,
    })
    router.back()
  }

  return (
    <View style={styles.root}>
      <SheetHeader
        title="Record maintenance"
        left={{ label: 'Cancel', onPress: () => router.back() }}
        right={{ label: add.isPending ? 'Saving…' : 'Save', primary: true, disabled: !canSave, onPress: submit }}
      />
      {/* Same setup as the new-item sheet: a plain ScrollView gets scrolled up
          under the header when the autofocused field opens the keyboard. */}
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        <FormField
          label="What was done"
          placeholder="e.g. Replaced filter"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          autoFocus
        />
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              accentColor={theme.colors.primary}
              onValueChange={(_, d) => setDate(d)}
            />
          ) : (
            <PressableFeedback onPress={() => setPicking(true)} style={styles.dateButton} accessibilityRole="button">
              <Text style={styles.dateText}>{formatDate(isoDay(date))}</Text>
            </PressableFeedback>
          )}
          {Platform.OS !== 'ios' && picking ? (
            <DateTimePicker
              value={date}
              mode="date"
              presentation="dialog"
              maximumDate={new Date()}
              accentColor={theme.colors.primary}
              onValueChange={(_, d) => {
                setPicking(false)
                setDate(d)
              }}
              onDismiss={() => setPicking(false)}
            />
          ) : null}
        </View>
        <FormField label="Cost" placeholder="0.00" value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        <FormField label="Notes" value={notes} onChangeText={setNotes} multiline style={styles.notes} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  dateButton: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.inputBackground,
  },
  dateText: {
    fontSize: 17,
    color: theme.colors.text,
  },
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
}))
