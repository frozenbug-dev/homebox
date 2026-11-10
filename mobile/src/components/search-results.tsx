import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import type { TagSummary } from '@/lib/api/api'
import { flattenTree, placesTreeQuery, tagsQuery } from '@/lib/api/queries'
import { useSession } from '@/lib/auth/session'

import { EmptyState } from './empty-state'
import { EntityList } from './entity-list'
import { Icon, icons } from './icon'
import { ListRow, RowSeparator } from './list-row'
import { PressableFeedback } from './pressable-feedback'
import { SectionHeader } from './section-header'
import { TagDot } from './tag-chip'

export type SearchScope = 'all' | 'items' | 'places' | 'tags'

/** How many places / tags "All" shows before offering the full list. */
const PREVIEW = 3

interface SearchResultsProps {
  /** Debounced, trimmed query (non-empty). */
  q: string
  scope?: SearchScope
  /** Lets "All" link to the full place / tag results (Android filter chips). */
  onScopeChange?: (scope: SearchScope) => void
  /** Called when a result is opened (e.g. to remember the search). */
  onOpen?: () => void
}

type PlaceResult = ReturnType<typeof flattenTree>[number]

/** Items, places and tags matching `q`, as one list (iOS search tab, Android search view). */
export function SearchResults({ q, scope = 'all', onScopeChange, onOpen }: SearchResultsProps) {
  const { theme, rt } = useUnistyles()
  const router = useRouter()
  const { api } = useSession()
  const tree = useQuery(placesTreeQuery(api))
  const tags = useQuery(tagsQuery(api))

  const needle = q.toLowerCase()
  const places = useMemo(
    () => flattenTree(tree.data ?? []).filter((p) => p.name.toLowerCase().includes(needle)),
    [tree.data, needle],
  )
  const matchingTags = useMemo(
    () => (tags.data ?? []).filter((t) => (t.name ?? '').toLowerCase().includes(needle)),
    [tags.data, needle],
  )

  const openPlace = (p: PlaceResult) => {
    onOpen?.()
    router.push({ pathname: '/place/[id]', params: { id: p.id, name: p.name } })
  }
  const openTag = (t: TagSummary) => {
    onOpen?.()
    router.push({ pathname: '/tag/[id]', params: { id: t.id!, name: t.name, color: t.color } })
  }

  if (scope === 'places' || scope === 'tags') {
    const pending = scope === 'places' ? tree.isPending : tags.isPending
    const rows: (PlaceResult | TagSummary)[] = scope === 'places' ? places : matchingTags
    return (
      <FlashList
        data={rows}
        keyExtractor={(r) => r.id!}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: rt.insets.bottom + theme.spacing(4) }}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          pending ? (
            <ActivityIndicator style={styles.loading} color={theme.colors.textMuted} />
          ) : (
            <EmptyState
              icon={scope === 'places' ? icons.placeFolder : icons.tag}
              title={scope === 'places' ? 'No places match' : 'No tags match'}
              message={`Nothing matches “${q}”.`}
            />
          )
        }
        renderItem={({ item }) =>
          scope === 'places' ? (
            <PlaceRow place={item as PlaceResult} onPress={() => openPlace(item as PlaceResult)} />
          ) : (
            <TagRow tag={item as TagSummary} onPress={() => openTag(item as TagSummary)} />
          )
        }
      />
    )
  }

  if (scope === 'items') {
    return <EntityList filters={{ q }} onOpen={onOpen} emptyTitle="No items match" emptyMessage={`Nothing matches “${q}”.`} />
  }

  // "All": a few places and tags up front, then every matching item.
  const limit = onScopeChange ? PREVIEW : 5
  const header = (
    <View>
      {places.length ? (
        <>
          <SectionHeader title="Places" count={places.length} />
          {places.slice(0, limit).map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowSeparator /> : null}
              <PlaceRow place={p} onPress={() => openPlace(p)} />
            </View>
          ))}
          {onScopeChange && places.length > limit ? (
            <SeeAll label={`All ${places.length} places`} onPress={() => onScopeChange('places')} />
          ) : null}
        </>
      ) : null}
      {matchingTags.length ? (
        <>
          <SectionHeader title="Tags" count={matchingTags.length} />
          {matchingTags.slice(0, limit).map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <RowSeparator /> : null}
              <TagRow tag={t} onPress={() => openTag(t)} />
            </View>
          ))}
          {onScopeChange && matchingTags.length > limit ? (
            <SeeAll label={`All ${matchingTags.length} tags`} onPress={() => onScopeChange('tags')} />
          ) : null}
        </>
      ) : null}
      <SectionHeader title="Items" />
    </View>
  )

  return (
    <EntityList
      filters={{ q }}
      header={header}
      onOpen={onOpen}
      emptyTitle="No items match"
      emptyMessage={places.length || matchingTags.length ? undefined : `Nothing matches “${q}”.`}
    />
  )
}

function PlaceRow({ place, onPress }: { place: PlaceResult; onPress: () => void }) {
  return (
    <ListRow
      title={place.name}
      subtitle={place.depth > 0 ? place.path : undefined}
      leading={
        <View style={styles.icon}>
          <Icon name={icons.placeFolder} size={18} />
        </View>
      }
      chevron
      onPress={onPress}
    />
  )
}

function TagRow({ tag, onPress }: { tag: TagSummary; onPress: () => void }) {
  return (
    <ListRow
      title={tag.name ?? ''}
      subtitle={tag.description || undefined}
      leading={
        <View style={styles.dot}>
          <TagDot color={tag.color} size={12} />
        </View>
      }
      chevron
      onPress={onPress}
    />
  )
}

function SeeAll({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useUnistyles()
  return (
    <PressableFeedback onPress={onPress} style={styles.seeAll} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.seeAllText}>{label}</Text>
      <Icon name={{ ios: 'chevron.right', android: 'arrow_forward' }} size={18} color={theme.colors.primary} />
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  dot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 48,
    paddingHorizontal: theme.spacing(4),
    paddingLeft: theme.spacing(4) + 40 + theme.spacing(3),
  },
  seeAllText: {
    ...theme.type.rowTitle,
    color: theme.colors.primary,
  },
  loading: {
    paddingVertical: theme.spacing(16),
  },
}))
