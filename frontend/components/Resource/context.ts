import type { ComputedRef, InjectionKey } from "vue";

/**
 * What a <ResourceList> shares with the <ResourceRow>s inside it, so rows know
 * whether they are selected or focused without being passed props, and report
 * clicks back to the list (which owns selection, focus and the range anchor).
 */
export type ResourceListContext = {
  isSelected: (key: string) => boolean;
  isFocused: (key: string) => boolean;
  isMenuOpen: (key: string) => boolean;
  /** Anything selected: rows then show their checkboxes. */
  hasSelection: ComputedRef<boolean>;
  selectable: ComputedRef<boolean>;
  /** DOM id of a row, for aria-activedescendant. */
  rowId: (key: string) => string;
  focus: (key: string) => void;
  /** The pointer entered a row: it becomes the active row until the pointer leaves the list. */
  hover: (key: string) => void;
  toggle: (key: string) => void;
  /** ⇧-click: select from the anchor to this row. */
  extendTo: (key: string) => void;
  open: (key: string) => void;
  /** What a row's context menu acts on: the selection if the row is in it, otherwise the row alone. */
  targetsFor: (key: string) => unknown[];
  setMenuOpen: (key: string, open: boolean) => void;
  clear: () => void;
};

export const resourceListKey: InjectionKey<ResourceListContext> = Symbol("resource-list");

export function useResourceListContext() {
  const ctx = inject(resourceListKey, null);
  if (!ctx) throw new Error("<ResourceRow> must be used inside a <ResourceList>");
  return ctx;
}

/** Set by a list whose data isn't in the ["entities"] query cache, so row actions can ask it to reload. */
export const resourceChangedKey: InjectionKey<() => void> = Symbol("resource-changed");
