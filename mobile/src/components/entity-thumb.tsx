import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import type { EntitySummary } from '@/lib/api/api'
import { attachmentSource } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'

import { Icon, icons } from './icon'
import { Image } from './image'

interface EntityThumbProps {
  entity: Pick<EntitySummary, 'id' | 'thumbnailId' | 'imageId' | 'entityType'>
  size?: number
}

/** Square thumbnail: the item's photo, or a quiet icon for its kind. */
export function EntityThumb({ entity, size = 40 }: EntityThumbProps) {
  const { session } = useSession()
  const imageId = entity.thumbnailId ?? entity.imageId
  const isPlace = entity.entityType?.isLocation

  return (
    <View style={styles.thumb(size)}>
      {imageId && session ? (
        <Image
          source={attachmentSource(session, entity.id!, imageId)}
          style={styles.image(size)}
          contentFit="cover"
          recyclingKey={entity.id}
        />
      ) : (
        <Icon name={isPlace ? icons.placeFolder : icons.item} size={Math.round(size * 0.45)} />
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  thumb: (size: number) => ({
    width: size,
    height: size,
    borderRadius: size > 48 ? theme.radius.md : theme.radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.separator,
  }),
  image: (size: number) => ({
    width: size,
    height: size,
  }),
}))
