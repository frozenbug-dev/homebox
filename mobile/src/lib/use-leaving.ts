import { useNavigation } from 'expo-router'
import { useEffect, useState } from 'react'

/**
 * True from the moment this screen starts going away (back button, or the
 * start of an interactive swipe back) until it comes back (e.g. a cancelled
 * swipe), or while another screen is pushed on top of it.
 *
 * Used to clear the bottom toolbar early: it belongs to the navigation
 * controller, not the screen, so UIKit would otherwise keep showing this
 * screen's buttons above the tab bar until the swipe has finished.
 */
export function useLeaving() {
  const navigation = useNavigation()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const unsubscribers = [
      navigation.addListener('transitionStart' as never, (e: { data?: { closing?: boolean } }) =>
        setLeaving(!!e.data?.closing),
      ),
      navigation.addListener('gestureCancel' as never, () => setLeaving(false)),
      navigation.addListener('focus', () => setLeaving(false)),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [navigation])

  return leaving
}
