import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera'

import { ActionButton } from '@/components/action-button'
import { Icon } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { useSession } from '@/lib/auth/session'
import { enqueueUploads } from '@/lib/uploads'

interface Shot {
  uri: string
  name: string
}

/**
 * Take several photos of an item in a row, then upload them in the
 * background. Opened with `entityId` and `hasPhotos` (the first shot becomes
 * the cover when the item has none yet).
 */
export default function CaptureScreen() {
  const { entityId, hasPhotos } = useLocalSearchParams<{ entityId: string; hasPhotos?: string }>()
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session } = useSession()
  const reducedMotion = useReducedMotion()
  const isFocused = useIsFocused()
  const { hasPermission, requestPermission } = useCameraPermission()
  const back = useCameraDevice('back')
  const front = useCameraDevice('front')
  const device = back ?? front
  const photoOutput = usePhotoOutput({
    targetResolution: { width: 2048, height: 2048 },
    containerFormat: 'jpeg',
    quality: 0.8,
    qualityPrioritization: 'balanced',
  })
  const [shots, setShots] = useState<Shot[]>([])
  const [busy, setBusy] = useState(false)

  const capture = async () => {
    if (busy) return
    setBusy(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off', enableShutterSound: true }, {})
      const uri = file.filePath.startsWith('file://') ? file.filePath : `file://${file.filePath}`
      setShots((s) => [...s, { uri, name: `photo-${Date.now()}.jpg` }])
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      console.warn('capture failed', e)
    } finally {
      setBusy(false)
    }
  }

  const done = () => {
    if (session && shots.length) {
      enqueueUploads(
        session,
        entityId,
        shots.map((s, i) => ({ uri: s.uri, name: s.name, mimeType: 'image/jpeg', kind: 'photo', primary: !hasPhotos && i === 0 })),
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
        <Camera style={StyleSheet.absoluteFill} device={device} outputs={[photoOutput]} isActive enableNativeZoomGesture />
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
        {shots.length ? (
          <PressableFeedback
            onPress={done}
            feedback="scale"
            style={styles.done}
            accessibilityRole="button"
            accessibilityLabel={`Upload ${shots.length} photos`}>
            <Text style={styles.doneText}>Done · {shots.length}</Text>
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
                  onPress={() => {
                    Haptics.selectionAsync()
                    setShots((all) => all.filter((x) => x.uri !== s.uri))
                  }}
                  feedback="scale"
                  style={styles.shot}
                  accessibilityRole="button"
                  accessibilityLabel={`Photo ${i + 1}. Remove`}>
                  <Image source={{ uri: s.uri }} style={styles.shotImage} contentFit="cover" />
                  <View style={styles.remove}>
                    <Icon name={{ ios: 'xmark', android: 'close' }} size={12} color="#ffffff" />
                  </View>
                </PressableFeedback>
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.hint}>Take as many photos as you like</Text>
        )}

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
      </View>
    </View>
  )
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
  done: {
    height: 40,
    paddingHorizontal: theme.spacing(4),
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    overflow: 'hidden',
  },
  doneText: {
    ...theme.type.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing(4),
    paddingBottom: rt.insets.bottom + theme.spacing(6),
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
  remove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
