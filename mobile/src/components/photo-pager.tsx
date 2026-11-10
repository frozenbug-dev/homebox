import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import type { Attachment } from '@/lib/api/api'
import { attachmentSource } from '@/lib/attachments'
import type { Session } from '@/lib/auth/storage'
import { rememberAspect, usePhotoSlot } from '@/lib/photo-transition'
import { useSession } from '@/lib/auth/session'

import { Image } from './image'
import { PressableFeedback } from './pressable-feedback'

/** Swipeable full-width photos of an entity; tapping one opens the full-screen viewer. */
export function PhotoPager({ entityId, photos, height }: { entityId: string; photos: Attachment[]; height: number }) {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { session } = useSession()
  const [index, setIndex] = useState(0)
  if (!session) return null

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(ev) => setIndex(Math.round(ev.nativeEvent.contentOffset.x / width))}>
        {photos.map((p, i) => (
          <PagerPhoto
            key={p.id}
            session={session}
            entityId={entityId}
            photo={p}
            width={width}
            height={height}
            label={`Photo ${i + 1} of ${photos.length}. Open full screen`}
            onPress={() => router.push({ pathname: '/photos', params: { entityId, start: p.id!, source: 'cover' } })}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((p, i) => (
            <View key={p.id} style={styles.pageDot(i === index)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function PagerPhoto({
  session,
  entityId,
  photo: p,
  width,
  height,
  label,
  onPress,
}: {
  session: Session
  entityId: string
  photo: Attachment
  width: number
  height: number
  label: string
  onPress: () => void
}) {
  // The viewer morphs out of (and back into) this slot.
  const { ref: slotRef, hidden } = usePhotoSlot('cover', p.id!)
  return (
    <PressableFeedback onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={label}>
      <View ref={slotRef} collapsable={false} style={{ opacity: hidden ? 0 : 1 }}>
        <Image
          source={attachmentSource(session, entityId, p.id!)}
          placeholder={p.thumbnail?.id ? attachmentSource(session, entityId, p.thumbnail.id) : undefined}
          placeholderContentFit="cover"
          style={{ width, height }}
          contentFit="cover"
          transition={150}
          onLoad={(size) => rememberAspect(p.id!, size.width, size.height)}
        />
      </View>
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  dots: {
    position: 'absolute',
    // Clear of the rounded content sheet that overlaps the cover's bottom edge.
    bottom: theme.spacing(8),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
  },
  pageDot: (active: boolean) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: active ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
  }),
}))
