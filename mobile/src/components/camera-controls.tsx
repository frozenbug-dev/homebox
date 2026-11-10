import * as Haptics from 'expo-haptics'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { type StyleProp, Text, View, type ViewStyle } from 'react-native'
import { usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { type CameraDevice, type CameraRef, useCameraDevice } from 'react-native-vision-camera'
import { scheduleOnRN } from 'react-native-worklets'

import { PressableFeedback } from '@/components/pressable-feedback'

interface Lens {
  /** Zoom factor to pass to the camera controller. */
  zoom: number
  /** What the user sees, relative to the main (1×) lens. */
  label: string
}

/** Lens switches glide like the system camera rather than jumping. */
const ZOOM_TIMING = { duration: 320, easing: Easing.out(Easing.cubic) }

/** Pinching can go this far past the main lens (digital zoom). */
const MAX_ZOOM_MULTIPLE = 10

const FOCUS_SIZE = 76

/** Camera yellow, for the active lens and the focus box. */
export const CAMERA_ACCENT = '#ffd60a'

const formatZoom = (x: number) => `${x.toFixed(1).replace(/\.0$/, '').replace(/^0/, '')}×`

/**
 * The back camera with every lens it has. Asking for all of them picks the
 * virtual multi-camera device, which switches lenses as you zoom; it falls
 * back to the plain wide camera on single-lens phones.
 */
export function useBackCamera() {
  const back = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
  })
  const front = useCameraDevice('front')
  return back ?? front
}

/**
 * The lenses a (possibly virtual) camera can switch between. On a virtual
 * device zoom 1 is the widest lens, and `zoomLensSwitchFactors` are where
 * it hands over to the next physical camera.
 */
function lensesFor(device: CameraDevice | undefined): {
  lenses: Lens[]
  mainZoom: number
} {
  if (!device) return { lenses: [], mainZoom: 1 }
  const hasUltraWide = device.physicalDevices.some((d) => d.type === 'ultra-wide-angle')
  const switches = device.zoomLensSwitchFactors
  const mainZoom = hasUltraWide && switches.length ? switches[0] : device.minZoom
  const factors = [device.minZoom, ...switches].filter((z, i, all) => all.indexOf(z) === i)
  const lenses = factors.map((zoom) => ({ zoom, label: formatZoom(zoom / mainZoom) }))
  return { lenses: lenses.length > 1 ? lenses : [], mainZoom }
}

/**
 * Lens switching, eased pinch-to-zoom and tap-to-focus for a `<Camera>`.
 * Pass `zoom` to the camera, wrap it in a `GestureDetector` with `gesture`,
 * and render `<FocusIndicator>` over it and `<LensPicker>` somewhere near.
 */
export function useCameraControls(device: CameraDevice | undefined, camera: RefObject<CameraRef | null>) {
  const reducedMotion = useReducedMotion()
  const { lenses, mainZoom } = useMemo(() => lensesFor(device), [device])

  // Zoom lives on the UI thread and is bound straight to the camera
  // (via react-native-vision-camera-worklets), so it can be eased and
  // pinched without round-trips through React.
  const zoom = useSharedValue(mainZoom)
  const pinchStart = useSharedValue(mainZoom)
  const pinching = useSharedValue(false)
  // What the lens buttons show. A tap sets the target right away, so the
  // selection never flickers through the lenses the animation passes.
  const [zoomTarget, setZoomTarget] = useState(mainZoom)
  const minZoom = device?.minZoom ?? 1
  const maxZoom = Math.min(device?.maxZoom ?? 1, mainZoom * MAX_ZOOM_MULTIPLE)

  // Re-centre on the main lens if the device (and so its lenses) changes.
  const [lensBase, setLensBase] = useState(mainZoom)
  if (lensBase !== mainZoom) {
    setLensBase(mainZoom)
    setZoomTarget(mainZoom)
  }
  useEffect(() => zoom.set(mainZoom), [mainZoom, zoom])

  // While pinching, mirror the zoom into React in 0.1× steps for the label.
  useAnimatedReaction(
    () => (pinching.value ? Math.round((zoom.value / mainZoom) * 10) / 10 : null),
    (step, prev) => {
      if (step != null && step !== prev) scheduleOnRN(setZoomTarget, zoom.value)
    },
  )

  const selectLens = (lens: Lens) => {
    Haptics.selectionAsync()
    setZoomTarget(lens.zoom)
    zoom.set(reducedMotion ? lens.zoom : withTiming(lens.zoom, ZOOM_TIMING))
  }

  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet'
      cancelAnimation(zoom)
      pinchStart.set(zoom.get())
      pinching.set(true)
    },
    onUpdate: (e) => {
      'worklet'
      zoom.set(Math.min(maxZoom, Math.max(minZoom, pinchStart.get() * e.scale)))
    },
    onFinalize: () => {
      'worklet'
      pinching.set(false)
      scheduleOnRN(setZoomTarget, zoom.get())
    },
  })

  // Tap to focus, with a box that pops in where you tapped and fades away.
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const focusScale = useSharedValue(1)
  const focusOpacity = useSharedValue(0)
  const focusStyle = useAnimatedStyle(() => ({
    opacity: focusOpacity.value,
    transform: [{ scale: focusScale.value }],
  }))

  const focusAt = (x: number, y: number) => {
    Haptics.selectionAsync()
    setFocusPoint({ x, y })
    focusScale.set(
      reducedMotion
        ? 1
        : withSequence(withTiming(1.3, { duration: 0 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })),
    )
    focusOpacity.set(withSequence(withTiming(1, { duration: 0 }), withDelay(900, withTiming(0, { duration: 300 }))))
    // A newer tap cancels the previous focus; that's expected, not an error.
    camera.current?.focusTo({ x, y }).catch((e) => {
      if (!String(e).includes('canceled')) console.warn('focus failed', e)
    })
  }

  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet'
      scheduleOnRN(focusAt, e.x, e.y)
    },
  })

  const gesture = useSimultaneousGestures(pinch, tap)

  // The active lens is the longest one at or below the zoom target.
  const activeLens = lenses.reduce<Lens | undefined>((best, l) => (zoomTarget >= l.zoom - 0.01 ? l : best), lenses[0])

  return { zoom, gesture, lenses, activeLens, zoomTarget, mainZoom, selectLens, focusPoint, focusStyle }
}

type CameraControls = ReturnType<typeof useCameraControls>

/** The 0.5× / 1× / 3× pill. Renders nothing on single-lens cameras. */
export function LensPicker({ controls, style }: { controls: CameraControls; style?: StyleProp<ViewStyle> }) {
  const { lenses, activeLens, zoomTarget, mainZoom, selectLens } = controls
  if (!lenses.length) return null
  return (
    <View style={[styles.lenses, style]}>
      {lenses.map((lens) => {
        const active = lens === activeLens
        const label = active && Math.abs(zoomTarget - lens.zoom) > 0.05 ? formatZoom(zoomTarget / mainZoom) : lens.label
        return (
          <PressableFeedback
            key={lens.zoom}
            onPress={() => selectLens(lens)}
            feedback="scale"
            borderless
            style={[styles.lens, active && styles.lensActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${lens.label} lens`}>
            <Text style={[styles.lensText, active && styles.lensTextActive]}>{label}</Text>
          </PressableFeedback>
        )
      })}
    </View>
  )
}

/** The tap-to-focus box. Place it inside the view the gesture is attached to. */
export function FocusIndicator({ controls }: { controls: CameraControls }) {
  const { focusPoint, focusStyle } = controls
  if (!focusPoint) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.focus, { left: focusPoint.x - FOCUS_SIZE / 2, top: focusPoint.y - FOCUS_SIZE / 2 }, focusStyle]}
    />
  )
}

const styles = StyleSheet.create((theme) => ({
  focus: {
    position: 'absolute',
    width: FOCUS_SIZE,
    height: FOCUS_SIZE,
    borderWidth: 1.5,
    borderColor: CAMERA_ACCENT,
    borderRadius: 4,
  },
  lenses: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  lens: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: theme.spacing(1),
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lensActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  lensText: {
    ...theme.type.meta,
    fontWeight: '600',
    color: '#ffffff',
  },
  lensTextActive: {
    color: CAMERA_ACCENT,
  },
}))
