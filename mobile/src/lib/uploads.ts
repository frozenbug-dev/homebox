import { File, Paths } from 'expo-file-system'
import { useSyncExternalStore } from 'react'

import { apiUrl } from '@/lib/api/client'
import { entityKeys } from '@/lib/api/queries'
import type { Session } from '@/lib/auth/storage'
import { queryClient } from '@/lib/query-client'

export type AttachmentKind = 'photo' | 'manual' | 'receipt' | 'warranty' | 'attachment'

export interface UploadTask {
  id: string
  entityId: string
  /** Local file:// or content:// uri. */
  uri: string
  name: string
  mimeType: string
  kind: AttachmentKind
  primary: boolean
  status: 'queued' | 'uploading' | 'done' | 'failed'
  error?: string
}

export interface NewUpload {
  uri: string
  name: string
  mimeType?: string
  kind: AttachmentKind
  primary?: boolean
}

/**
 * App-wide upload queue. Files upload one at a time in the background, so
 * the user can leave the screen (or keep shooting) while they go up; screens
 * subscribe to show progress and retry failures. Lives for the app session.
 */
let tasks: UploadTask[] = []
let session: Session | null = null
let running = false
const listeners = new Set<() => void>()

function emit() {
  tasks = [...tasks]
  listeners.forEach((l) => l())
}

function update(id: string, patch: Partial<UploadTask>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
  emit()
}

let counter = 0

export function enqueueUploads(currentSession: Session, entityId: string, files: NewUpload[]) {
  session = currentSession
  for (const f of files) {
    tasks.push({
      id: `${Date.now()}-${counter++}`,
      entityId,
      uri: f.uri,
      name: f.name,
      mimeType: f.mimeType ?? guessMime(f.name),
      kind: f.kind,
      primary: !!f.primary,
      status: 'queued',
    })
  }
  emit()
  void run()
}

export function retryUpload(id: string) {
  update(id, { status: 'queued', error: undefined })
  void run()
}

export function dismissUpload(id: string) {
  tasks = tasks.filter((t) => t.id !== id)
  emit()
}

/** Drop everything (sign-out). */
export function clearUploads() {
  tasks = []
  session = null
  emit()
}

async function run() {
  if (running) return
  running = true
  try {
    let next: UploadTask | undefined
    while ((next = tasks.find((t) => t.status === 'queued'))) {
      const task = next
      update(task.id, { status: 'uploading' })
      try {
        await upload(task)
        update(task.id, { status: 'done' })
        await queryClient.invalidateQueries({ queryKey: entityKeys.detail(task.entityId) })
        queryClient.invalidateQueries({ queryKey: entityKeys.lists() })
        // Finished uploads disappear once the server copy is on screen.
        dismissUpload(task.id)
      } catch (e) {
        update(task.id, { status: 'failed', error: e instanceof Error ? e.message : 'Upload failed' })
      }
    }
  } finally {
    running = false
  }
}

async function upload(task: UploadTask) {
  if (!session) throw new Error('Not signed in')
  const form = new FormData()
  // React Native's FormData takes { uri, name, type } for files; nitro-fetch
  // streams them from disk natively.
  form.append('file', { uri: task.uri, name: task.name, type: task.mimeType } as unknown as Blob)
  form.append('name', task.name)
  form.append('type', task.kind)
  form.append('primary', String(task.primary))

  const res = await fetch(apiUrl(session.serverUrl, `/entities/${task.entityId}/attachments`), {
    method: 'POST',
    headers: {
      Authorization: session.token,
      Accept: 'application/json',
      ...(session.tenantId ? { 'X-Tenant': session.tenantId } : {}),
    },
    body: form,
    credentials: 'omit',
  })
  if (!res.ok) {
    let message = `Upload failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // not JSON
    }
    throw new Error(message)
  }
}

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain',
  }
  return types[ext ?? ''] ?? 'application/octet-stream'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => tasks

/** Pending / failed uploads, optionally for one entity. */
export function useUploads(entityId?: string) {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return entityId ? all.filter((t) => t.entityId === entityId) : all
}

/** Downloads an image (e.g. a product photo) and queues it, by default as the entity's cover. */
export async function attachRemotePhoto(currentSession: Session, entityId: string, url: string, primary = true) {
  try {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
    const name = `product-${Date.now()}.${ext && ext.length <= 4 ? ext : 'jpg'}`
    const file = await File.downloadFileAsync(url, new File(Paths.cache, name), { idempotent: true })
    enqueueUploads(currentSession, entityId, [{ uri: file.uri, name, kind: 'photo', primary }])
  } catch (e) {
    console.warn('product photo download failed', e)
  }
}
