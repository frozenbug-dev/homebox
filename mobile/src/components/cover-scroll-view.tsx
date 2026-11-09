import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Platform, View, type RefreshControlProps } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'

/** Height of the native header bar below the status bar. */
const HEADER_BAR = Platform.OS === 'ios' ? 44 : 64
const SHEET_RADIUS = 20

interface CoverScrollViewProps {
  /** Full-bleed cover (e.g. a photo pager) rendered `coverHeight` tall. */
  cover: ReactNode
  coverHeight: number
  /** Shown in the header once the cover has scrolled away. */
  title: string
  children: ReactNode
  refreshControl?: ReactElement<RefreshControlProps>
  contentPaddingBottom?: number
}

/**
 * Scroll view with a full-bleed cover under a transparent header. Pulling
 * down stretches the cover; scrolling up moves it at half speed while the
 * content slides over it, and a solid header with the title fades in as it
 * leaves.
 */
export function CoverScrollView({
  cover,
  coverHeight,
  title,
  children,
  refreshControl,
  contentPaddingBottom = 0,
}: CoverScrollViewProps) {
  const { theme, rt } = useUnistyles()
  const ref = useAnimatedRef<Animated.ScrollView>()
  const offset = useScrollOffset(ref)
  const [overCover, setOverCover] = useState(true)

  const headerHeight = rt.insets.top + HEADER_BAR
  // The header turns solid over the last stretch before the cover is gone.
  const fadeEnd = coverHeight - headerHeight
  const fadeStart = fadeEnd - 72

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

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: overCover ? '#ffffff' : theme.colors.text,
        }}
      />
      <StatusBar style={overCover ? 'light' : 'auto'} animated />

      <Animated.ScrollView
        ref={ref}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom }}>
        <Animated.View style={[{ height: coverHeight }, styles.cover, coverStyle]}>
          {cover}
          {/* Keeps the back button and menu readable on bright photos. */}
          <View style={[styles.scrim, { height: headerHeight + 48 }]} pointerEvents="none" />
        </Animated.View>
        <View style={styles.sheet}>{children}</View>
      </Animated.ScrollView>

      <Animated.View style={[styles.header, { height: headerHeight }, headerStyle]} pointerEvents="none">
        <Animated.Text style={[styles.title, { top: rt.insets.top }, titleStyle]} numberOfLines={1}>
          {title}
        </Animated.Text>
      </Animated.View>
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
    left: 72,
    right: 72,
    height: HEADER_BAR,
    textAlignVertical: 'center',
    lineHeight: HEADER_BAR,
    textAlign: Platform.OS === 'ios' ? 'center' : 'left',
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
}))
