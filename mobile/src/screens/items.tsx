import { ActionFab, FAB_SPACE } from '@/components/action-fab'
import { EntityList } from '@/components/entity-list'
import { TabScreen } from '@/components/search-app-bar'

export default function ItemsScreen() {
  return (
    <TabScreen>
      <EntityList filters={{}} bottomSpace={FAB_SPACE} emptyTitle="No items yet" emptyMessage="Items you add show up here." />
      <ActionFab />
    </TabScreen>
  )
}
