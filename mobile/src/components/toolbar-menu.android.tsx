import {
  Box,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPopup,
  Icon,
  IconButton,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose'
import { height } from '@expo/ui/jetpack-compose/modifiers'
import { Fragment, useState } from 'react'
import { useUnistyles } from 'react-native-unistyles'

import { useMaterialSymbols } from '@/lib/use-material-symbol'

import type { ToolbarMenuProps } from './toolbar-menu.types'

/** Gap between menu groups (Material 3 Expressive). */
const GROUP_GAP = 2

/**
 * Material 3 Expressive menu for `Stack.Toolbar` (Android): an icon button
 * that opens rounded groups of actions, each with a leading icon, separated by
 * small gaps. Android toolbars render their children as Compose, so this
 * draws Compose components directly.
 */
export function toolbarMenu(props: ToolbarMenuProps) {
  return <MaterialToolbarMenu key={props.id} {...props} />
}

function MaterialToolbarMenu({ label, icon, tint, groups }: ToolbarMenuProps) {
  const { theme } = useUnistyles()
  const [expanded, setExpanded] = useState(false)
  // Loaded once each and tinted per item.
  const sources = useMaterialSymbols([icon.android, ...groups.flat().map((i) => i.icon.android)], 24, '#ffffff')
  const trigger = sources[icon.android]

  return (
    <Box>
      <IconButton onClick={() => setExpanded(true)}>
        {trigger ? <Icon source={trigger} size={24} tint={tint ?? theme.colors.text} contentDescription={label} /> : null}
      </IconButton>
      <DropdownMenuPopup expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        {groups.map((items, g) => (
          <Fragment key={g}>
            {g > 0 ? <Spacer modifiers={[height(GROUP_GAP)]} /> : null}
            <DropdownMenuGroup shapes={{ index: g, count: groups.length }} containerColor={theme.colors.menu}>
              {items.map((item, i) => {
                const source = sources[item.icon.android]
                const color = item.destructive ? theme.colors.danger : theme.colors.text
                return (
                  <DropdownMenuItem
                    key={item.label}
                    shape={{ index: i, count: items.length }}
                    elementColors={{ textColor: color }}
                    onClick={() => {
                      setExpanded(false)
                      item.onPress()
                    }}>
                    {source ? (
                      <DropdownMenuItem.LeadingIcon>
                        <Icon source={source} size={24} tint={item.destructive ? color : theme.colors.textMuted} />
                      </DropdownMenuItem.LeadingIcon>
                    ) : null}
                    <DropdownMenuItem.Text>
                      <Text color={color}>{item.label}</Text>
                    </DropdownMenuItem.Text>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuPopup>
    </Box>
  )
}
