import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Icon } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'
import { SearchField } from '@/components/search-field'
import { SheetHeader } from '@/components/sheet-header'
import { TagDot } from '@/components/tag-chip'
import { useSaveTag } from '@/lib/api/mutations'
import { tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'
import { useSheetRequest } from '@/lib/use-sheets'
import { TAG_COLORS } from '@/lib/tag-colors'

export default function PickTagsSheet() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { api } = useSession()
  const request = useSheetRequest('tags')
  const tags = useQuery(tagsQuery(api))
  const saveTag = useSaveTag()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set(request?.selectedIds ?? []))

  // Commit when the sheet goes away, however it's dismissed (Done, swipe, back).
  const latest = useRef(selected)
  useEffect(() => {
    latest.current = selected
  }, [selected])
  useEffect(() => {
    const initial = [...(request?.selectedIds ?? [])].sort().join()
    return () => {
      const ids = [...latest.current]
      if ([...ids].sort().join() !== initial) request?.onChange(ids)
    }
  }, [request])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (tags.data ?? []).filter((t) => !q || (t.name ?? '').toLowerCase().includes(q))
  }, [tags.data, search])

  const toggle = (id: string) => {
    Haptics.selectionAsync()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const query = search.trim()
  const canCreate = !!query && !(tags.data ?? []).some((t) => t.name?.toLowerCase() === query.toLowerCase())

  const createTag = async () => {
    const color = TAG_COLORS[(tags.data?.length ?? 0) % TAG_COLORS.length].value
    const tag = await saveTag.mutateAsync({ name: query, color })
    setSearch('')
    if (tag.id) toggle(tag.id)
  }

  if (!request) return null

  return (
    <View style={styles.root}>
      <SheetHeader title="Tags" right={{ label: 'Done', primary: true, onPress: () => router.back() }} />
      <SearchField
        placeholder="Search or create a tag"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => (canCreate ? createTag() : undefined)}
      />
      {tags.isPending ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(t) => t.id!}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          extraData={selected}
          ListHeaderComponent={
            canCreate ? (
              <PressableFeedback
                style={styles.row}
                onPress={createTag}
                disabled={saveTag.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Create tag ${query}`}>
                <Icon name={{ ios: 'plus', android: 'add' }} size={18} color={theme.colors.primary} />
                <Text style={styles.create}>{saveTag.isPending ? 'Creating…' : `Create “${query}”`}</Text>
              </PressableFeedback>
            ) : null
          }
          renderItem={({ item }) => {
            const on = selected.has(item.id!)
            return (
              <PressableFeedback
                style={styles.row}
                onPress={() => toggle(item.id!)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.name}>
                <View style={styles.dot}>
                  <TagDot color={item.color} size={10} />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.check(on)}>
                  {on ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={14} color={theme.colors.onPrimary} /> : null}
                </View>
              </PressableFeedback>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    paddingVertical: theme.spacing(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 48,
    paddingHorizontal: theme.spacing(4),
    overflow: 'hidden',
  },
  dot: {
    width: 18,
    alignItems: 'center',
  },
  name: {
    ...theme.type.body,
    flex: 1,
    color: theme.colors.text,
  },
  create: {
    ...theme.type.body,
    color: theme.colors.primary,
  },
  check: (on: boolean) => ({
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: on ? 0 : 1.5,
    borderColor: theme.colors.border,
    backgroundColor: on ? theme.colors.primary : 'transparent',
  }),
}))
