import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { type ComponentRef, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import {
  Camera,
  type CameraDevice,
  type CameraRef,
  type Constraint,
  type FlashMode,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera'
import { scheduleOnRN } from 'react-native-worklets'

import { ActionButton } from '@/components/action-button'
import { CAMERA_ACCENT, FocusIndicator, LensPicker, useBackCamera, useCameraControls } from '@/components/camera-controls'
import { Icon, type IconName } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { ZoomableImage } from '@/components/zoomable-image'
import { useSession } from '@/lib/auth/session'
import { getSheetRequest } from '@/lib/sheet-requests'
import { enqueueUploads } from '@/lib/uploads'

interface Shot {
  uri: string
  name: string
}

/** Photos and preview share this aspect ratio, so the preview shows exactly what gets captured. */
const PHOTO_ASPECT = 3 / 4

/**
 * Locking the stream to 60 fps caps auto-exposure at 1/60 s, so handheld
 * shots stay sharp instead of the camera stretching the shutter for light.
 */
const CONSTRAINTS_FPS = 60

const FLASH_MODES: { mode: FlashMode; label: string; icon: IconName }[] = [
  { mode: 'off', label: 'Flash off', icon: { ios: 'bolt.slash.fill', android: 'flash_off' } },
  { mode: 'auto', label: 'Flash auto', icon: { ios: 'bolt.badge.automatic.fill', android: 'flash_auto' } },
  { mode: 'on', label: 'Flash on', icon: { ios: 'bolt.fill', android: 'flash_on' } },
]

/** The sensor's largest photo size, as a portrait target (width < height). */
function fullResolution(device: CameraDevice | undefined) {
  const sizes = device?.getSupportedResolutions('photo') ?? []
  const largest = sizes.reduce<{ width: number; height: number } | undefined>(
    (best, s) => (!best || s.width * s.height > best.width * best.height ? s : best),
    undefined,
  )
  if (!largest) return { width: 3024, height: 4032 }
  return { width: Math.min(largest.width, largest.height), height: Math.max(largest.width, largest.height) }
}

/**
 * Take several photos of an item in a row, then upload them in the
 * background. Opened with `entityId` and `hasPhotos` (the first shot becomes
 * the cover when the item has none yet), or without an `entityId` through
 * `sheets.capturePhotos(...)`, which gets the photos back instead.
 */
export default function CaptureScreen() {
  const { entityId, hasPhotos } = useLocalSearchParams<{
    entityId: string
    hasPhotos?: string
  }>()
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session } = useSession()
  const reducedMotion = useReducedMotion()
  const isFocused = useIsFocused()
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useBackCamera()
  const photoResolution = useMemo(() => fullResolution(device), [device])
  const photoOutput = usePhotoOutput({
    targetResolution: photoResolution,
    containerFormat: 'jpeg',
    quality: 0.9,
    // 'speed' skips the multi-frame fusion that trades motion blur for light.
    qualityPrioritization: device?.supportsSpeedQualityPrioritization ? 'speed' : 'balanced',
  })
  // Full resolution comes first; 60 fps (the shutter cap) is kept where the sensor allows it.
  const constraints = useMemo<Constraint[]>(() => [{ resolutionBias: photoOutput }, { fps: CONSTRAINTS_FPS }], [photoOutput])
  const camera = useRef<CameraRef>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  // The shot showing in the preview; its thumbnail is hidden so closing lands in a gap.
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const thumbs = useRef(new Map<string, ComponentRef<typeof View>>())
  const measureThumb = (uri: string) =>
    new Promise<Rect | null>((resolve) => {
      const view = thumbs.current.get(uri)
      if (!view) return resolve(null)
      view.measureInWindow((x, y, width, height) => resolve(width ? { x, y, width, height, radius: THUMB_RADIUS } : null))
    })
  const [request] = useState(() => (entityId ? undefined : getSheetRequest('capture')))
  const [flash, setFlash] = useState(0)
  const flashMode = FLASH_MODES[flash]

  const controls = useCameraControls(device, camera)

  const capture = async () => {
    if (busy) return
    setBusy(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const file = await photoOutput.capturePhotoToFile(
        { flashMode: device?.hasFlash ? flashMode.mode : 'off', enableShutterSound: true },
        {},
      )
      const uri = file.filePath.startsWith('file://') ? file.filePath : `file://${file.filePath}`
      setShots((s) => [...s, { uri, name: `photo-${Date.now()}.jpg` }])
      if (__DEV__) Image.loadAsync(uri).then((img) => console.log('photo captured', `${img.width}×${img.height}`))
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      console.warn('capture failed', e)
    } finally {
      setBusy(false)
    }
  }

  const done = () => {
    if (request && shots.length) {
      request.onDone(shots)
    } else if (session && shots.length) {
      enqueueUploads(
        session,
        entityId,
        shots.map((s, i) => ({
          uri: s.uri,
          name: s.name,
          mimeType: 'image/jpeg',
          kind: 'photo',
          primary: !hasPhotos && i === 0,
        })),
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    router.back()
  }

  const layout = reducedMotion ? undefined : LinearTransition.duration(200)

  return (
    <View style={styles.root}>
      {!hasPermission ? (
        <View style={styles.centered}>
          <Text style={styles.message}>Homecrate needs the camera to photograph your items.</Text>
          <View style={styles.permission}>
            <ActionButton label="Allow camera" onPress={requestPermission} />
          </View>
        </View>
      ) : !device ? (
        <View style={styles.centered}>
          <Text style={styles.message}>No camera is available on this device.</Text>
        </View>
      ) : isFocused ? (
        <View style={styles.preview}>
          <GestureDetector gesture={controls.gesture}>
            <View style={StyleSheet.absoluteFill}>
              <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                outputs={[photoOutput]}
                constraints={constraints}
                zoom={controls.zoom}
                resizeMode="contain"
                isActive
                onError={(e) => console.warn('camera error', e)}
                onSessionConfigSelected={(c) =>
                  __DEV__ &&
                  console.log('camera session', {
                    fps: c.selectedFPS,
                    binned: c.isBinned,
                    device: device.type,
                  })
                }
              />
              <FocusIndicator controls={controls} />
            </View>
          </GestureDetector>
          <LensPicker controls={controls} style={styles.lenses} />
        </View>
      ) : null}

      <View style={styles.top}>
        <PressableFeedback
          onPress={() => router.back()}
          borderless
          style={styles.round}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={shots.length ? 'Discard photos and close' : 'Close camera'}>
          <Icon name={{ ios: 'xmark', android: 'close' }} size={22} color="#ffffff" />
        </PressableFeedback>
        {device?.hasFlash ? (
          <PressableFeedback
            onPress={() => {
              Haptics.selectionAsync()
              setFlash((f) => (f + 1) % FLASH_MODES.length)
            }}
            borderless
            style={[styles.round, styles.flash]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${flashMode.label}. Change flash`}>
            <Icon name={flashMode.icon} size={20} color={flashMode.mode === 'off' ? '#ffffff' : CAMERA_ACCENT} />
          </PressableFeedback>
        ) : null}
      </View>

      <View style={styles.bottom}>
        {shots.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {shots.map((s, i) => (
              <Animated.View
                key={s.uri}
                entering={reducedMotion ? undefined : FadeIn.duration(150)}
                exiting={reducedMotion ? undefined : FadeOut.duration(150)}
                layout={layout}>
                <PressableFeedback
                  onPress={() => setPreview(i)}
                  feedback="scale"
                  style={styles.shot}
                  accessibilityRole="button"
                  accessibilityLabel={`Photo ${i + 1}. Preview`}>
                  <View
                    ref={(v) => {
                      if (v) thumbs.current.set(s.uri, v)
                      else thumbs.current.delete(s.uri)
                    }}
                    collapsable={false}
                    style={preview != null && previewUri === s.uri ? styles.hidden : undefined}>
                    <Image source={{ uri: s.uri }} style={styles.shotImage} contentFit="cover" />
                  </View>
                </PressableFeedback>
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.hint}>Take as many photos as you like</Text>
        )}

        {/* Equal slots either side keep the shutter centred. */}
        <View style={styles.shutterRow}>
          <View style={styles.side} />
          <PressableFeedback
            onPress={capture}
            disabled={!device || !hasPermission || busy}
            feedback="scale"
            borderless
            style={styles.shutter}
            accessibilityRole="button"
            accessibilityLabel="Take photo">
            <View style={[styles.shutterInner, busy && { backgroundColor: theme.colors.textMuted }]} />
          </PressableFeedback>
          <View style={styles.side}>
            {shots.length ? (
              <Animated.View
                entering={reducedMotion ? undefined : ZoomIn.duration(180)}
                exiting={reducedMotion ? undefined : ZoomOut.duration(150)}>
                <PressableFeedback
                  onPress={done}
                  feedback="scale"
                  borderless
                  style={styles.done}
                  accessibilityRole="button"
                  accessibilityLabel={`Done, ${shots.length === 1 ? '1 photo' : `${shots.length} photos`}`}>
                  <Icon name={{ ios: 'checkmark', android: 'check' }} size={24} color={theme.colors.onPrimary} />
                </PressableFeedback>
                <View style={styles.count} pointerEvents="none">
                  <Text style={styles.countText}>{shots.length}</Text>
                </View>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </View>

      {preview != null && shots.length ? (
        <ShotPreview
          shots={shots}
          initialIndex={Math.min(preview, shots.length - 1)}
          onShow={setPreviewUri}
          measureThumb={measureThumb}
          onClose={() => setPreview(null)}
          onDelete={(uri) => {
            const rest = shots.filter((x) => x.uri !== uri)
            setShots(rest)
            if (!rest.length) setPreview(null)
          }}
        />
      ) : null}
    </View>
  )
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

const THUMB_RADIUS = 6

/** Drag this far, or flick down this fast, to close (same as the item photo viewer). */
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 900
const CLOSE = { duration: 380, dampingRatio: 0.9 }
const CLOSE_FADE = { duration: 260, easing: Easing.out(Easing.cubic) }
const SNAP_BACK = { damping: 20, stiffness: 220 }
const FADE = { duration: 200 }
const REMOVE = { duration: 220, easing: Easing.in(Easing.cubic) }

/** How much the photo shrinks as it's dragged down. */
function dragScale(dy: number, screenHeight: number) {
  'worklet'
  return interpolate(dy, [0, screenHeight * 0.5], [1, 0.65], Extrapolation.CLAMP)
}

/**
 * Full-screen review of the shots so far: swipe between them, pinch to zoom,
 * delete. Drag down to close: the photo shrinks with your finger and flies
 * back into its thumbnail, like the item photo viewer.
 */
function ShotPreview({
  shots,
  initialIndex,
  onShow,
  measureThumb,
  onClose,
  onDelete,
}: {
  shots: Shot[]
  initialIndex: number
  onShow: (uri: string) => void
  measureThumb: (uri: string) => Promise<Rect | null>
  onClose: () => void
  onDelete: (uri: string) => void
}) {
  const { width, height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const current = Math.min(index, shots.length - 1)
  const shot = shots[current]

  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const reveal = useSharedValue(1)
  const pagerVisible = useSharedValue(1)
  const flying = useSharedValue(0)
  const progress = useSharedValue(0)
  const from = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0, radius: 0 })
  const to = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0, radius: 0 })
  const canFlyBack = useSharedValue(false)
  const removing = useSharedValue(0)

  // Where the photo sits on screen (contained, like the pager shows it), and
  // the thumbnail it flies back into.
  const base = (() => {
    let w = width
    let h = width / PHOTO_ASPECT
    if (h > height) {
      h = height
      w = height * PHOTO_ASPECT
    }
    return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h, radius: 0 }
  })()

  useEffect(() => {
    if (!shot) return
    onShow(shot.uri)
    let cancelled = false
    canFlyBack.set(false)
    measureThumb(shot.uri).then((rect) => {
      // Off-screen (scrolled away in the strip): no slot to land in.
      if (cancelled || !rect || rect.x + rect.width < 0 || rect.x > width) return
      to.set(rect)
      canFlyBack.set(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.uri, width])

  const flyBack = () => {
    'worklet'
    const s = dragScale(dragY.get(), height)
    from.set({
      x: base.x + (base.width * (1 - s)) / 2 + dragX.get(),
      y: base.y + (base.height * (1 - s)) / 2 + dragY.get(),
      width: base.width * s,
      height: base.height * s,
      radius: 0,
    })
    progress.set(0)
    flying.set(1)
    pagerVisible.set(0)
    reveal.set(withTiming(0, CLOSE_FADE))
    progress.set(
      withSpring(1, CLOSE, (finished) => {
        if (finished) scheduleOnRN(onClose)
      }),
    )
  }

  /** No slot to land in: slide on down and fade. */
  const fadeOut = () => {
    'worklet'
    reveal.set(withTiming(0, FADE))
    pagerVisible.set(withTiming(0, FADE))
    dragY.set(withTiming(dragY.get() + height * 0.25, FADE, () => scheduleOnRN(onClose)))
  }

  const close = () => {
    'worklet'
    if (reducedMotion) scheduleOnRN(onClose)
    else if (canFlyBack.get()) flyBack()
    else fadeOut()
  }

  const dismiss = usePanGesture({
    enabled: !zoomed,
    // Only start on a downward drag, and let horizontal swipes page instead.
    activeOffsetY: 12,
    failOffsetX: [-16, 16],
    onUpdate: (e) => {
      'worklet'
      dragX.set(e.translationX)
      dragY.set(e.translationY > 0 ? e.translationY : e.translationY / 4)
    },
    onDeactivate: (e) => {
      'worklet'
      if (dragY.get() > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        close()
      } else {
        dragX.set(reducedMotion ? 0 : withSpring(0, SNAP_BACK))
        dragY.set(reducedMotion ? 0 : withSpring(0, SNAP_BACK))
      }
    },
  })

  const remove = () => {
    if (!shot) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    const uri = shot.uri
    const commit = () => {
      onDelete(uri)
      removing.set(0)
    }
    if (reducedMotion) return commit()
    removing.set(
      withTiming(1, REMOVE, (finished) => {
        if (finished) scheduleOnRN(commit)
      }),
    )
  }

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: reveal.get() * interpolate(dragY.get(), [0, height * 0.4], [1, 0], Extrapolation.CLAMP),
  }))
  const pagerStyle = useAnimatedStyle(() => ({
    opacity: pagerVisible.get(),
    transform: [{ translateX: dragX.get() }, { translateY: dragY.get() }, { scale: dragScale(dragY.get(), height) }],
  }))
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: reveal.get() * interpolate(Math.abs(dragY.get()), [0, 60], [1, 0], Extrapolation.CLAMP),
  }))
  const flightStyle = useAnimatedStyle(() => {
    const a = from.get()
    const b = to.get()
    const t = progress.get()
    const mix = (u: number, v: number) => u + (v - u) * t
    return {
      opacity: flying.get(),
      left: mix(a.x, b.x),
      top: mix(a.y, b.y),
      width: mix(a.width, b.width),
      height: mix(a.height, b.height),
      borderRadius: mix(a.radius, b.radius),
    }
  })

  return (
    <Animated.View style={StyleSheet.absoluteFill} entering={reducedMotion ? undefined : FadeIn.duration(150)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.review, backdropStyle]} />
      <GestureDetector gesture={dismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, pagerStyle]}>
          <FlatList
            data={shots}
            extraData={current}
            keyExtractor={(s) => s.uri}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index: i }) => (
              <PreviewPage removing={i === current ? removing : undefined}>
                <ZoomableImage
                  source={{ uri: item.uri }}
                  accessibilityLabel={`Photo ${i + 1} of ${shots.length}`}
                  onZoomChange={setZoomed}
                />
              </PreviewPage>
            )}
          />
        </Animated.View>
      </GestureDetector>

      {shot ? (
        <Animated.View style={[styles.flight, flightStyle]} pointerEvents="none">
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.top, chromeStyle]}>
        <PressableFeedback
          onPress={close}
          borderless
          style={styles.round}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to camera">
          <Icon name={{ ios: 'chevron.down', android: 'expand_more' }} size={22} color="#ffffff" />
        </PressableFeedback>
        <Text style={styles.previewCount} accessibilityLiveRegion="polite">
          {current + 1} of {shots.length}
        </Text>
        <PressableFeedback
          onPress={remove}
          borderless
          style={styles.round}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete photo ${current + 1}`}>
          <Icon name={{ ios: 'trash', android: 'delete' }} size={20} color="#ffffff" />
        </PressableFeedback>
      </Animated.View>
    </Animated.View>
  )
}

/** One page of the preview; the page being deleted shrinks and fades away. */
function PreviewPage({ removing, children }: { removing?: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const t = removing ? removing.get() : 0
    return { opacity: 1 - t, transform: [{ scale: 1 - 0.25 * t }] }
  })
  return <Animated.View style={style}>{children}</Animated.View>
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(5),
    padding: theme.spacing(8),
  },
  permission: {
    width: 220,
  },
  message: {
    ...theme.type.body,
    color: '#ffffff',
    textAlign: 'center',
  },
  preview: {
    position: 'absolute',
    top: rt.insets.top + 44,
    left: 0,
    right: 0,
    aspectRatio: PHOTO_ASPECT,
    overflow: 'hidden',
  },
  lenses: {
    position: 'absolute',
    bottom: theme.spacing(3),
  },
  top: {
    position: 'absolute',
    top: rt.insets.top + theme.spacing(2),
    left: theme.spacing(3),
    right: theme.spacing(3),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },
  flash: {
    marginLeft: theme.spacing(2),
  },
  review: {
    backgroundColor: '#000000',
  },
  flight: {
    position: 'absolute',
    overflow: 'hidden',
  },
  hidden: {
    opacity: 0,
  },
  previewCount: {
    ...theme.type.body,
    flex: 1,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(8),
  },
  side: {
    width: 56,
    alignItems: 'center',
  },
  done: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    overflow: 'hidden',
  },
  count: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  countText: {
    ...theme.type.meta,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#000000',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing(4),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
    paddingTop: theme.spacing(3),
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  strip: {
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  shot: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  shotImage: {
    width: 56,
    height: 56,
  },
  hint: {
    ...theme.type.meta,
    color: 'rgba(255, 255, 255, 0.8)',
    height: 56,
    textAlignVertical: 'center',
    lineHeight: 56,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
}))
