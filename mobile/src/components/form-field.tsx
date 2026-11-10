import type { Ref } from 'react'
import { Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native'
import { KeyboardController } from 'react-native-keyboard-controller'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

interface FormFieldProps extends Omit<TextInputProps, 'returnKeyType' | 'submitBehavior' | 'onSubmitEditing'> {
  ref?: Ref<TextInputInstance>
  label: string
  error?: string
  /**
   * The last field submits the form from the return key; every other field
   * moves focus to the next one and keeps the keyboard open.
   */
  onSubmit?: () => void
  /** Return key label of the last field. */
  submitKeyType?: 'done' | 'go' | 'send' | 'search'
}

/** Labelled text field with form-wide return-key navigation built in. */
export function FormField({ ref, label, error, onSubmit, submitKeyType = 'done', style, ...props }: FormFieldProps) {
  const { theme } = useUnistyles()
  const isLast = !!onSubmit

  return (
    <View style={styles.container}>
      <Text style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${label}-label`}
        placeholderTextColor={theme.colors.placeholder}
        selectionColor={theme.colors.primary}
        cursorColor={theme.colors.primary}
        returnKeyType={isLast ? submitKeyType : 'next'}
        submitBehavior={isLast ? 'blurAndSubmit' : 'submit'}
        onSubmitEditing={isLast ? onSubmit : () => KeyboardController.setFocusTo('next')}
        style={[styles.input(!!error), style]}
        {...props}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing(1.5),
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  input: (invalid: boolean) => ({
    minHeight: 48,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: invalid ? theme.colors.danger : 'transparent',
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontSize: 17,
  }),
  error: {
    fontSize: 13,
    color: theme.colors.danger,
  },
}))
