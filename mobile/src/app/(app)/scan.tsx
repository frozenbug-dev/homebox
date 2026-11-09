import { useIsFocused, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Camera, useCameraPermission } from 'react-native-vision-camera'

import { ActionButton } from '@/components/action-button'
import { Icon } from '@/components/icon'
import { PressableFeedback } from '@/components/pressable-feedback'

// Scanning (labels, barcodes, move mode) arrives in phase 4; this is the camera shell.
export default function ScanScreen() {
  const router = useRouter()
  const { hasPermission, requestPermission } = useCameraPermission()
  const isFocused = useIsFocused()

  return (
    <View style={styles.root}>
      {hasPermission ? (
        isFocused ? (
          <Camera style={StyleSheet.absoluteFill} device="back" isActive />
        ) : null
      ) : (
        <View style={styles.centered}>
          <Text style={styles.text}>Homecrate needs the camera to scan labels and barcodes.</Text>
          <View style={styles.permission}>
            <ActionButton label="Allow camera" onPress={requestPermission} />
          </View>
        </View>
      )}
      <PressableFeedback
        onPress={() => router.back()}
        borderless
        style={styles.close}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close scanner">
        <Icon name={{ ios: 'xmark', android: 'close' }} size={22} color="#ffffff" />
      </PressableFeedback>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(5),
    padding: theme.spacing(8),
  },
  permission: {
    width: 220,
  },
  text: {
    ...theme.type.body,
    color: '#ffffff',
    textAlign: 'center',
  },
  close: {
    position: 'absolute',
    top: rt.insets.top + theme.spacing(2),
    left: theme.spacing(3),
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
}))
