import { Stack } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'

export default function SignInLayout() {
  const { theme } = useUnistyles()

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Sign in' }} />
      <Stack.Screen name="credentials" options={{ title: '' }} />
    </Stack>
  )
}
