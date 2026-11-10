import { useRouter } from 'expo-router'

import type { IconName } from './icon'

export interface FabAction {
  key: string
  label: string
  icon: IconName
  onPress: () => void
}

/** Create / scan actions offered from every list tab (FAB on Android, toolbar on iOS). */
export function useFabActions(): FabAction[] {
  const router = useRouter()
  return [
    {
      key: 'scan',
      label: 'Scan',
      icon: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
      onPress: () => router.push('/scan'),
    },
    {
      key: 'tag',
      label: 'New tag',
      icon: { ios: 'tag', android: 'sell' },
      onPress: () => router.push('/edit-tag'),
    },
    {
      key: 'place',
      label: 'New place',
      icon: { ios: 'square.stack.3d.up', android: 'shelves' },
      onPress: () => router.push({ pathname: '/new-item', params: { kind: 'place' } }),
    },
    {
      key: 'item',
      label: 'New item',
      icon: { ios: 'shippingbox', android: 'inventory_2' },
      onPress: () => router.push('/new-item'),
    },
  ]
}
