import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import type { TagSummary } from '@/lib/api/api'

import { PressableFeedback } from './pressable-feedback'

export function TagDot({ color, size = 8 }: { color?: string; size?: number }) {
  return <View style={styles.dot(color, size)} />
}

/** Inline row of tag dots + names for list subtitles: "● Tools  ● Garden +2". */
export function TagInline({ tags, max = 2 }: { tags?: TagSummary[]; max?: number }) {
  if (!tags?.length) return null
  const shown = tags.slice(0, max)
  return (
    <View style={styles.inline}>
      {shown.map((t) => (
        <View key={t.id} style={styles.inlineTag}>
          <TagDot color={t.color} size={7} />
          <Text style={styles.inlineText} numberOfLines={1}>
            {t.name}
          </Text>
        </View>
      ))}
      {tags.length > max ? <Text style={styles.inlineText}>+{tags.length - max}</Text> : null}
    </View>
  )
}

interface TagChipProps {
  tag: TagSummary
  onPress?: () => void
}

export function TagChip({ tag, onPress }: TagChipProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      disabled={!onPress}
      feedback="scale"
      style={styles.chip}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Tag ${tag.name}`}>
      <TagDot color={tag.color} />
      <Text style={styles.chipText} numberOfLines={1}>
        {tag.name}
      </Text>
    </PressableFeedback>
  )
}

const styles = StyleSheet.create((theme) => ({
  dot: (color: string | undefined, size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color || theme.colors.textFaint,
  }),
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2.5),
  },
  inlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 1,
  },
  inlineText: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    height: 32,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  chipText: {
    ...theme.type.meta,
    fontWeight: '500',
    color: theme.colors.text,
  },
}))
