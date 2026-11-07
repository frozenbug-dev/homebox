import { useI18n } from "vue-i18n";
import { useQueryClient } from "@tanstack/vue-query";
import type { EntitySummary } from "~/lib/api/types/data-contracts";
import { toast } from "@/components/ui/sonner";
import { useDialog } from "@/components/ui/dialog-provider";
import { DialogID } from "@/components/ui/dialog-provider/utils";

/**
 * What can be done to one or more items from a list: the context menu, the
 * selection bar and the M / T / P shortcuts all call these.
 *
 * - `clear` runs after a bulk action (to clear the list's selection).
 * - `changed` runs after anything changed, for lists that don't load through
 *   the ["entities"] query cache and need a manual refresh.
 */
export function useItemActions({ clear, changed }: { clear?: () => void; changed?: () => void } = {}) {
  const { t } = useI18n();
  const api = useUserApi();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const preferences = useViewPreferences();
  const { openDialog } = useDialog();
  const { mutate: patch } = usePatchEntity();

  const refresh = () => {
    clear?.();
    changed?.();
    queryClient.invalidateQueries({ queryKey: ["entities"] });
  };

  function move(items: EntitySummary[]) {
    if (items.length)
      openDialog(DialogID.ItemChangeDetails, { params: { items, changeLocation: true }, onClose: refresh });
  }

  function tag(items: EntitySummary[]) {
    if (items.length) openDialog(DialogID.ItemChangeDetails, { params: { items, addTags: true }, onClose: refresh });
  }

  function print(items: EntitySummary[]) {
    if (items.length) openDialog(DialogID.PrintLabelTemplate, { params: { itemIds: items.map(i => i.id) } });
  }

  async function duplicate(item: EntitySummary) {
    const settings = preferences.value.duplicateSettings;
    const { data, error } = await api.items.duplicate(item.id, {
      copyMaintenance: settings.copyMaintenance,
      copyAttachments: settings.copyAttachments,
      copyCustomFields: settings.copyCustomFields,
      copyPrefix: settings.copyPrefixOverride ?? t("items.duplicate.prefix"),
    });
    if (error) {
      toast.error(t("items.toast.failed_duplicate_item"));
      return;
    }
    refresh();
    navigateTo(`/item/${data.id}`);
  }

  async function copyLink(item: EntitySummary) {
    await navigator.clipboard.writeText(`${window.location.origin}/item/${item.id}`);
    toast.success(t("shell.resource.link_copied"));
  }

  async function remove(items: EntitySummary[]) {
    if (!items.length) return;
    const { isCanceled } = await confirm.open(t("shell.items_page.delete_confirm", { n: items.length }));
    if (isCanceled) return;
    await Promise.all(items.map(i => api.items.delete(i.id)));
    toast.success(t("shell.items_page.deleted", { n: items.length }));
    refresh();
  }

  function moveTo(item: EntitySummary, place: FlatTreeItem) {
    patch(
      {
        patch: { id: item.id, parentId: place.id },
        optimistic: { parent: { ...(item.parent ?? item), id: place.id, name: place.name } },
      },
      {
        onSuccess: () => {
          toast.success(t("shell.items_page.moved_to", { place: place.name }));
          changed?.();
        },
      }
    );
  }

  function setQuantity(item: EntitySummary, quantity: number) {
    if (quantity >= 0)
      patch({ patch: { id: item.id, quantity }, optimistic: { quantity } }, { onSuccess: () => changed?.() });
  }

  return { move, tag, print, duplicate, copyLink, remove, moveTo, setQuantity };
}
