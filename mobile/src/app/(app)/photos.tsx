import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Text, View, useWindowDimensions } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Icon, type IconName } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { ZoomableImage } from '@/components/zoomable-image'
import { confirmDelete, useDeleteAttachment, useUpdateAttachment } from '@/lib/api/mutations'
import { entityQuery } from '@/lib/api/queries'
import { attachmentSource, splitAttachments } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'

/** Full-screen photo viewer for one item: swipe between photos, pinch to zoom. */
export default function PhotosScreen() {
  const { entityId, start } = useLocalSearchParams<{ entityId: string; start?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { api, session } = useSession()
  const item = useQuery(entityQuery(api, entityId))
  const update = useUpdateAttachment(entityId)
  const remove = useDeleteAttachment(entityId)
  const { photos } = splitAttachments(item.data?.attachments)
  const initial = Math.max(0, photos.findIndex((p) => p.id === start))
  const [index, setIndex] = useState(initial)
  const [zoomed, setZoomed] = useState(false)

  const current = photos[Math.min(index, photos.length - 1)]

  const onDelete = async () => {
    if (!current?.id) return
    if (!(await confirmDelete('this photo'))) return
    await remove.mutateAsync(current.id)
    if (photos.length <= 1) router.back()
    else setIndex((i) => Math.max(0, Math.min(i, photos.length - 2)))
  }

  if (!session) return null

  return (
    <View style={styles.root}>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id!}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        initialScrollIndex={initial}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
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

      <View style={styles.top} pointerEvents="box-none">
        <RoundButton icon={{ ios: 'xmark', android: 'close' }} label="Close" onPress={() => router.back()} />
        {photos.length > 1 ? (
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
        ) : null}
        <View style={styles.spacer} />
      </View>

      {current ? (
        <View style={styles.bottom} pointerEvents="box-none">
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
        </View>
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
    backgroundColor: '#000000',
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
