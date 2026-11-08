/**
 * Every global keyboard shortcut, in one place, so hints and the "?" cheatsheet
 * stay in sync with what is actually registered. Hotkey syntax is TanStack
 * Hotkeys': "Mod" is ⌘ on macOS and Ctrl elsewhere; an array is a sequence.
 */
export const SHORTCUTS = {
  commandPalette: "Mod+K",
  newItem: "N",
  newPlace: "Shift+N",
  scan: "S",
  help: "?",
  goHome: ["G", "H"],
  goItems: ["G", "I"],
  goPlaces: ["G", "P"],
  goTags: ["G", "T"],
  // Items list
  listDown: "J",
  listUp: "K",
  listOpen: "Enter",
  listSelect: "X",
  listExtendDown: "Shift+J",
  listExtendUp: "Shift+K",
  listSelectAll: "Mod+A",
  selectionMove: "M",
  selectionTag: "T",
  selectionPrint: "P",
  selectionClear: "Escape",
  // Item page
  itemPrevious: "ArrowUp",
  itemNext: "ArrowDown",
  itemMove: "M",
  itemPrint: "P",
  itemDuplicate: "D",
  // Places page
  placeAddInside: "A",
  placeRename: "R",
  placePrint: "P",
} as const;

export type ShortcutGroup = "general" | "navigation" | "list" | "item" | "places";
