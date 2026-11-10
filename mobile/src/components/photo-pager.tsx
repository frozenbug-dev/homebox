import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import type { Attachment } from '@/lib/api/api'
import { attachmentSource } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'

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
          <PressableFeedback
            key={p.id}
            onPress={() => router.push({ pathname: '/photos', params: { entityId, start: p.id! } })}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${photos.length}. Open full screen`}>
            <Image
              source={attachmentSource(session, entityId, p.id!)}
              placeholder={p.thumbnail?.id ? attachmentSource(session, entityId, p.thumbnail.id) : undefined}
              placeholderContentFit="cover"
              style={{ width, height }}
              contentFit="cover"
              transition={150}
            />
          </PressableFeedback>
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
