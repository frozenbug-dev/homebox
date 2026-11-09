import { NativeTabs } from 'expo-router/native-tabs'
import { useUnistyles } from 'react-native-unistyles'

export default function AppTabsLayout() {
  const { theme } = useUnistyles()

  return (
    <NativeTabs
      backgroundColor={theme.colors.background}
      indicatorColor={theme.colors.surface}
      labelStyle={{ selected: { color: theme.colors.text } }}>
      <NativeTabs.Trigger name="(items)">
        <NativeTabs.Trigger.Label>Items</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shippingbox" md="inventory_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="camera" md="photo_camera" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
