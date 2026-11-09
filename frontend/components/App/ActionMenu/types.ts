import type { Component } from "vue";
import type { RegisterableHotkey } from "@tanstack/vue-hotkeys";

/** One choosable row of an <ActionMenuBody>. */
export type ActionMenuItem = {
  kind?: "item";
  id: string;
  label: string;
  icon?: Component;
  /** A colour dot in place of the icon (tags). */
  color?: string;
  /** Muted text after the label, e.g. a place's parents. Also searched. */
  hint?: string;
  /** Extra words that should find this row when searching. */
  keywords?: string;
  hotkey?: RegisterableHotkey;
  destructive?: boolean;
  /** Shows a check mark; for toggles such as tags. */
  checked?: boolean;
  /** Keep the menu open after choosing (toggles). */
  keepOpen?: boolean;
  onSelect: () => void;
};

/** A submenu (e.g. "Move to" → places) that can be searched on its own, and from the top level. */
export type ActionMenuSub = {
  kind: "sub";
  id: string;
  label: string;
  icon?: Component;
  entries: ActionMenuItem[];
};

export type ActionMenuEntry = ActionMenuItem | ActionMenuSub | { kind: "separator" };
