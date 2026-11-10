import { Host, Picker, Text } from '@expo/ui/swift-ui'
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import * as Haptics from 'expo-haptics'

import type { SegmentedControlProps } from './segmented-control.types'

/** Native segmented picker (iOS). */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <Host matchContents>
      <Picker
        selection={value}
        onSelectionChange={(next: T) => {
          Haptics.selectionAsync()
          onChange(next)
        }}
        modifiers={[pickerStyle('segmented')]}>
        {options.map((o) => (
          <Text key={o.value} modifiers={[tag(o.value)]}>
            {o.label}
          </Text>
        ))}
      </Picker>
    </Host>
  )
}
