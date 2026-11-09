import type { Directive } from "vue";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

/**
 * What can be dragged around the app: one or more items (rows of an item
 * list) or a single place (a row of the places tree).
 */
export type DragData = { kind: "items"; ids: string[] } | { kind: "place"; id: string };
export type DropData = { kind: "place"; id: string } | { kind: "top-level" };

export function isDragData(data: Record<string | symbol, unknown>): data is DragData {
  return data.kind === "items" || data.kind === "place";
}

type DragSourceBinding = (() => DragData) | null;
type DropTargetBinding = { data: DropData; canDrop?: (source: DragData) => boolean } | null;

type Registration<T> = { cleanup: () => void; value: T };
/** An element can be both a drag source and a drop target, so each keeps its own slot. */
type DndElement = HTMLElement & {
  __dragSource?: Registration<DragSourceBinding>;
  __dropTarget?: Registration<DropTargetBinding>;
};

/**
 * `v-drag-source="() => ({ kind: 'items', ids })"` makes an element draggable.
 * The getter runs when the drag starts, so it can read the current selection.
 * Pass `null` to turn dragging off.
 */
export const vDragSource: Directive<DndElement, DragSourceBinding> = {
  mounted(el, { value }) {
    el.__dragSource = {
      value,
      cleanup: draggable({
        element: el,
        canDrag: () => !!el.__dragSource?.value,
        getInitialData: () => el.__dragSource?.value?.() ?? {},
      }),
    };
  },
  updated(el, { value }) {
    if (el.__dragSource) el.__dragSource.value = value;
  },
  unmounted(el) {
    el.__dragSource?.cleanup();
  },
};

/**
 * `v-drop-target="{ data: { kind: 'place', id }, canDrop }"` accepts drops.
 * What happens on drop is handled by a `monitorForElements` on the page.
 */
export const vDropTarget: Directive<DndElement, DropTargetBinding> = {
  mounted(el, { value }) {
    el.__dropTarget = {
      value,
      cleanup: dropTargetForElements({
        element: el,
        getData: () => el.__dropTarget?.value?.data ?? {},
        canDrop: ({ source }) => {
          const binding = el.__dropTarget?.value;
          if (!binding || !isDragData(source.data)) return false;
          return binding.canDrop?.(source.data) ?? true;
        },
      }),
    };
  },
  updated(el, { value }) {
    if (el.__dropTarget) el.__dropTarget.value = value;
  },
  unmounted(el) {
    el.__dropTarget?.cleanup();
  },
};
