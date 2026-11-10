import type { IconName } from './icon'

export interface ToolbarMenuItem {
  label: string
  icon: IconName
  onPress: () => void
  /** Shown in the danger colour (iOS: destructive style). */
  destructive?: boolean
}

export interface ToolbarMenuProps {
  /** React key (the menu is rendered as a direct toolbar child). */
  id: string
  /** Accessibility label of the trigger, and the menu title on iOS. */
  label: string
  icon: IconName
  /** Trigger icon colour override on Android (e.g. white over a cover photo). */
  tint?: string
  /** Shows `label` as the menu's title (iOS). */
  showTitle?: boolean
  /** Groups of actions, separated by dividers (iOS) or gaps (Android). */
  groups: ToolbarMenuItem[][]
}
