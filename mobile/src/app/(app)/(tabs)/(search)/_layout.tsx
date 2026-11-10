import { TabStack } from '@/components/tab-stack'

export const unstable_settings = { anchor: 'search' }

export default function Layout() {
  return <TabStack root="search" title="Search" />
}
