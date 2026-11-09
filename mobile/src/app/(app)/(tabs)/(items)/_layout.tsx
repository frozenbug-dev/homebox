import { TabStack } from '@/components/tab-stack'

export const unstable_settings = { initialRouteName: 'index' }

export default function Layout() {
  return <TabStack root="index" title="Items" />
}
