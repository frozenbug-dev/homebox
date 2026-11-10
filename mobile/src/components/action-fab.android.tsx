import * as Haptics from 'expo-haptics'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { BackHandler, Pressable, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useFabActions } from './action-fab.shared'
import { Icon } from './icon'
import { PressableFeedback } from './pressable-feedback'

/** Space to leave at the bottom of lists so the FAB never covers the last row. */
export const FAB_SPACE = 88

// Material 3 Expressive "fast spatial" spring: stiffness 1400, damping ratio
// 0.9 (damping = 2 · 0.9 · √1400). Quick, with only a hint of settle.
const SPRING = { stiffness: 1400, damping: 67 }
/** Delay between menu items appearing, nearest the FAB first. */
const STAGGER = 15

/**
 * Material 3 (Expressive) FAB menu: the FAB opens a stack of labelled
 * actions (new item / place / tag, scan) over a scrim and turns into a close
 * button. Tap the scrim or press back to close.
 */
export function ActionFab() {
  const { theme } = useUnistyles()
  const reducedMotion = useReducedMotion()
  const actions = useFabActions()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  // Back closes the menu first; leaving the screen closes it too.
  useFocusEffect(
    useCallback(() => {
      if (!open) return
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        close()
        return true
      })
      return () => {
        sub.remove()
        close()
      }
    }, [open, close]),
  )

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: reducedMotion ? (open ? '45deg' : '0deg') : withSpring(open ? '45deg' : '0deg', SPRING) }],
  }))

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setOpen((o) => !o)
  }

  return (
    <>
      {open ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(150)}
          exiting={reducedMotion ? undefined : FadeOut.duration(150)}
          style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close menu" />
        </Animated.View>
      ) : null}

      <View style={styles.anchor} pointerEvents="box-none">
        {open ? (
          <View style={styles.menu} accessibilityRole="menu">
            {actions.map((a, i) => {
              // Nearest the FAB appears first.
              const order = actions.length - 1 - i
              return (
                <Animated.View
                  key={a.key}
                  entering={reducedMotion ? undefined : FadeInDown.springify().stiffness(SPRING.stiffness).damping(SPRING.damping).delay(order * STAGGER)}
                  exiting={reducedMotion ? undefined : FadeOutDown.duration(100)}>
                  <PressableFeedback
                    onPress={() => {
                      close()
                      a.onPress()
                    }}
                    feedback="scale"
                    style={styles.item}
                    accessibilityRole="menuitem"
                    accessibilityLabel={a.label}>
                    <Icon name={a.icon} size={22} color={theme.colors.onPrimaryContainer} />
                    <Text style={styles.itemText}>{a.label}</Text>
                  </PressableFeedback>
                </Animated.View>
              )
            })}
          </View>
        ) : null}

        <PressableFeedback
          onPress={toggle}
          feedback="scale"
          style={styles.fab(open)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close menu' : 'Add or scan'}
          accessibilityState={{ expanded: open }}>
          <Animated.View style={iconStyle}>
            <Icon name={{ ios: 'plus', android: 'add' }} size={28} color={theme.colors.onPrimary} />
          </Animated.View>
        </PressableFeedback>
      </View>
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.scrim,
  },
  anchor: {
    position: 'absolute',
    right: theme.spacing(4),
    bottom: theme.spacing(4),
    alignItems: 'flex-end',
    gap: theme.spacing(3),
  },
  menu: {
    alignItems: 'flex-end',
    gap: theme.spacing(2),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    height: 56,
    paddingLeft: theme.spacing(5),
    paddingRight: theme.spacing(6),
    borderRadius: 28,
    backgroundColor: theme.colors.primaryContainer,
    overflow: 'hidden',
    elevation: 3,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onPrimaryContainer,
  },
  fab: (open: boolean) => ({
    width: 56,
    height: 56,
    // The FAB rounds into a circle while open (M3 Expressive FAB menu).
    borderRadius: open ? 28 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    overflow: 'hidden',
    elevation: 6,
  }),
}))

