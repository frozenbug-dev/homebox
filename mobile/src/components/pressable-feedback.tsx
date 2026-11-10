import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PressableFeedbackProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  /**
   * iOS feedback: `highlight` dims (list rows), `scale` shrinks slightly (cards, buttons).
   * Android always uses the Material ripple.
   */
  feedback?: 'highlight' | 'scale'
  /** Icon buttons: ripple without bounds on Android. */
  borderless?: boolean
}

/** Platform touch feedback: Material ripple on Android, highlight or press-scale on iOS. */
export function PressableFeedback({
  style,
  feedback = 'highlight',
  borderless = false,
  onPressIn,
  onPressOut,
  ...props
}: PressableFeedbackProps) {
  const { theme } = useUnistyles()
  const reducedMotion = useReducedMotion()
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'ios') return {}
    if (feedback === 'scale') return { transform: [{ scale: 1 - pressed.value * 0.03 }] }
    return { opacity: 1 - pressed.value * 0.45 }
  })

  return (
    <AnimatedPressable
      {...props}
      android_ripple={{ color: theme.colors.ripple, borderless, foreground: true }}
      onPressIn={(e) => {
        pressed.value = reducedMotion ? 1 : withTiming(1, { duration: 80 })
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        pressed.value = reducedMotion
          ? 0
          : feedback === 'scale'
            ? withSpring(0, { damping: 15, stiffness: 300 })
            : withTiming(0, { duration: 200 })
        onPressOut?.(e)
      }}
      style={[style, animatedStyle]}
    />
  )
}
