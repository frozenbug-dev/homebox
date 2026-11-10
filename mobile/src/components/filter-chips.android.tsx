import { FilterChip, Host, Icon, Row, Text } from '@expo/ui/jetpack-compose'
import { horizontalScroll, padding } from '@expo/ui/jetpack-compose/modifiers'
import * as Haptics from 'expo-haptics'
import { useUnistyles } from 'react-native-unistyles'

import { useMaterialSymbol } from '@/lib/use-material-symbol'

import type { FilterChipsProps } from './filter-chips.types'

/** A single-choice row of Material 3 filter chips (selected one shows a check). */
export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  const { theme } = useUnistyles()
  const check = useMaterialSymbol('check', 18, theme.colors.onPrimaryContainer)

  return (
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[horizontalScroll(), padding(16, 0, 16, 0)]}>
        {options.map((o) => {
          const selected = o.value === value
          return (
            <FilterChip
              key={o.value}
              selected={selected}
              onClick={() => {
                if (selected) return
                Haptics.selectionAsync()
                onChange(o.value)
              }}
              border={{ width: 1, color: selected ? 'transparent' : theme.colors.border }}
              colors={{
                containerColor: 'transparent',
                labelColor: theme.colors.text,
                selectedContainerColor: theme.colors.primaryContainer,
                selectedLabelColor: theme.colors.onPrimaryContainer,
              }}>
              {selected && check ? (
                <FilterChip.LeadingIcon>
                  <Icon source={check} size={18} />
                </FilterChip.LeadingIcon>
              ) : null}
              <FilterChip.Label>
                <Text>{o.label}</Text>
              </FilterChip.Label>
            </FilterChip>
          )
        })}
      </Row>
    </Host>
  )
}
