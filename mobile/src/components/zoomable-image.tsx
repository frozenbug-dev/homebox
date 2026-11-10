import { useState } from 'react'
import { useWindowDimensions } from 'react-native'
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { Image, type ImageSource } from './image'

const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 2.5
/** Critically damped: settles quickly without bouncing past the target. */
const SPRING = { stiffness: 220, damping: 32, overshootClamping: true }

interface ZoomableImageProps {
  source: ImageSource
  placeholder?: ImageSource
  accessibilityLabel?: string
  /** Called when zoom starts/ends, so a pager can stop paging while zoomed. */
  onZoomChange?: (zoomed: boolean) => void
}

/** Full-screen photo with pinch-to-zoom, pan while zoomed and double-tap to zoom. */
export function ZoomableImage({ source, placeholder, accessibilityLabel, onZoomChange }: ZoomableImageProps) {
  const { width, height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [zoomed, setZoomed] = useState(false)

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)

  const report = (value: boolean) => {
    setZoomed(value)
    onZoomChange?.(value)
  }

  const animate = (value: number) => {
    'worklet'
    return reducedMotion ? value : withSpring(value, SPRING)
  }

  const reset = () => {
    'worklet'
    scale.value = animate(1)
    savedScale.value = 1
    x.value = animate(0)
    y.value = animate(0)
    savedX.value = 0
    savedY.value = 0
    scheduleOnRN(report, false)
  }

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet'
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale))
    },
    onDeactivate: () => {
      'worklet'
      if (scale.value <= 1.05) {
        reset()
      } else {
        savedScale.value = scale.value
        scheduleOnRN(report, true)
      }
    },
  })

  const pan = usePanGesture({
    enabled: zoomed,
    onUpdate: (e) => {
      'worklet'
      // Keep the image edges inside the screen.
      const maxX = (width * (scale.value - 1)) / 2
      const maxY = (height * (scale.value - 1)) / 2
      x.value = Math.min(maxX, Math.max(-maxX, savedX.value + e.translationX))
      y.value = Math.min(maxY, Math.max(-maxY, savedY.value + e.translationY))
    },
    onDeactivate: () => {
      'worklet'
      savedX.value = x.value
      savedY.value = y.value
    },
  })

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet'
      if (scale.value > 1) {
        reset()
      } else {
        scale.value = animate(DOUBLE_TAP_SCALE)
        savedScale.value = DOUBLE_TAP_SCALE
        scheduleOnRN(report, true)
      }
    },
  })

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap)

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <Image
          source={source}
          placeholder={placeholder}
          // Same fit as the photo, so a thumbnail placeholder doesn't show smaller
          // (and jump) when the open animation hands over to this view.
          placeholderContentFit="contain"
          style={{ width, height }}
          contentFit="contain"
          transition={150}
          accessibilityLabel={accessibilityLabel}
        />
      </Animated.View>
    </GestureDetector>
  )
}
