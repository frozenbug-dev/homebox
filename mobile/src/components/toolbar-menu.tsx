import { Stack } from 'expo-router'

import type { ToolbarMenuProps } from './toolbar-menu.types'

/**
 * An overflow / action menu for `Stack.Toolbar`. Call it as a function, not
 * a component: iOS toolbars only keep their direct Menu / Button children.
 *
 * iOS: a native menu, groups as inline sections with dividers.
 * Android (`toolbar-menu.android.tsx`): a Material 3 Expressive grouped menu.
 */
export function toolbarMenu({ id, label, icon, showTitle, groups }: ToolbarMenuProps) {
  const actions = (items: ToolbarMenuProps['groups'][number]) =>
    items.map((item) => (
      <Stack.Toolbar.MenuAction key={item.label} icon={item.icon.ios} destructive={item.destructive} onPress={item.onPress}>
        {item.label}
      </Stack.Toolbar.MenuAction>
    ))

  return (
    <Stack.Toolbar.Menu key={id} icon={icon.ios} accessibilityLabel={label} title={showTitle ? label : undefined}>
      {groups.length === 1
        ? actions(groups[0])
        : groups.map((items, i) => (
            <Stack.Toolbar.Menu key={i} inline title="">
              {actions(items)}
            </Stack.Toolbar.Menu>
          ))}
    </Stack.Toolbar.Menu>
  )
}
