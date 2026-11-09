import { useI18n } from "vue-i18n";
import { useQueryClient } from "@tanstack/vue-query";
import type { EntitySummary, TagSummary } from "~/lib/api/types/data-contracts";
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

  /** Move several items into a place at once (the context menu's "Move to" submenu). */
  function moveAllTo(items: EntitySummary[], place: { id: string; name: string }) {
    const moving = items.filter(i => i.parent?.id !== place.id);
    if (!moving.length) return;
    let left = moving.length;
    for (const item of moving) {
      patch(
        {
          patch: { id: item.id, parentId: place.id },
          optimistic: { parent: { ...(item.parent ?? item), id: place.id, name: place.name } },
        },
        {
          onSuccess: () => {
            if (--left > 0) return;
            toast.success(t("shell.items_page.moved_to", { place: place.name }));
            clear?.();
            changed?.();
          },
        }
      );
    }
  }

  /** Add a tag to every item, or take it off all of them when they all have it already. */
  function toggleTag(items: EntitySummary[], tag: TagSummary) {
    const all = items.every(i => i.tags.some(x => x.id === tag.id));
    for (const item of items) {
      const tags = all ? item.tags.filter(x => x.id !== tag.id) : [...item.tags.filter(x => x.id !== tag.id), tag];
      patch(
        { patch: { id: item.id, tagIds: tags.map(x => x.id) }, optimistic: { tags } },
        { onSuccess: () => changed?.() }
      );
    }
  }

  function setQuantity(item: EntitySummary, quantity: number) {
    if (quantity >= 0)
      patch({ patch: { id: item.id, quantity }, optimistic: { quantity } }, { onSuccess: () => changed?.() });
  }

  function setTags(item: EntitySummary, tags: TagSummary[]) {
    patch(
      { patch: { id: item.id, tagIds: tags.map(x => x.id) }, optimistic: { tags } },
      { onSuccess: () => changed?.() }
    );
  }

  function setPrice(item: EntitySummary, purchasePrice: number) {
    if (purchasePrice >= 0)
      patch({ patch: { id: item.id, purchasePrice }, optimistic: { purchasePrice } }, { onSuccess: () => changed?.() });
  }

  /** Edit an item's quantity or price in a dialog (the context menu's "Change …" entries). */
  function editNumber(item: EntitySummary, field: "quantity" | "purchasePrice") {
    openDialog(DialogID.ItemEditNumber, { params: { item, field }, onClose: saved => saved && changed?.() });
  }

  return {
    editNumber,
    move,
    tag,
    print,
    duplicate,
    copyLink,
    remove,
    moveTo,
    moveAllTo,
    toggleTag,
    setTags,
    setQuantity,
    setPrice,
  };
}
