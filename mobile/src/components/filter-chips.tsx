import * as Haptics from 'expo-haptics'
import { ScrollView, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import type { FilterChipsProps } from './filter-chips.types'
import { PressableFeedback } from './pressable-feedback'

/** A single-choice row of filter pills (Android uses Material 3 filter chips). */
export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <PressableFeedback
            key={o.value}
            feedback="scale"
            onPress={() => {
              if (selected) return
              Haptics.selectionAsync()
              onChange(o.value)
            }}
            style={styles.chip(selected)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}>
            <Text style={styles.label(selected)}>{o.label}</Text>
          </PressableFeedback>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create((theme) => ({
  row: {
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  chip: (selected: boolean) => ({
    height: 32,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    borderWidth: selected ? 0 : 1,
    borderColor: theme.colors.border,
    backgroundColor: selected ? theme.colors.primaryContainer : 'transparent',
  }),
  label: (selected: boolean) => ({
    ...theme.type.meta,
    fontWeight: '500',
    color: selected ? theme.colors.onPrimaryContainer : theme.colors.text,
  }),
}))
