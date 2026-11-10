import * as Haptics from 'expo-haptics'
import { useRef, type ReactNode } from 'react'
import { Text, View, type ColorValue } from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import { StyleSheet } from 'react-native-unistyles'

import { Icon, type IconName } from './icon'
import { PressableFeedback } from './pressable-feedback'

export interface SwipeAction {
  label: string
  icon: IconName
  color: ColorValue
  onPress: () => void
}

interface SwipeableRowProps {
  children: ReactNode
  /** Revealed by swiping right: positive / quick actions. */
  leading?: SwipeAction
  /** Revealed by swiping left: destructive / secondary actions. */
  trailing?: SwipeAction
}

// Only one row is open at a time; opening another closes this one.
let openRow: SwipeableMethods | null = null

/**
 * Swipe actions for list rows. Swipes aren't discoverable or accessible on
 * their own, so every action is also exposed as an accessibility action and
 * must be reachable elsewhere (detail screen menu).
 */
export function SwipeableRow({ children, leading, trailing }: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null)

  const run = (action: SwipeAction) => {
    ref.current?.close()
    action.onPress()
  }

  const renderAction = (action: SwipeAction) => (
    <PressableFeedback
      onPress={() => run(action)}
      style={[styles.action, { backgroundColor: action.color }]}
      accessibilityRole="button"
      accessibilityLabel={action.label}>
      <Icon name={action.icon} size={20} color="#ffffff" />
      <Text style={styles.actionText}>{action.label}</Text>
    </PressableFeedback>
  )

  const actions = [leading, trailing].filter((a): a is SwipeAction => !!a)

  return (
    <View
      accessibilityActions={actions.map((a) => ({ name: a.label, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.label === e.nativeEvent.actionName)?.onPress()}>
      <ReanimatedSwipeable
        ref={ref}
        friction={2}
        leftThreshold={48}
        rightThreshold={48}
        overshootLeft={false}
        overshootRight={false}
        // Opaque, so a row dimmed by its press highlight (iOS) blends with the
        // page instead of showing the action buttons underneath.
        childrenContainerStyle={styles.row}
        renderLeftActions={leading ? () => renderAction(leading) : undefined}
        renderRightActions={trailing ? () => renderAction(trailing) : undefined}
        onSwipeableWillOpen={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          if (openRow && openRow !== ref.current) openRow.close()
          openRow = ref.current
        }}
        onSwipeableClose={() => {
          if (openRow === ref.current) openRow = null
        }}>
        {children}
      </ReanimatedSwipeable>
    </View>
  )
}

/** Closes whichever row is open (call on scroll). */
export function closeOpenSwipeable() {
  openRow?.close()
  openRow = null
}

const styles = StyleSheet.create((theme) => ({
  row: {
    backgroundColor: theme.colors.background,
  },
  action: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    overflow: 'hidden',
  },
  actionText: {
    ...theme.type.meta,
    fontWeight: '600',
    color: '#ffffff',
  },
}))
