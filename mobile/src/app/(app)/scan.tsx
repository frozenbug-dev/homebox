import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useIsFocused, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'

import { ActionButton } from '@/components/action-button'
import { EntityThumb } from '@/components/entity-thumb'
import { Icon } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import type { EntitySummary } from '@/lib/api/api'
import { usePatchAnyEntity } from '@/lib/api/mutations'
import { useSession } from '@/lib/auth/session'
import { pluralize } from '@/lib/format'
import { parseScan, resolveScan, type ScanResult } from '@/lib/scan'
import { useCodeScanner } from '@/lib/use-code-scanner'
import { useSheets } from '@/lib/use-sheets'
import { scheduleOnRN } from 'react-native-worklets'

type Mode = 'find' | 'move'

const MODES: { value: Mode; label: string }[] = [
  { value: 'find', label: 'Find' },
  { value: 'move', label: 'Move' },
]
/** Mode switcher: width of one tab and the inset around them. */
const TAB_WIDTH = 88
const TAB_PADDING = 4
/** A horizontal swipe this long (or this fast) switches mode. */
const SWITCH_DISTANCE = 50
const SWITCH_VELOCITY = 500

/** Same code again within this window is the camera still seeing it, not a new scan. */
const REPEAT_MS = 2500

/**
 * Scanner. Find: point at a Homebox label (QR with the item/place link or
 * asset ID) to open it, or at a product barcode to look it up and add it.
 * Move: scan where things are going, then each thing to move there.
 */
export default function ScanScreen() {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const isFocused = useIsFocused()
  const { api } = useSession()
  const sheets = useSheets()
  const patch = usePatchAnyEntity()
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back') ?? undefined

  const [mode, setMode] = useState<Mode>('find')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [target, setTarget] = useState<EntitySummary | null>(null)
  const [moved, setMoved] = useState<{ entity: EntitySummary; ok: boolean }[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const last = useRef<{ value: string; at: number } | null>(null)
  const busyRef = useRef(false)
  // The native scanner may keep the first callback it was given, so read the
  // current mode and destination through a ref rather than the closure.
  const latest = useRef({ mode, target })
  useEffect(() => {
    latest.current = { mode, target }
  }, [mode, target])

  const handle = async (raw: string | undefined) => {
    if (!raw || !api || busyRef.current) return
    const now = Date.now()
    if (last.current && last.current.value === raw && now - last.current.at < REPEAT_MS) return
    last.current = { value: raw, at: now }

    busyRef.current = true
    setBusy(true)
    setNotice(null)
    try {
      const { mode, target } = latest.current
      const resolved = await resolveScan(api, parseScan(raw))
      if (mode === 'find') {
        setResult(resolved)
        Haptics.notificationAsync(
          resolved.kind === 'not-found'
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success,
        )
        return
      }

      // Move mode.
      if (resolved.kind !== 'entity') {
        setNotice(resolved.kind === 'product' ? 'That’s a product barcode, not a Homebox label.' : resolved.message)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        return
      }
      const entity = resolved.entity
      if (!target) {
        setTarget(entity)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        return
      }
      if (entity.id === target.id) return
      if (entity.parent?.id === target.id) {
        setNotice(`${entity.name} is already in ${target.name}.`)
        Haptics.selectionAsync()
        return
      }
      try {
        await patch.mutateAsync({ id: entity.id!, patch: { parentId: target.id } })
        setMoved((m) => [{ entity, ok: true }, ...m])
      } catch {
        setMoved((m) => [{ entity, ok: false }, ...m])
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Couldn’t look that up.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const scanner = useCodeScanner((values) => {
    void handle(values[0])
  })

  const typeCode = () =>
    sheets.editText({
      title: 'Enter a code',
      value: '',
      placeholder: 'Asset ID (000-123), barcode or label link',
      onSave: (v) => {
        last.current = null
        void handle(v)
      },
    })

  const switchMode = (next: Mode) => {
    if (next === mode) return
    Haptics.selectionAsync()
    setMode(next)
    setResult(null)
    setNotice(null)
    last.current = null
  }

  const openEntity = (e: EntitySummary) => {
    router.back()
    router.push({
      pathname: e.entityType?.isLocation ? '/place/[id]' : '/item/[id]',
      params: { id: e.id!, name: e.name },
    })
  }

  const addProduct = (r: Extract<ScanResult, { kind: 'product' }>) => {
    const p = r.product
    router.back()
    router.push({
      pathname: '/new-item',
      params: {
        name: p?.item?.name || '',
        description: p?.item?.description || '',
        manufacturer: p?.manufacturer || p?.item?.manufacturer || '',
        modelNumber: p?.modelNumber || p?.item?.modelNumber || '',
        imageUrl: p?.imageURL || '',
        barcode: r.code,
      },
    })
  }

  const hint =
    mode === 'find'
      ? 'Point at a Homebox label or a product barcode'
      : target
        ? `Scan things to move into ${target.name}`
        : 'First scan where things are going'

  const layout = reducedMotion ? undefined : LinearTransition.duration(200)
  const enter = reducedMotion ? undefined : FadeInDown.duration(200)

  // Swipe sideways anywhere to switch mode, like the Camera app.
  const modeIndex = MODES.findIndex((m) => m.value === mode)
  const swipe = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-20, 20],
    onDeactivate: (e) => {
      'worklet'
      const next =
        e.translationX < -SWITCH_DISTANCE || e.velocityX < -SWITCH_VELOCITY
          ? modeIndex + 1
          : e.translationX > SWITCH_DISTANCE || e.velocityX > SWITCH_VELOCITY
            ? modeIndex - 1
            : modeIndex
      if (next !== modeIndex && next >= 0 && next < MODES.length) scheduleOnRN(switchMode, MODES[next].value)
    },
  })

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.root}>
        {hasPermission && device && isFocused ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            outputs={[scanner]}
            isActive
            enableNativeZoomGesture
          />
        ) : null}

        <View style={styles.frameArea} pointerEvents="none">
          {hasPermission && device ? <Viewfinder /> : null}
          {!hasPermission ? (
            <Text style={styles.permissionText}>
              Allow the camera to scan labels and barcodes, or type a code below.
            </Text>
          ) : !device ? (
            <Text style={styles.permissionText}>No camera found. Type a code below.</Text>
          ) : (
            <Text style={styles.hint}>{hint}</Text>
          )}
        </View>

        <View style={styles.top}>
          <PressableFeedback
            onPress={() => router.back()}
            borderless
            style={styles.round}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close scanner">
            <Icon name={{ ios: 'xmark', android: 'close' }} size={22} color="#ffffff" />
          </PressableFeedback>
        </View>

        <Animated.View style={styles.bottom} layout={layout}>
          <ModeTabs mode={mode} onChange={switchMode} />
          <Animated.View style={styles.panel} layout={layout}>
            {/* Always dark, like the Camera app: a light material over the camera feed
              turns a washed-out grey. Text in the panel is light to match. */}
            {Platform.OS === 'ios' ? (
              <BlurView style={StyleSheet.absoluteFill} intensity={90} tint="systemChromeMaterialDark" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.panelSolid]} />
            )}
            {!hasPermission ? <ActionButton label="Allow camera" onPress={requestPermission} /> : null}

            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={ON_DARK.muted} />
                <Text style={styles.muted}>Looking it up…</Text>
              </View>
            ) : null}

            {notice ? (
              <Animated.Text entering={enter} style={styles.notice} accessibilityLiveRegion="polite">
                {notice}
              </Animated.Text>
            ) : null}

            {/* Same shape as Move's intro, so switching modes doesn't resize the panel. */}
            {mode === 'find' && !result && !busy ? (
              <View style={styles.result}>
                <Text style={styles.name}>Find things</Text>
                <Text style={styles.muted}>Scan a label to open it, or a barcode to look it up.</Text>
              </View>
            ) : null}

            {mode === 'find' && result && !busy ? (
              <Animated.View entering={enter} key={JSON.stringify(result).slice(0, 80)}>
                <FindResult result={result} onOpen={openEntity} onAdd={addProduct} />
              </Animated.View>
            ) : null}

            {mode === 'move' ? (
              <MovePanel
                target={target}
                moved={moved}
                onChangeTarget={() => {
                  setTarget(null)
                  setMoved([])
                  last.current = null
                }}
              />
            ) : null}

            <View style={styles.actions}>
              <View style={styles.flex}>
                <ActionButton label="Type a code" variant="outlined" onPress={typeCode} />
              </View>
              {mode === 'move' && moved.length ? (
                <View style={styles.flex}>
                  <ActionButton label="Done" onPress={() => router.back()} />
                </View>
              ) : null}
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

/**
 * Floating Find / Move switcher above the panel, with a highlight that slides
 * to the selected mode. Tap a mode, or swipe sideways anywhere on the screen.
 */
function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const reducedMotion = useReducedMotion()
  const index = MODES.findIndex((m) => m.value === mode)
  const x = useSharedValue(index * TAB_WIDTH)

  useEffect(() => {
    x.value = reducedMotion ? index * TAB_WIDTH : withTiming(index * TAB_WIDTH, { duration: 180, easing: Easing.out(Easing.cubic) })
  }, [index, x, reducedMotion])

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {Platform.OS === 'ios' ? (
        <BlurView style={StyleSheet.absoluteFill} intensity={80} tint="systemChromeMaterialDark" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.panelSolid]} />
      )}
      <Animated.View style={[styles.tabIndicator, indicatorStyle]} />
      {MODES.map((m) => {
        const selected = m.value === mode
        return (
          <PressableFeedback
            key={m.value}
            onPress={() => onChange(m.value)}
            style={styles.tab}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${m.label} mode`}>
            <Text style={styles.tabLabel(selected)}>{m.label}</Text>
          </PressableFeedback>
        )
      })}
    </View>
  )
}

function Viewfinder() {
  return (
    <View style={styles.viewfinder}>
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </View>
  )
}

function EntityLine({ entity, subtitle }: { entity: EntitySummary; subtitle?: string }) {
  return (
    <View style={styles.entity}>
      <EntityThumb entity={entity} size={44} />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {entity.name}
        </Text>
        {subtitle ? (
          <Text style={styles.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function FindResult({
  result,
  onOpen,
  onAdd,
}: {
  result: ScanResult
  onOpen: (e: EntitySummary) => void
  onAdd: (r: Extract<ScanResult, { kind: 'product' }>) => void
}) {
  if (result.kind === 'entity') {
    const e = result.entity
    const where = e.entityType?.isLocation ? 'Place' : e.parent?.name ? `In ${e.parent.name}` : undefined
    return (
      <View style={styles.result}>
        <EntityLine entity={e} subtitle={where} />
        <ActionButton label={e.entityType?.isLocation ? 'Open place' : 'Open item'} onPress={() => onOpen(e)} />
      </View>
    )
  }

  if (result.kind === 'product') {
    const p = result.product
    return (
      <View style={styles.result}>
        <View style={styles.entity}>
          {p?.imageURL ? (
            <Image source={{ uri: p.imageURL }} style={styles.productImage} contentFit="cover" />
          ) : (
            <View style={styles.productImage}>
              <Icon name={{ ios: 'barcode', android: 'barcode' }} size={20} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={2}>
              {p?.item?.name || 'Unknown product'}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {[p?.manufacturer, result.code].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        {result.matches.length ? (
          <ScrollView style={styles.matches} contentContainerStyle={styles.matchesContent}>
            <Text style={styles.label}>You may already have it</Text>
            {result.matches.map((m) => (
              <PressableFeedback
                key={m.id}
                onPress={() => onOpen(m)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${m.name}`}>
                <EntityLine entity={m} subtitle={m.parent?.name} />
              </PressableFeedback>
            ))}
          </ScrollView>
        ) : null}
        <ActionButton label="Add as new item" onPress={() => onAdd(result)} />
      </View>
    )
  }

  return (
    <View style={styles.result}>
      <Text style={styles.name}>Nothing found</Text>
      <Text style={styles.muted} numberOfLines={3}>
        {result.message}
      </Text>
    </View>
  )
}

function MovePanel({
  target,
  moved,
  onChangeTarget,
}: {
  target: EntitySummary | null
  moved: { entity: EntitySummary; ok: boolean }[]
  onChangeTarget: () => void
}) {
  const { theme } = useUnistyles()
  const reducedMotion = useReducedMotion()

  if (!target) {
    return (
      <View style={styles.result}>
        <Text style={styles.name}>Move things</Text>
        <Text style={styles.muted}>Scan the label of the place or box things are going into.</Text>
      </View>
    )
  }

  const okCount = moved.filter((m) => m.ok).length

  return (
    <View style={styles.result}>
      <View style={styles.targetRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Moving into</Text>
          <EntityLine entity={target} subtitle={okCount ? `${pluralize(okCount, 'thing')} moved` : 'Scan items now'} />
        </View>
        <PressableFeedback
          onPress={onChangeTarget}
          style={styles.change}
          accessibilityRole="button"
          accessibilityLabel="Change destination">
          <Text style={styles.changeText}>Change</Text>
        </PressableFeedback>
      </View>
      {moved.slice(0, 4).map((m, i) => (
        <Animated.View
          key={`${m.entity.id}-${moved.length - i}`}
          entering={reducedMotion ? undefined : FadeIn.duration(150)}
          exiting={reducedMotion ? undefined : FadeOut.duration(150)}
          style={styles.movedRow}>
          <Icon
            name={
              m.ok
                ? { ios: 'checkmark.circle.fill', android: 'check_circle' }
                : { ios: 'xmark.circle', android: 'error' }
            }
            size={18}
            color={m.ok ? theme.colors.success : theme.colors.danger}
          />
          <Text style={styles.movedText} numberOfLines={1}>
            {m.entity.name}
            {m.ok ? '' : ' — couldn’t move'}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}

/** Text on the scanner's dark panel, in either app theme. */
const ON_DARK = {
  text: '#ffffff',
  muted: 'rgba(235, 235, 245, 0.6)',
  accent: '#a5b4fc',
}

const FRAME = 240
const CORNER = 28

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  frameArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(5),
    paddingBottom: 220,
    paddingHorizontal: theme.spacing(8),
  },
  viewfinder: {
    width: FRAME,
    height: FRAME,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#ffffff',
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  hint: {
    ...theme.type.body,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowRadius: 6,
  },
  permissionText: {
    ...theme.type.body,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
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
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: theme.spacing(3),
  },
  panel: {
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
    borderTopLeftRadius: theme.radius.lg + 6,
    borderTopRightRadius: theme.radius.lg + 6,
    overflow: 'hidden',
  },
  panelSolid: {
    backgroundColor: 'rgba(24, 24, 27, 0.94)',
  },
  tabs: {
    alignSelf: 'center',
    flexDirection: 'row',
    padding: TAB_PADDING,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  tab: {
    width: TAB_WIDTH,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  tabIndicator: {
    position: 'absolute',
    top: TAB_PADDING,
    left: TAB_PADDING,
    width: TAB_WIDTH,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabLabel: (selected: boolean) => ({
    ...theme.type.body,
    fontWeight: selected ? '600' : '500',
    color: selected ? ON_DARK.text : ON_DARK.muted,
  }),
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  notice: {
    ...theme.type.body,
    color: ON_DARK.text,
  },
  result: {
    gap: theme.spacing(3),
  },
  entity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(1),
  },
  name: {
    ...theme.type.rowTitle,
    fontSize: 16,
    color: ON_DARK.text,
  },
  muted: {
    ...theme.type.meta,
    color: ON_DARK.muted,
  },
  label: {
    ...theme.type.label,
    color: ON_DARK.muted,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  matches: {
    maxHeight: 160,
  },
  matchesContent: {
    gap: theme.spacing(1),
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
  change: {
    minHeight: 44,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  changeText: {
    ...theme.type.body,
    fontWeight: '600',
    color: ON_DARK.accent,
  },
  movedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  movedText: {
    ...theme.type.body,
    flex: 1,
    color: ON_DARK.text,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing(3),
  },
}))
