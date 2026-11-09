import { TabStack } from '@/components/tab-stack'

export const unstable_settings = { initialRouteName: 'places' }

export default function Layout() {
  return <TabStack root="places" title="Places" />
}
