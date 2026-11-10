import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { FlatList, Text, View, useWindowDimensions } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'

import { Icon, type IconName } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { ZoomableImage } from '@/components/zoomable-image'
import { confirmDelete, useDeleteAttachment, useUpdateAttachment } from '@/lib/api/mutations'
import { entityQuery } from '@/lib/api/queries'
import type { Attachment } from '@/lib/api/api'
import { attachmentSource, splitAttachments } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'
import { measureSlot, photoAspect, setHiddenSlot, type PhotoSource, type SlotRect } from '@/lib/photo-transition'

/** Drag this far, or flick down this fast, to close. */
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 900

const OPEN = { duration: 420, dampingRatio: 0.86 }
const CLOSE = { duration: 380, dampingRatio: 0.9 }
const CLOSE_FADE = { duration: 260, easing: Easing.out(Easing.cubic) }
const SNAP_BACK = { damping: 20, stiffness: 220 }
const FADE = { duration: 200 }

/** How much the photo shrinks as it's dragged down. */
function dragScale(dy: number, screenHeight: number) {
  'worklet'
  return interpolate(dy, [0, screenHeight * 0.5], [1, 0.65], Extrapolation.CLAMP)
}
const NO_RECT: SlotRect = { x: 0, y: 0, width: 0, height: 0, radius: 0 }

/**
 * Full-screen photo viewer for one item: swipe between photos, pinch to zoom,
 * drag down to close. Opening morphs the photo out of the thumbnail or cover
 * it was tapped in, and closing flies it back there.
 */
export default function PhotosScreen() {
  const { entityId, start, source } = useLocalSearchParams<{ entityId: string; start?: string; source?: PhotoSource }>()
  const router = useRouter()
  const { width, height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const { api, session } = useSession()
  const item = useQuery(entityQuery(api, entityId))
  const update = useUpdateAttachment(entityId)
  const remove = useDeleteAttachment(entityId)
  const { photos } = splitAttachments(item.data?.attachments)
  const initial = Math.max(0, photos.findIndex((p) => p.id === start))
  const [index, setIndex] = useState(initial)
  const [zoomed, setZoomed] = useState(false)

  const current = photos[Math.min(index, photos.length - 1)]

  // Drag down to dismiss: the photo follows the finger (both axes) and shrinks
  // while the black backdrop fades to reveal the screen underneath.
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)

  // Open / close morph. A plain copy of the photo ("flight") flies between its
  // slot on the screen behind and its full-screen spot. It stays mounted (and
  // drawn) the whole time the viewer is open, invisible until needed, so that
  // releasing a drag can hand over to it in the same frame, with no pause.
  const morph = !reducedMotion && !!source
  const [landed, setLanded] = useState(!morph)
  const [opening, setOpening] = useState<Attachment | null>(null)
  const from = useSharedValue(NO_RECT)
  const to = useSharedValue(NO_RECT)
  const progress = useSharedValue(0)
  const flying = useSharedValue(0)
  const pagerVisible = useSharedValue(morph ? 0 : 1)
  // Backdrop and controls; 0 while flying in from / back to the slot.
  const reveal = useSharedValue(morph ? 0 : 1)
  // Where the current photo sits full screen, and where it closes to. Measured
  // ahead of time: the screen behind can't scroll while the viewer is open.
  const base = useSharedValue(NO_RECT)
  const closeTo = useSharedValue(NO_RECT)
  const canFlyBack = useSharedValue(false)

  /** Where a photo sits full screen: fitted ("contain") to the window. */
  const fullRect = (photo: Attachment, fallbackAspect: number): SlotRect => {
    const aspect = photoAspect(photo.id!) ?? fallbackAspect
    const w = Math.min(width, height * aspect)
    const h = w / aspect
    return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h, radius: 0 }
  }

  // A freshly mounted image takes a few frames to draw, longer than the flight
  // itself. So on open the copy is first placed exactly over the photo it
  // replaces, and the swap + animation start once it has drawn (or soon after).
  const pendingLaunch = useRef<(() => void) | null>(null)
  const launchWhenDrawn = (go: () => void) => {
    pendingLaunch.current = go
    setTimeout(() => {
      if (pendingLaunch.current === go) onFlightDrawn()
    }, 180)
  }
  const onFlightDrawn = () => {
    const go = pendingLaunch.current
    pendingLaunch.current = null
    go?.()
  }

  const close = () => router.back()
  const finishClose = () => {
    setHiddenSlot(null)
    router.back()
  }
  const land = () => {
    setLanded(true)
    setOpening(null)
  }

  // Fly in once the photos are known.
  const ready = photos.length > 0
  useEffect(() => {
    if (!ready) return
    if (!morph || !source || !start) {
      reveal.value = withTiming(1, FADE)
      return
    }
    const photo = photos.find((p) => p.id === start)
    let cancelled = false
    measureSlot(source, start).then((slot) => {
      if (cancelled) return
      if (!slot || !photo) {
        reveal.value = withTiming(1, FADE)
        pagerVisible.value = 1
        setLanded(true)
        return
      }
      from.value = slot
      to.value = fullRect(photo, slot.width / slot.height)
      progress.value = 0
      launchWhenDrawn(() => {
        setHiddenSlot(source, start)
        flying.value = 1
        reveal.value = withTiming(1, FADE)
        progress.value = withSpring(1, OPEN, (finished) => {
          if (!finished) return
          // Hand over to the zoomable pager in the same frame.
          pagerVisible.value = 1
          flying.value = 0
          scheduleOnRN(land)
        })
      })
      setOpening(photo)
    })
    return () => {
      cancelled = true
    }
    // Runs once, when the photos first arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Once landed (and whenever the photo changes): hide that photo's slot so
  // closing lands in a gap, and work out the close flight's start and end.
  useEffect(() => {
    if (!landed || !current?.id) return
    let cancelled = false
    canFlyBack.value = false
    if (morph && source) setHiddenSlot(source, current.id)
    const measured = morph && source ? measureSlot(source, current.id) : Promise.resolve(null)
    measured.then((slot) => {
      if (cancelled) return
      base.value = fullRect(current, slot ? slot.width / slot.height : width / height)
      if (slot) {
        closeTo.value = slot
        canFlyBack.value = true
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed, current?.id, width, height])

  useEffect(() => () => setHiddenSlot(null), [])

  /** Flies the photo back into its slot from wherever the drag left it. Runs on the UI thread. */
  const flyBack = () => {
    'worklet'
    const b = base.value
    const s = dragScale(dragY.value, height)
    from.value = {
      x: b.x + (b.width * (1 - s)) / 2 + dragX.value,
      y: b.y + (b.height * (1 - s)) / 2 + dragY.value,
      width: b.width * s,
      height: b.height * s,
      radius: 0,
    }
    to.value = closeTo.value
    progress.value = 0
    flying.value = 1
    pagerVisible.value = 0
    reveal.value = withTiming(0, CLOSE_FADE)
    progress.value = withSpring(1, CLOSE, (finished) => {
      if (finished) scheduleOnRN(finishClose)
    })
  }

  /** No slot to land in (scrolled away, or not on screen): slide on down and fade. */
  const fadeOut = () => {
    'worklet'
    reveal.value = withTiming(0, FADE)
    dragY.value = withTiming(dragY.value + height * 0.25, FADE, () => scheduleOnRN(close))
  }

  const dismissNow = () => {
    'worklet'
    if (canFlyBack.value) flyBack()
    else fadeOut()
  }

  const dismiss = usePanGesture({
    enabled: !zoomed,
    // Only start on a downward drag, and let horizontal swipes page instead.
    activeOffsetY: 12,
    failOffsetX: [-16, 16],
    onUpdate: (e) => {
      'worklet'
      // Follows the finger sideways too; resists dragging up past the start.
      dragX.value = e.translationX
      dragY.value = e.translationY > 0 ? e.translationY : e.translationY / 4
    },
    onDeactivate: (e) => {
      'worklet'
      if (dragY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        if (reducedMotion) scheduleOnRN(close)
        else dismissNow()
      } else {
        dragX.value = reducedMotion ? 0 : withSpring(0, SNAP_BACK)
        dragY.value = reducedMotion ? 0 : withSpring(0, SNAP_BACK)
      }
    },
  })

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: reveal.value * interpolate(dragY.value, [0, height * 0.4], [1, 0], Extrapolation.CLAMP),
  }))
  const flightStyle = useAnimatedStyle(() => {
    const a = from.value
    const b = to.value
    const t = progress.value
    const mix = (u: number, v: number) => u + (v - u) * t
    return {
      opacity: flying.value,
      left: mix(a.x, b.x),
      top: mix(a.y, b.y),
      width: mix(a.width, b.width),
      height: mix(a.height, b.height),
      borderRadius: mix(a.radius, b.radius),
    }
  })
  const pagerStyle = useAnimatedStyle(() => ({
    opacity: pagerVisible.value,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: dragScale(dragY.value, height) },
    ],
  }))
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: reveal.value * interpolate(Math.abs(dragY.value), [0, 60], [1, 0], Extrapolation.CLAMP),
  }))

  const onDelete = async () => {
    if (!current?.id) return
    if (!(await confirmDelete('this photo'))) return
    await remove.mutateAsync(current.id)
    if (photos.length <= 1) router.back()
    else setIndex((i) => Math.max(0, Math.min(i, photos.length - 2)))
  }

  if (!session) return null

  // The photo being flown in, then (once landed) the one showing, kept ready to fly back.
  const flightPhoto = opening ?? (landed && morph ? current : null)

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={dismiss}>
        <Animated.View style={[styles.root, pagerStyle]}>
          <FlatList
            data={photos}
            keyExtractor={(p) => p.id!}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={initial}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item: p, index: i }) => (
              <ZoomableImage
                source={attachmentSource(session, entityId, p.id!)}
                placeholder={p.thumbnail?.id ? attachmentSource(session, entityId, p.thumbnail.id) : undefined}
                accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
                onZoomChange={setZoomed}
              />
            )}
          />
        </Animated.View>
      </GestureDetector>

      {flightPhoto ? (
        <Animated.View style={[styles.flight, flightStyle]} pointerEvents="none">
          <Image
            key={flightPhoto.id}
            source={attachmentSource(session, entityId, flightPhoto.id!)}
            placeholder={flightPhoto.thumbnail?.id ? attachmentSource(session, entityId, flightPhoto.thumbnail.id) : undefined}
            placeholderContentFit="cover"
            contentFit="cover"
            // Its size changes every frame; downscaling would reload it each time
            // and it would never get drawn.
            allowDownscaling={false}
            onDisplay={onFlightDrawn}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.top, chromeStyle]} pointerEvents="box-none">
        <RoundButton
          icon={{ ios: 'xmark', android: 'close' }}
          label="Close"
          onPress={() => (morph ? scheduleOnUI(dismissNow) : close())}
        />
        {photos.length > 1 ? (
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
        ) : null}
        <View style={styles.spacer} />
      </Animated.View>

      {current ? (
        <Animated.View style={[styles.bottom, chromeStyle]} pointerEvents="box-none">
          <PressableFeedback
            onPress={() => !current.primary && update.mutate({ attachmentId: current.id!, primary: true, title: current.title, type: current.type })}
            disabled={current.primary || update.isPending}
            feedback="scale"
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel={current.primary ? 'This is the cover photo' : 'Set as cover photo'}>
            <Icon
              name={current.primary ? { ios: 'star.fill', android: 'star' } : { ios: 'star', android: 'star_outline' }}
              size={18}
              color="#ffffff"
            />
            <Text style={styles.pillText}>{current.primary ? 'Cover photo' : 'Set as cover'}</Text>
          </PressableFeedback>
          <RoundButton icon={{ ios: 'trash', android: 'delete' }} label="Delete photo" onPress={onDelete} />
        </Animated.View>
      ) : null}
    </View>
  )
}

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableFeedback
      onPress={onPress}
      borderless
      style={styles.round}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon name={icon} size={22} color="#ffffff" />
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#000000',
  },
  flight: {
    position: 'absolute',
    overflow: 'hidden',
  },
  top: {
    position: 'absolute',
    top: rt.insets.top + theme.spacing(2),
    left: theme.spacing(3),
    right: theme.spacing(3),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    ...theme.type.meta,
    fontWeight: '600',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  spacer: {
    width: 44,
  },
  bottom: {
    position: 'absolute',
    left: theme.spacing(4),
    right: theme.spacing(4),
    bottom: rt.insets.bottom + theme.spacing(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    height: 44,
    paddingHorizontal: theme.spacing(4),
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
  },
  pillText: {
    ...theme.type.body,
    fontWeight: '500',
    color: '#ffffff',
  },
}))
