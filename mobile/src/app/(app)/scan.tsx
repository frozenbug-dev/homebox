import { useIsFocused } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Camera, useCameraPermission } from 'react-native-vision-camera'

export default function ScanScreen() {
  const { hasPermission, requestPermission } = useCameraPermission()
  const isFocused = useIsFocused()

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Homecrate needs camera access to photograph items.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
      </View>
    )
  }

  // Tabs mount eagerly; only open the camera while this tab is on screen.
  if (!isFocused) return <View style={styles.camera} />

  return <Camera style={styles.camera} device="back" isActive />
}

const styles = StyleSheet.create((theme) => ({
  camera: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(4),
    padding: theme.spacing(6),
    backgroundColor: theme.colors.background,
  },
  text: {
    color: theme.colors.text,
    textAlign: 'center',
  },
  button: {
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
}))
