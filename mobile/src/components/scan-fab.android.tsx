import { FloatingActionButton, Host, Icon } from '@expo/ui/jetpack-compose'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useMaterialSymbol } from '@/lib/use-material-symbol'

/** Space to leave at the bottom of lists so the FAB never covers the last row. */
export const SCAN_FAB_SPACE = 88

/** Material 3 FAB that opens the scanner. */
export function ScanFab() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const icon = useMaterialSymbol('qr_code_scanner', 24, theme.colors.onPrimary)

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <Host matchContents>
        <FloatingActionButton containerColor={theme.colors.primary} onClick={() => router.push('/scan')}>
          <FloatingActionButton.Icon>
            {icon ? <Icon source={icon} tint={theme.colors.onPrimary} contentDescription="Scan" /> : null}
          </FloatingActionButton.Icon>
        </FloatingActionButton>
      </Host>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  anchor: {
    position: 'absolute',
    right: theme.spacing(4),
    bottom: theme.spacing(4),
  },
}))
