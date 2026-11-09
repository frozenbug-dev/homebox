import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { ActionButton } from '@/components/action-button'
import { FormField } from '@/components/form-field'
import { FormScreen } from '@/components/form-screen'
import { normalizeServerUrl } from '@/lib/api/client'
import { serverStatusQuery } from '@/lib/api/queries'
import { loadLastServer } from '@/lib/auth/storage'

export default function ServerScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>()

  const form = useForm({
    defaultValues: { server: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const serverUrl = normalizeServerUrl(value.server)
        // Always re-check: the server's sign-in options may have changed.
        await queryClient.fetchQuery({ ...serverStatusQuery(serverUrl), staleTime: 0 })
        router.push({ pathname: '/sign-in/credentials', params: { server: serverUrl } })
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    },
  })

  useEffect(() => {
    loadLastServer().then((last) => {
      if (last && !form.getFieldValue('server')) form.setFieldValue('server', last)
    })
  }, [form])

  return (
    <FormScreen
      footer={
        <form.Subscribe selector={(s) => [s.isSubmitting, !s.values.server.trim()] as const}>
          {([isSubmitting, isEmpty]) => (
            <ActionButton
              label="Continue"
              busyLabel="Connecting…"
              busy={isSubmitting}
              disabled={isEmpty}
              onPress={form.handleSubmit}
            />
          )}
        </form.Subscribe>
      }>
      <Text style={styles.intro}>
        Enter the address of your Homebox server — the same one you open in the browser.
      </Text>

      <form.Field name="server">
        {(field) => (
          <FormField
            label="Server address"
            placeholder="homebox.example.com"
            value={field.state.value}
            onChangeText={(text) => {
              setError(undefined)
              field.handleChange(text)
            }}
            onBlur={field.handleBlur}
            error={error}
            keyboardType="url"
            textContentType="URL"
            autoComplete="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            submitKeyType="go"
            onSubmit={form.handleSubmit}
          />
        )}
      </form.Field>
    </FormScreen>
  )
}

const styles = StyleSheet.create((theme) => ({
  intro: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textMuted,
  },
}))
