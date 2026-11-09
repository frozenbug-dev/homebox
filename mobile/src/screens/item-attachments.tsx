import * as DocumentPicker from 'expo-document-picker'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Icon, icons } from '@/components/icon'
import { ListRow, RowSeparator } from '@/components/list-row'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SectionHeader } from '@/components/section-header'
import type { Attachment, Entity } from '@/lib/api/api'
import { apiUrl } from '@/lib/api/client'
import { confirmDelete, useDeleteAttachment } from '@/lib/api/mutations'
import { attachmentSource, splitAttachments } from '@/lib/attachments'
import { useSession } from '@/lib/auth/session'
import { dismissUpload, enqueueUploads, retryUpload, useUploads, type AttachmentKind, type UploadTask } from '@/lib/uploads'

const THUMB = 72

const KIND_LABELS: Record<string, string> = { manual: 'Manual', receipt: 'Receipt', warranty: 'Warranty' }

/** Photos strip and file attachments of an item, including uploads in progress. */
export function ItemAttachments({ entity }: { entity: Entity }) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session } = useSession()
  const uploads = useUploads(entity.id)
  const remove = useDeleteAttachment(entity.id!)
  const { photos, files } = splitAttachments(entity.attachments)

  const pendingPhotos = uploads.filter((u) => u.kind === 'photo')
  const pendingFiles = uploads.filter((u) => u.kind !== 'photo')

  const takePhotos = () =>
    router.push({ pathname: '/capture', params: { entityId: entity.id!, hasPhotos: photos.length ? '1' : '' } })

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
      entity.id!,
      result.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
        kind: 'photo',
        primary: !photos.length && i === 0,
      })),
    )
  }

  const addPhoto = () =>
    Alert.alert('Add photos', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Library', onPress: pickPhotos },
      { text: 'Camera', onPress: takePhotos },
    ])

  const pickFiles = async () => {
    if (!session) return
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return
    const enqueue = (kind: AttachmentKind) =>
      enqueueUploads(
        session,
        entity.id!,
        result.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType, kind })),
      )
    Alert.alert(result.assets.length > 1 ? `What are these ${result.assets.length} files?` : 'What is this file?', undefined, [
      { text: 'Other', onPress: () => enqueue('attachment') },
      { text: 'Receipt', onPress: () => enqueue('receipt') },
      { text: 'Manual', onPress: () => enqueue('manual') },
    ])
  }

  const openFile = (a: Attachment) => {
    if (!session) return
    const url = `${apiUrl(session.serverUrl, `/entities/${entity.id}/attachments/${a.id}`)}?access_token=${encodeURIComponent(session.attachmentToken)}`
    WebBrowser.openBrowserAsync(url)
  }

  const deleteFile = async (a: Attachment) => {
    if (await confirmDelete(`“${a.title || 'this file'}”`)) remove.mutate(a.id!)
  }

  return (
    <>
      <SectionHeader title="Photos" count={photos.length || undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {session
          ? photos.map((p, i) => (
              <PressableFeedback
                key={p.id}
                feedback="scale"
                style={styles.thumb}
                onPress={() => router.push({ pathname: '/photos', params: { entityId: entity.id!, start: p.id! } })}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${i + 1}${p.primary ? ', cover' : ''}. Open`}>
                <Image
                  source={attachmentSource(session, entity.id!, p.thumbnail?.id ?? p.id!)}
                  style={styles.thumbImage}
                  contentFit="cover"
                  recyclingKey={p.id}
                />
                {p.primary ? (
                  <View style={styles.cover}>
                    <Icon name={{ ios: 'star.fill', android: 'star' }} size={10} color="#ffffff" />
                  </View>
                ) : null}
              </PressableFeedback>
            ))
          : null}
        {pendingPhotos.map((u) => (
          <PendingThumb key={u.id} task={u} />
        ))}
        <PressableFeedback
          feedback="scale"
          style={styles.add}
          onPress={addPhoto}
          accessibilityRole="button"
          accessibilityLabel="Add photos">
          <Icon name={{ ios: 'camera', android: 'photo_camera' }} size={22} color={theme.colors.textMuted} />
          <Text style={styles.addText}>Add</Text>
        </PressableFeedback>
      </ScrollView>

      <SectionHeader title="Attachments" count={files.length || undefined} />
      {files.map((a) => (
        <View key={a.id}>
          <ListRow
            title={a.title || 'Attachment'}
            subtitle={KIND_LABELS[a.type ?? ''] ?? a.mimeType ?? 'File'}
            leading={<FileIcon />}
            onPress={() => openFile(a)}
            onLongPress={() => deleteFile(a)}
            accessibilityHint="Opens the file. Long press to delete."
          />
          <RowSeparator />
        </View>
      ))}
      {pendingFiles.map((u) => (
        <View key={u.id}>
          <ListRow
            title={u.name}
            subtitle={u.status === 'failed' ? `Failed: ${u.error}. Tap to retry` : 'Uploading…'}
            leading={u.status === 'failed' ? <FileIcon failed /> : <Spinner />}
            onPress={u.status === 'failed' ? () => retryUpload(u.id) : undefined}
            onLongPress={u.status === 'failed' ? () => dismissUpload(u.id) : undefined}
          />
          <RowSeparator />
        </View>
      ))}
      <ListRow
        title="Add file"
        subtitle="Receipts, manuals, warranties"
        leading={
          <View style={styles.fileIcon}>
            <Icon name={{ ios: 'plus', android: 'add' }} size={18} color={theme.colors.primary} />
          </View>
        }
        onPress={pickFiles}
      />
    </>
  )
}

function PendingThumb({ task }: { task: UploadTask }) {
  const failed = task.status === 'failed'
  return (
    <PressableFeedback
      style={styles.thumb}
      onPress={failed ? () => retryUpload(task.id) : undefined}
      onLongPress={failed ? () => dismissUpload(task.id) : undefined}
      disabled={!failed}
      accessibilityRole={failed ? 'button' : 'image'}
      accessibilityLabel={failed ? `Upload failed: ${task.error}. Tap to retry, long press to discard` : 'Uploading photo'}>
      <Image source={{ uri: task.uri }} style={styles.thumbImage} contentFit="cover" />
      <View style={styles.overlay}>
        {failed ? (
          <Icon name={{ ios: 'arrow.clockwise', android: 'refresh' }} size={22} color="#ffffff" />
        ) : (
          <ActivityIndicator color="#ffffff" />
        )}
      </View>
    </PressableFeedback>
  )
}

function FileIcon({ failed }: { failed?: boolean }) {
  const { theme } = useUnistyles()
  return (
    <View style={styles.fileIcon}>
      <Icon
        name={failed ? { ios: 'exclamationmark.triangle', android: 'error' } : icons.document}
        size={18}
        color={failed ? theme.colors.danger : undefined}
      />
    </View>
  )
}

function Spinner() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.fileIcon}>
      <ActivityIndicator color={theme.colors.textMuted} />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  strip: {
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
  },
  cover: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.scrim,
  },
  add: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  addText: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
}))
