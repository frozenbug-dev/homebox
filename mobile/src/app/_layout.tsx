import { QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useUnistyles } from 'react-native-unistyles'

import { SessionProvider, useSession } from '@/lib/auth/session'
import { queryClient } from '@/lib/query-client'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { rt } = useUnistyles()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <ThemeProvider value={rt.themeName === 'dark' ? DarkTheme : DefaultTheme}>
            <SessionProvider>
              <RootNavigator />
            </SessionProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  const { isLoading, session } = useSession()

  // Keep the splash screen up until we know whether someone is signed in, so
  // the sign-in screen never flashes before the app.
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync()
  }, [isLoading])

  // Mounting the navigator before the session is known would mount the
  // sign-in stack first and swap to the tabs a moment later, which makes
  // NativeTabs preload its tabs against a navigator that's gone.
  if (isLoading) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}
