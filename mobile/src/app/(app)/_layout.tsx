import { Stack } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'

export default function AppLayout() {
  const { theme } = useUnistyles()

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="account"
        options={{
          title: 'Account',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  )
}
