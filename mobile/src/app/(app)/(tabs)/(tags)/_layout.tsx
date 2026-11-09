import { TabStack } from '@/components/tab-stack'

export const unstable_settings = { anchor: 'tags' }

export default function Layout() {
  return <TabStack root="tags" title="Tags" />
}
