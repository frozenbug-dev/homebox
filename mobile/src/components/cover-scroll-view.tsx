import { Stack, useFocusEffect } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import { useCallback, useState, type ReactElement, type ReactNode } from 'react'
import { Platform, View, useWindowDimensions, type RefreshControlProps } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'

import { useMoreMenuIcon } from './header-button'

/** Height of the native header bar below the status bar. */
const HEADER_BAR = Platform.OS === 'ios' ? 44 : 64
const SHEET_RADIUS = 20

/**
 * Full-bleed cover under a transparent header, for any scrollable (ScrollView
 * or list). Pulling down stretches the cover; scrolling up moves it at half
 * speed and dims it while the content slides over it as a rounded sheet, and
 * a solid header with the title fades in once it's gone.
 *
 * Wire `onScroll` to an Animated scrollable, render `renderCover(...)` at the
 * top of its content, wrap the rest in `sheetStyle`, and render `chrome` as a
 * sibling after the scrollable.
 */
export function useCover({ coverHeight, title }: { coverHeight: number; title: string }) {
  const { theme, rt } = useUnistyles()
  const { height: windowHeight } = useWindowDimensions()
  const offset = useSharedValue(0)
  const [overCover, setOverCover] = useState(true)

  const headerHeight = rt.insets.top + HEADER_BAR
  // The header turns solid over the last stretch before the cover is gone.
  const fadeEnd = coverHeight - headerHeight
  const fadeStart = fadeEnd - 72

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.value = e.contentOffset.y
    },
  })

  useAnimatedReaction(
    () => offset.value < fadeStart + 36,
    (now, before) => {
      if (now !== before) scheduleOnRN(setOverCover, now)
    },
  )

  const coverStyle = useAnimatedStyle(() => {
    const y = offset.value
    if (y < 0) {
      // Overscroll (iOS bounce): grow from the top edge.
      return { transform: [{ translateY: y / 2 }, { scale: 1 + -y / coverHeight }] }
    }
    return {
      opacity: interpolate(y, [0, coverHeight], [1, 0.4], Extrapolation.CLAMP),
      transform: [{ translateY: y * 0.5 }],
    }
  })

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [fadeStart, fadeEnd], [0, 1], Extrapolation.CLAMP),
  }))

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [fadeEnd - 16, fadeEnd + 16], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(offset.value, [fadeEnd - 16, fadeEnd + 16], [6, 0], Extrapolation.CLAMP) },
    ],
  }))

  // Light status bar only while this screen shows its cover; restore the
  // theme default when leaving (the StatusBar component wouldn't).
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(overCover ? 'light' : 'auto', true)
      return () => setStatusBarStyle('auto', true)
    }, [overCover]),
  )

  const renderCover = (cover: ReactNode) => (
    <Animated.View style={[{ height: coverHeight }, styles.cover, coverStyle]}>
      {cover}
      {/* Keeps the back button and menu readable on bright photos. */}
      <View style={[styles.scrim, { height: headerHeight + 48 }]} pointerEvents="none" />
    </Animated.View>
  )

  const chrome = (
    <>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerLargeTitle: false,
          headerTitle: '',
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: Platform.OS === 'ios' || !overCover ? theme.colors.text : '#ffffff',
        }}
      />
      <Animated.View style={[styles.header, { height: headerHeight }, headerStyle]} pointerEvents="none">
        <Animated.Text style={[styles.title, { top: rt.insets.top }, titleStyle]} numberOfLines={1}>
          {title}
        </Animated.Text>
      </Animated.View>
    </>
  )

  // Content at least this tall can always scroll the cover fully away, even
  // when there's little below it.
  const minContentHeight = windowHeight + coverHeight - headerHeight

  const tint = Platform.OS === 'ios' || !overCover ? theme.colors.text : '#ffffff'

  return { onScroll, renderCover, chrome, sheetStyle: styles.sheet, headerHeight, minContentHeight, tint }
}

interface CoverScrollViewProps {
  /** Full-bleed cover (e.g. a photo pager) rendered `coverHeight` tall. */
  cover: ReactNode
  coverHeight: number
  /** Shown in the header once the cover has scrolled away. */
  title: string
  children: ReactNode
  /**
   * Header toolbar. Receives ready-made props for the overflow menu's icon
   * (coloured for over / past the cover) to spread onto a direct
   * `<Stack.Toolbar.Menu>` child.
   */
  renderToolbar?: (menu: ReturnType<typeof useMoreMenuIcon>, tint: string) => ReactNode
  refreshControl?: ReactElement<RefreshControlProps>
  contentPaddingBottom?: number
}

/** ScrollView with a collapsing full-bleed cover (see `useCover`). */
export function CoverScrollView({
  cover,
  coverHeight,
  title,
  children,
  renderToolbar,
  refreshControl,
  contentPaddingBottom = 0,
}: CoverScrollViewProps) {
  const { onScroll, renderCover, chrome, sheetStyle, minContentHeight, tint } = useCover({ coverHeight, title })
  const menu = useMoreMenuIcon(tint)

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom, minHeight: minContentHeight }}>
        {renderCover(cover)}
        <View style={sheetStyle}>{children}</View>
      </Animated.ScrollView>
      {chrome}
      {/* Toolbars belong at the screen's top level (iOS ignores them inside a scroll view). */}
      {renderToolbar?.(menu, tint)}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  cover: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0))',
  },
  // The content slides over the cover as a sheet with rounded top corners.
  sheet: {
    marginTop: -SHEET_RADIUS,
    paddingTop: theme.spacing(1),
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    backgroundColor: theme.colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
  },
  title: {
    position: 'absolute',
    // iOS: the back button carries the previous screen's name (~120pt wide
    // with Liquid Glass), so keep a centred title clear of both sides.
    left: Platform.OS === 'ios' ? 128 : 72,
    right: Platform.OS === 'ios' ? 128 : 72,
    height: HEADER_BAR,
    textAlignVertical: 'center',
    lineHeight: HEADER_BAR,
    textAlign: Platform.OS === 'ios' ? 'center' : 'left',
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
}))
