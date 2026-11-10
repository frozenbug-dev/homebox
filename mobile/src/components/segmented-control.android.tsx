import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose'
import * as Haptics from 'expo-haptics'
import { useUnistyles } from 'react-native-unistyles'

import type { SegmentedControlProps } from './segmented-control.types'

/** Material 3 segmented buttons. */
export function SegmentedControl<T extends string>({ options, value, onChange, onDark }: SegmentedControlProps<T>) {
  const { theme } = useUnistyles()
  const content = onDark ? '#ffffff' : theme.colors.text

  return (
    <Host matchContents>
      <SingleChoiceSegmentedButtonRow>
        {options.map((o) => (
          <SegmentedButton
            key={o.value}
            selected={o.value === value}
            onClick={() => {
              if (o.value === value) return
              Haptics.selectionAsync()
              onChange(o.value)
            }}
            colors={{
              activeContainerColor: theme.colors.primary,
              activeContentColor: theme.colors.onPrimary,
              activeBorderColor: theme.colors.primary,
              inactiveContainerColor: 'transparent',
              inactiveContentColor: content,
              inactiveBorderColor: onDark ? 'rgba(255, 255, 255, 0.5)' : theme.colors.border,
            }}>
            <SegmentedButton.Label>
              <Text>{o.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  )
}
