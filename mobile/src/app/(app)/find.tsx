import { useFocusEffect, useNavigation, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputInstance } from 'react-native'
import { KeyboardController } from 'react-native-keyboard-controller'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'

import { AccountButton } from '@/components/account-button'
import { EmptyState } from '@/components/empty-state'
import { FilterChips } from '@/components/filter-chips'
import { Icon, icons, type IconName } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SearchResults, type SearchScope } from '@/components/search-results'
import { recentSearches, useRecentSearches } from '@/lib/recent-searches'
import { getSearchOrigin } from '@/lib/search-transition'
import { useDebounced } from '@/lib/use-debounced'

const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'items', label: 'Items' },
  { value: 'places', label: 'Places' },
  { value: 'tags', label: 'Tags' },
] as const satisfies readonly { value: SearchScope; label: string }[]

// Material 3 motion: emphasized decelerate in, emphasized accelerate out.
const OPEN = { duration: 400, easing: Easing.bezier(0.05, 0.7, 0.1, 1) }
const CLOSE = { duration: 250, easing: Easing.bezier(0.3, 0, 0.8, 0.15) }

const HEADER_HEIGHT = 72
const BAR_RADIUS = 28
/**
 * How far the search bar's icon and placeholder sit to the right of the
 * header's back arrow and input (bar: 16 margin + 16 padding; header: 4 + 48 + 4).
 */
const BAR_CONTENT_SHIFT = 16

/**
 * Material 3 search view (Android): opened from the search bar on the list
 * tabs, it covers the screen with the input on top, filter chips below it,
 * and recent searches until you type.
 *
 * It's a transparent route that animates itself: the bar's pill expands into
 * the full screen (the search icon turning into the back arrow, the
 * placeholder staying put), then the chips and results fade in. Closing runs
 * it backwards into the bar.
 */
export default function FindScreen() {
  const router = useRouter()
  // Only `theme`: reading `rt` would re-render the whole view on every inset
  // change, e.g. when the keyboard opens during the animation.
  const { theme } = useUnistyles()
  const [insetTop] = useState(() => UnistylesRuntime.insets.top)
  const { width, height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const input = useRef<TextInputInstance>(null)
  const [text, setText] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const recent = useRecentSearches()
  const q = useDebounced(text.trim(), 200)

  // Read once: where the bar was when it was tapped.
  const [origin] = useState(getSearchOrigin)
  const progress = useSharedValue(reducedMotion ? 1 : 0)
  const closing = useRef(false)

  // Start once the screen is actually on screen: mounting it can take longer
  // than the animation, which would then finish before the first frame.
  const navigation = useNavigation()
  useEffect(() => {
    if (reducedMotion) return
    let started = false
    const start = () => {
      if (started || closing.current) return
      started = true
      progress.set(withTiming(1, OPEN))
    }
    const unsubscribe = navigation.addListener('transitionEnd' as never, start)
    const fallback = setTimeout(start, 500)
    return () => {
      unsubscribe()
      clearTimeout(fallback)
    }
  }, [navigation, progress, reducedMotion])

  const leave = useCallback(() => router.back(), [router])
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    KeyboardController.dismiss()
    if (reducedMotion) {
      router.back()
      return
    }
    progress.set(
      // Leave even if interrupted, so the screen can never get stuck closed.
      withTiming(0, CLOSE, () => scheduleOnRN(leave)),
    )
  }, [leave, progress, reducedMotion, router])

  // System back runs the closing animation too (the keyboard takes the first press).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        close()
        return true
      })
      return () => sub.remove()
    }, [close]),
  )

  // Without a bar to grow out of (e.g. opened by a link), just fade.
  const start = origin ?? { x: 0, y: 0, width, height }
  const colors = { from: origin ? theme.colors.surface : theme.colors.background, to: theme.colors.background }
  // Header content starts lined up with the bar's icon and placeholder.
  const headerFromY = origin ? origin.y + origin.height / 2 - (insetTop + HEADER_HEIGHT / 2) : 0
  const headerFromX = origin ? BAR_CONTENT_SHIFT : 0

  // The container grows from the bar's rect to the window, clipping the
  // content, which stays put on screen (counter-translated) while revealed.
  const containerStyle = useAnimatedStyle(() => {
    const p = progress.value
    return {
      left: interpolate(p, [0, 1], [start.x, 0]),
      top: interpolate(p, [0, 1], [start.y, 0]),
      width: interpolate(p, [0, 1], [start.width, width]),
      height: interpolate(p, [0, 1], [start.height, height]),
      borderRadius: origin ? interpolate(p, [0, 1], [BAR_RADIUS, 0]) : 0,
      backgroundColor: interpolateColor(p, [0, 1], [colors.from, colors.to]),
      opacity: origin ? 1 : p,
    }
  })
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value
    return {
      transform: [
        { translateX: -interpolate(p, [0, 1], [start.x, 0]) },
        { translateY: -interpolate(p, [0, 1], [start.y, 0]) },
      ],
    }
  })
  const headerStyle = useAnimatedStyle(() => {
    const p = progress.value
    return {
      transform: [
        { translateX: interpolate(p, [0, 1], [headerFromX, 0]) },
        { translateY: interpolate(p, [0, 1], [headerFromY, 0]) },
      ],
    }
  })
  const backIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: `${interpolate(progress.value, [0.2, 0.6], [-90, 0], Extrapolation.CLAMP)}deg` }],
  }))
  const searchIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }))
  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
  }))
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const runRecent = (s: string) => {
    setText(s)
    recentSearches.add(s)
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[motion.container, containerStyle]}>
        <Animated.View style={[{ width, height }, contentStyle]}>
          {/* The bar's avatar, fading out where it was. */}
          {origin ? (
            <Animated.View
              style={[motion.avatar, { left: origin.x + origin.width - 12 - 32, top: origin.y + 12 }, avatarStyle]}
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants">
              <AccountButton />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.header, { marginTop: insetTop }, headerStyle]}>
            <View>
              <Animated.View style={[motion.searchIcon, searchIconStyle]} pointerEvents="none">
                <Icon name={icons.search} size={24} color={theme.colors.text} />
              </Animated.View>
              <Animated.View style={backIconStyle}>
                <IconButton icon={{ ios: 'chevron.left', android: 'arrow_back' }} label="Back" onPress={close} />
              </Animated.View>
            </View>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              autoFocus
              placeholder="Search items, places and tags"
              placeholderTextColor={theme.colors.textMuted}
              cursorColor={theme.colors.primary}
              selectionColor={theme.colors.primarySoft}
              selectionHandleColor={theme.colors.primary}
              returnKeyType="search"
              enterKeyHint="search"
              submitBehavior="blurAndSubmit"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => recentSearches.add(text)}
              style={styles.input}
              accessibilityLabel="Search"
            />
            {text ? (
              <IconButton
                icon={{ ios: 'xmark', android: 'close' }}
                label="Clear search"
                onPress={() => {
                  setText('')
                  input.current?.focus()
                }}
              />
            ) : null}
          </Animated.View>

          <Animated.View style={[motion.body, bodyStyle]}>
            <View style={styles.divider} />
            <View style={styles.chips}>
              <FilterChips options={SCOPES} value={scope} onChange={setScope} />
            </View>

            {q ? (
              <Animated.View
                key={scope}
                entering={reducedMotion ? undefined : FadeIn.duration(150)}
                style={styles.results}>
                <SearchResults
                  q={q}
                  scope={scope}
                  onScopeChange={setScope}
                  onOpen={() => {
                    // The result opens above this screen; don't carry the keyboard over.
                    KeyboardController.dismiss()
                    recentSearches.add(q)
                  }}
                />
              </Animated.View>
            ) : recent.length ? (
              <Animated.View
                entering={reducedMotion ? undefined : FadeIn.duration(150)}
                exiting={reducedMotion ? undefined : FadeOut.duration(100)}
                style={styles.results}>
                <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                  <View style={styles.recentHeader}>
                    <Text style={styles.recentTitle}>Recent searches</Text>
                    <PressableFeedback
                      onPress={recentSearches.clear}
                      style={styles.clearAll}
                      accessibilityRole="button"
                      accessibilityLabel="Clear recent searches">
                      <Text style={styles.clearAllText}>Clear</Text>
                    </PressableFeedback>
                  </View>
                  {recent.map((s) => (
                    <PressableFeedback
                      key={s}
                      onPress={() => runRecent(s)}
                      onLongPress={() => recentSearches.remove(s)}
                      style={styles.recentRow}
                      accessibilityRole="button"
                      accessibilityLabel={`Search for ${s}`}
                      accessibilityHint="Long-press to remove it from recent searches"
                      accessibilityActions={[{ name: 'delete', label: 'Remove from recent searches' }]}
                      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && recentSearches.remove(s)}>
                      <Icon name={{ ios: 'clock.arrow.circlepath', android: 'history' }} size={24} />
                      <Text style={styles.recentText} numberOfLines={1}>
                        {s}
                      </Text>
                      {/* Puts the search into the field to refine it, like the system search. */}
                      <IconButton
                        icon={{ ios: 'arrow.up.left', android: 'north_west' }}
                        label={`Edit “${s}”`}
                        onPress={() => {
                          setText(s)
                          input.current?.focus()
                        }}
                      />
                    </PressableFeedback>
                  ))}
                </ScrollView>
              </Animated.View>
            ) : (
              <EmptyState
                icon={icons.search}
                title="Search everything"
                message="Find items by name, serial or model number, notes or tags, and jump to places and tags."
              />
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { theme } = useUnistyles()
  return (
    <PressableFeedback
      onPress={onPress}
      borderless
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon name={icon} size={24} color={theme.colors.text} />
    </PressableFeedback>
  )
}

// Plain styles for the animated views, so Unistyles never rewrites the views
// whose layout Reanimated is driving.
const motion = {
  container: { position: 'absolute', overflow: 'hidden' },
  avatar: { position: 'absolute' },
  searchIcon: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
} as const

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: HEADER_HEIGHT,
    paddingHorizontal: theme.spacing(1),
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: theme.colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  chips: {
    paddingVertical: theme.spacing(2),
  },
  results: {
    flex: 1,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  recentTitle: {
    ...theme.type.label,
    color: theme.colors.textMuted,
  },
  clearAll: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  clearAllText: {
    ...theme.type.meta,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(4),
    minHeight: 56,
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(1),
  },
  recentText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
