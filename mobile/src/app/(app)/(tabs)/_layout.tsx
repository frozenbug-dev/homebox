import { NativeTabs } from 'expo-router/native-tabs'
import { useUnistyles } from 'react-native-unistyles'

export default function TabsLayout() {
  const { theme } = useUnistyles()

  return (
    <NativeTabs
      backgroundColor={theme.colors.background}
      indicatorColor={theme.colors.primarySoft}
      iconColor={{ default: theme.colors.textMuted, selected: theme.colors.primary }}
      labelStyle={{ default: { color: theme.colors.textMuted }, selected: { color: theme.colors.text } }}>
      <NativeTabs.Trigger name="(items)">
        <NativeTabs.Trigger.Label>Items</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shippingbox" md="inventory_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(places)">
        <NativeTabs.Trigger.Label>Places</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.stack.3d.up" md="shelves" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(tags)">
        <NativeTabs.Trigger.Label>Tags</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="tag" md="sell" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
