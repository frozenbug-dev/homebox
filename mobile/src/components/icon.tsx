import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

export interface IconName {
  ios: SFSymbol
  android: AndroidSymbol
}

interface IconProps {
  name: IconName
  size?: number
  color?: ColorValue
  style?: StyleProp<ViewStyle>
}

/** SF Symbol on iOS, Material Symbol on Android. Decorative: hidden from screen readers. */
export function Icon({ name, size = 18, color, style }: IconProps) {
  const { theme } = useUnistyles()
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? theme.colors.textMuted}
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}

/** Icons used across the app, so each concept looks the same everywhere. */
export const icons = {
  item: { ios: 'shippingbox', android: 'inventory_2' },
  place: { ios: 'mappin.and.ellipse', android: 'location_on' },
  placeFolder: { ios: 'square.stack.3d.up', android: 'shelves' },
  tag: { ios: 'tag', android: 'sell' },
  quantity: { ios: 'number', android: 'tag' },
  price: { ios: 'creditcard', android: 'payments' },
  scan: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  attachment: { ios: 'paperclip', android: 'attach_file' },
  document: { ios: 'doc.text', android: 'description' },
  photo: { ios: 'photo', android: 'image' },
  warranty: { ios: 'checkmark.shield', android: 'verified_user' },
  insured: { ios: 'shield', android: 'shield' },
  archived: { ios: 'archivebox', android: 'archive' },
  search: { ios: 'magnifyingglass', android: 'search' },
} satisfies Record<string, IconName>
