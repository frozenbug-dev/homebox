import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { ActivityIndicator, Text, View, type TextInputInstance } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { FormField } from '@/components/form-field'
import { FormScreen } from '@/components/form-screen'
import { serverStatusQuery } from '@/lib/api/queries'
import { SignInCancelledError, signInWithOidc, signInWithPassword } from '@/lib/auth/api'
import { useSession } from '@/lib/auth/session'

function hostOf(serverUrl: string) {
  try {
    return new URL(serverUrl).host
  } catch {
    return serverUrl
  }
}

export default function CredentialsScreen() {
  const { server } = useLocalSearchParams<{ server: string }>()
  const { theme } = useUnistyles()
  const { signIn } = useSession()
  const status = useQuery(serverStatusQuery(server))
  const passwordRef = useRef<TextInputInstance>(null)
  const [error, setError] = useState<string>()
  const [oidcBusy, setOidcBusy] = useState(false)

  const fail = (e: unknown) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    setError(e instanceof Error ? e.message : 'Something went wrong.')
  }

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        await signIn(await signInWithPassword(server, value.email.trim(), value.password))
      } catch (e) {
        fail(e)
        passwordRef.current?.focus()
      }
    },
  })

  const startOidc = async () => {
    setError(undefined)
    setOidcBusy(true)
    try {
      await signIn(await signInWithOidc(server))
    } catch (e) {
      if (!(e instanceof SignInCancelledError)) fail(e)
    } finally {
      setOidcBusy(false)
    }
  }

  const title = <Stack.Screen options={{ title: hostOf(server) }} />

  if (!status.data) {
    return (
      <View style={styles.centered}>
        {title}
        {status.isError ? (
          <Text style={styles.error}>{status.error.message}</Text>
        ) : (
          <ActivityIndicator color={theme.colors.primary} />
        )}
      </View>
    )
  }

  const { oidc, build } = status.data
  const allowPassword = oidc.allowLocal
  const allowOidc = oidc.enabled
  const oidcLabel = oidc.buttonText || 'Sign in with SSO'

  const oidcButton = allowOidc ? (
    <ActionButton
      label={oidcLabel}
      busyLabel="Waiting for browser…"
      busy={oidcBusy}
      disabled={!oidc.appLogin}
      variant={allowPassword ? 'outlined' : 'filled'}
      onPress={startOidc}
    />
  ) : null

  return (
    <FormScreen
      footer={
        allowPassword ? (
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <ActionButton
                label="Sign in"
                busyLabel="Signing in…"
                busy={isSubmitting}
                disabled={oidcBusy}
                onPress={form.handleSubmit}
              />
            )}
          </form.Subscribe>
        ) : (
          oidcButton
        )
      }>
      {title}
      <Text style={styles.intro}>
        {build.version ? `Homebox ${build.version} · ` : ''}
        {allowPassword ? 'Sign in with your Homebox account.' : 'This server signs you in through your identity provider.'}
      </Text>

      {allowOidc && !oidc.appLogin ? (
        <Text style={styles.note}>
          {`This server needs an update before you can use “${oidcLabel}” from the app. Ask your server admin to update Homebox.`}
        </Text>
      ) : null}

      {allowPassword && allowOidc ? (
        <>
          {oidcButton}
          <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.rule} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.rule} />
          </View>
        </>
      ) : null}

      {allowPassword ? (
        <>
          <form.Field name="email">
            {(field) => (
              <FormField
                label="Email"
                placeholder="you@example.com"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <FormField
                ref={passwordRef}
                label="Password"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect={false}
                submitKeyType="go"
                onSubmit={form.handleSubmit}
              />
            )}
          </form.Field>
        </>
      ) : null}

      {!allowPassword && !allowOidc ? (
        <Text style={styles.note}>This server has no sign-in method enabled.</Text>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
    </FormScreen>
  )
}

const styles = StyleSheet.create((theme) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(6),
    backgroundColor: theme.colors.background,
  },
  intro: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textMuted,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
  },
  dividerText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  error: {
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.danger,
    textAlign: 'center',
  },
}))
