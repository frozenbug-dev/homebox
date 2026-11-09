import { Stack } from 'expo-router'

import { useFabActions } from './action-fab.shared'

/** Space to leave at the bottom of lists for the FAB (none on iOS). */
export const FAB_SPACE = 0

/**
 * iOS has no FABs (HIG): the same actions live in the navigation bar, a scan
 * button and a "+" menu. Render inside a screen to add them to its header.
 */
export function ActionFab() {
  const actions = useFabActions()
  const scan = actions.find((a) => a.key === 'scan')!
  const create = actions.filter((a) => a.key !== 'scan').reverse()

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button icon="qrcode.viewfinder" accessibilityLabel="Scan" onPress={scan.onPress} />
      <Stack.Toolbar.Menu icon="plus" accessibilityLabel="Add">
        {create.map((a) => (
          <Stack.Toolbar.MenuAction key={a.key} icon={a.icon.ios} onPress={a.onPress}>
            {a.label}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  )
}
