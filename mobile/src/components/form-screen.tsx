import type { ReactNode } from 'react'
import { Platform, View } from 'react-native'
import { KeyboardAwareScrollView, KeyboardGestureArea, KeyboardStickyView } from 'react-native-keyboard-controller'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

const FOOTER_HEIGHT = 84

interface FormScreenProps {
  children: ReactNode
  /** Primary action, kept above the keyboard. */
  footer?: ReactNode
}

/**
 * Scrollable form layout: the focused field stays above the keyboard, the
 * keyboard can be swiped away while scrolling (both platforms), and the
 * footer action rides on top of the keyboard.
 */
export function FormScreen({ children, footer }: FormScreenProps) {
  const { rt } = useUnistyles()
  const footerSpace = footer ? FOOTER_HEIGHT : 0

  const scroll = (
    <KeyboardAwareScrollView
      bottomOffset={footerSpace + 16}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content(footerSpace)}
      style={styles.scroll}>
      {children}
    </KeyboardAwareScrollView>
  )

  return (
    <View style={styles.root}>
      {Platform.OS === 'android' ? (
        <KeyboardGestureArea interpolator="ios" offset={footerSpace} style={styles.root}>
          {scroll}
        </KeyboardGestureArea>
      ) : (
        scroll
      )}
      {footer ? (
        <KeyboardStickyView offset={{ closed: 0, opened: rt.insets.bottom }} style={styles.footer}>
          {footer}
        </KeyboardStickyView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: (footerSpace: number) => ({
    gap: theme.spacing(5),
    padding: theme.spacing(5),
    paddingBottom: footerSpace + rt.insets.bottom + theme.spacing(5),
  }),
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(3),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
    backgroundColor: theme.colors.background,
  },
}))
