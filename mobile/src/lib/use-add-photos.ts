import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'

import { useSession } from '@/lib/auth/session'
import { enqueueUploads } from '@/lib/uploads'

/**
 * "Add photos" for any entity (item or place): take photos with the camera
 * or pick from the library; uploads go through the background queue. The
 * first photo becomes the cover when the entity has none.
 */
export function useAddPhotos(entityId: string, hasPhotos: boolean) {
  const router = useRouter()
  const { session } = useSession()

  const takePhotos = () =>
    router.push({ pathname: '/capture', params: { entityId, hasPhotos: hasPhotos ? '1' : '' } })

  const pickPhotos = async () => {
    if (!session) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled) return
    enqueueUploads(
      session,
      entityId,
      result.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
        kind: 'photo',
        primary: !hasPhotos && i === 0,
      })),
    )
  }

  const addPhotos = () =>
    Alert.alert('Add photos', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Library', onPress: pickPhotos },
      { text: 'Camera', onPress: takePhotos },
    ])

  return { addPhotos, takePhotos, pickPhotos }
}
