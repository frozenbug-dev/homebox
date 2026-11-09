import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Alert } from 'react-native'

import { useSession } from '@/lib/auth/session'

import { unwrap, type Entity, type EntityCreate, type Schemas } from './api'
import { entityKeys, tagKeys } from './queries'

export type EntityPatch = Omit<Schemas['repo.EntityPatch'], 'id'>

function useApiOrThrow() {
  const { api } = useSession()
  return () => {
    if (!api) throw new Error('Not signed in')
    return api
  }
}

function showError(title: string) {
  return (e: Error) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    Alert.alert(title, e.message)
  }
}

/**
 * Changes some fields of an entity. The detail view updates immediately and
 * rolls back if the server refuses; lists refresh once it's saved.
 */
export function usePatchEntity(id: string) {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: (patch: EntityPatch) =>
      unwrap(getApi().PATCH('/v1/entities/{id}', { params: { path: { id } }, body: { id, ...patch } })),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: entityKeys.detail(id) })
      const previous = qc.getQueryData<Entity>(entityKeys.detail(id))
      if (previous) {
        const { tagIds: _tagIds, parentId: _parentId, ...simple } = patch
        qc.setQueryData<Entity>(entityKeys.detail(id), { ...previous, ...stripNulls(simple) })
      }
      return { previous }
    },
    onError: (e, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(entityKeys.detail(id), ctx.previous)
      showError('Couldn’t save')(e)
    },
    onSuccess: (updated) => {
      qc.setQueryData(entityKeys.detail(id), updated)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}

function stripNulls<T extends object>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as {
    [K in keyof T]?: NonNullable<T[K]>
  }
}

/** Patch any entity by id (list rows, swipe actions); no optimistic update. */
export function usePatchAnyEntity() {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EntityPatch }) =>
      unwrap(getApi().PATCH('/v1/entities/{id}', { params: { path: { id } }, body: { id, ...patch } })),
    onSuccess: (updated) => {
      if (updated.id) qc.setQueryData(entityKeys.detail(updated.id), updated)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    },
    onError: showError('Couldn’t save'),
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}

export function useCreateEntity() {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: (body: EntityCreate) => unwrap(getApi().POST('/v1/entities', { body })),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onError: showError('Couldn’t create'),
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}

export function useDeleteEntity() {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: (id: string) => unwrap(getApi().DELETE('/v1/entities/{id}', { params: { path: { id } } })),
    onSuccess: (_d, id) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.removeQueries({ queryKey: entityKeys.detail(id) })
    },
    onError: showError('Couldn’t delete'),
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}

export function useDuplicateEntity() {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        getApi().POST('/v1/entities/{id}/duplicate', {
          params: { path: { id } },
          body: { copyAttachments: true, copyCustomFields: true, copyMaintenance: false, copyPrefix: 'Copy of ' },
        }),
      ),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onError: showError('Couldn’t duplicate'),
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}

export type TagInput = Schemas['repo.TagCreate']

export function useSaveTag() {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: ({ id, ...body }: TagInput & { id?: string }) =>
      id
        ? unwrap(getApi().PUT('/v1/tags/{id}', { params: { path: { id } }, body: { ...body, id } }))
        : unwrap(getApi().POST('/v1/tags', { body })),
    onError: showError('Couldn’t save tag'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all })
      qc.invalidateQueries({ queryKey: entityKeys.all })
    },
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: (id: string) => unwrap(getApi().DELETE('/v1/tags/{id}', { params: { path: { id } } })),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onError: showError('Couldn’t delete tag'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all })
      qc.invalidateQueries({ queryKey: entityKeys.all })
    },
  })
}

/** Native confirmation before deleting something; resolves true when confirmed. */
export function confirmDelete(what: string, detail?: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(`Delete ${what}?`, detail ?? 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export type AttachmentUpdate = Schemas['repo.ItemAttachmentUpdate']

export function useUpdateAttachment(entityId: string) {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: ({ attachmentId, ...body }: AttachmentUpdate & { attachmentId: string }) =>
      unwrap(
        getApi().PUT('/v1/entities/{id}/attachments/{attachment_id}', {
          params: { path: { id: entityId, attachment_id: attachmentId } },
          body,
        }),
      ),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onError: showError('Couldn’t update attachment'),
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}

export function useDeleteAttachment(entityId: string) {
  const qc = useQueryClient()
  const getApi = useApiOrThrow()

  return useMutation({
    mutationFn: (attachmentId: string) =>
      unwrap(
        getApi().DELETE('/v1/entities/{id}/attachments/{attachment_id}', {
          params: { path: { id: entityId, attachment_id: attachmentId } },
        }),
      ),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onError: showError('Couldn’t delete attachment'),
    onSettled: () => qc.invalidateQueries({ queryKey: entityKeys.all }),
  })
}
