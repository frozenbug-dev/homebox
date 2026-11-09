import { Stack } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'

/** Native form sheet starting at the smallest detent that shows the primary action. */
function sheet(detents: number[]) {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    headerShown: false,
  } as const
}

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
      <Stack.Screen name="new-item" options={sheet([0.75, 1])} />
      <Stack.Screen name="edit-tag" options={sheet([0.6, 1])} />
      <Stack.Screen name="edit-text" options={sheet([0.5, 1])} />
      <Stack.Screen name="pick-place" options={sheet([0.7, 1])} />
      <Stack.Screen name="pick-tags" options={sheet([0.7, 1])} />
    </Stack>
  )
}
