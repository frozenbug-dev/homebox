<script setup lang="ts">
  import { Check, Search } from "@lucide/vue";
  import { ContextMenuPortal } from "reka-ui";
  import {
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
  } from "@/components/ui/context-menu";
  import ShortcutHint from "~/components/App/ShortcutHint.vue";
  import type { ActionMenuEntry, ActionMenuItem } from "./types";

  /**
   * The inside of a context menu (or of one of its submenus) that you can
   * search by just typing, like Linear's: the search line only appears once you
   * type. At the top level the search also finds what's inside the submenus
   * ("Move to › Garage"). Backspace edits the search, Escape clears it.
   *
   * Put it in a <ContextMenuContent>; it renders its own submenus.
   */
  const props = defineProps<{
    entries: ActionMenuEntry[];
    /** A long list (places, tags): scrolls inside a fixed height. */
    scroll?: boolean;
  }>();

  const root = useTemplateRef<HTMLElement>("root");
  const query = ref("");
  /** Mod+A "selected" the search text: the next key replaces or deletes all of it. */
  const allSelected = ref(false);

  const matches = (item: ActionMenuItem, q: string) =>
    `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`.toLowerCase().includes(q);

  type Row = { key: string; item: ActionMenuItem; prefix?: string };

  /** While searching: matching rows, then matching rows from each submenu. */
  const results = computed<Row[]>(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return [];
    const out: Row[] = [];
    for (const e of props.entries)
      if ((e.kind ?? "item") === "item" && matches(e as ActionMenuItem, q)) {
        out.push({ key: (e as ActionMenuItem).id, item: e as ActionMenuItem });
      }
    for (const e of props.entries) {
      if (e.kind !== "sub") continue;
      for (const child of e.entries) {
        if (matches(child, q)) out.push({ key: `${e.id}:${child.id}`, item: child, prefix: e.label });
      }
    }
    return out;
  });

  function select(item: ActionMenuItem, e: Event) {
    if (item.keepOpen) e.preventDefault();
    item.onSelect();
  }

  /** Typing goes to the search instead of the menu's own "jump to first letter". */
  function onKeydown(e: KeyboardEvent) {
    // Keys pressed in a nested submenu belong to that submenu's search.
    if ((e.target as Element).closest("[role=menu]") !== menuEl) return;
    const mod = e.metaKey || e.ctrlKey;

    let handled = true;
    // Mod+A selects the typed text, like in a text field, instead of reaching the list's "select all".
    if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "a") allSelected.value = !!query.value;
    // Mod/Alt+Backspace delete everything / the last word.
    else if (e.key === "Backspace" && query.value && (mod || allSelected.value)) query.value = "";
    else if (e.key === "Backspace" && query.value && e.altKey) query.value = query.value.replace(/\S*\s*$/, "");
    else if (mod || e.altKey) handled = false;
    else if (e.key === "Backspace" && query.value) query.value = query.value.slice(0, -1);
    else if (e.key === "Escape" && query.value) query.value = "";
    else if (e.key.length === 1 && (e.key !== " " || query.value)) {
      // Typing over a selection replaces it.
      query.value = (allSelected.value ? "" : query.value) + e.key;
    } else handled = false;

    // Any other key drops the selection, as moving the caret would.
    const modifierOnly = ["Shift", "Meta", "Control", "Alt"].includes(e.key);
    if (!modifierOnly && !(mod && e.key.toLowerCase() === "a")) allSelected.value = false;

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Listen on the menu element itself: right after opening, it (not an item) has focus.
  let menuEl: HTMLElement | null = null;
  onMounted(() => {
    menuEl = root.value?.closest<HTMLElement>("[role=menu]") ?? null;
    menuEl?.addEventListener("keydown", onKeydown, { capture: true });
  });
  onBeforeUnmount(() => menuEl?.removeEventListener("keydown", onKeydown, { capture: true }));

  // Keep the keyboard on the first result as the list changes. Re-rendering removes the focused
  // item, so with no results fall back to the menu itself: focus left on <body> would send the
  // next keystrokes past the search to the app's global shortcuts.
  watch(query, () =>
    nextTick(() => {
      const first = root.value?.querySelector<HTMLElement>("[role=menuitem]:not([data-disabled])");
      (first ?? menuEl)?.focus();
    })
  );

  const itemClass = (item: ActionMenuItem) =>
    item.destructive ? "text-destructive focus:text-destructive [&_svg]:text-destructive" : "";
</script>

<template>
  <div ref="root" data-action-menu>
    <template v-if="query">
      <div class="flex h-8 items-center gap-2 px-2 text-sm" aria-live="polite">
        <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="truncate" :class="{ 'rounded-xs bg-primary/20': allSelected }">{{ query }}</span>
        <span class="-ml-1.5 h-4 w-px shrink-0 animate-pulse bg-foreground" aria-hidden="true" />
      </div>
      <ContextMenuSeparator />
      <div class="max-h-72 overflow-y-auto">
        <ContextMenuItem
          v-for="row in results"
          :key="row.key"
          :class="itemClass(row.item)"
          @select="e => select(row.item, e)"
        >
          <span
            v-if="row.item.color !== undefined"
            class="mx-[3px] size-2.5 shrink-0 rounded-full"
            :class="{ 'bg-muted-foreground/40': !row.item.color }"
            :style="row.item.color ? { backgroundColor: row.item.color } : undefined"
            aria-hidden="true"
          />
          <component :is="row.item.icon" v-else-if="row.item.icon" class="text-muted-foreground" />
          <span v-if="row.prefix" class="shrink-0 text-muted-foreground">{{ row.prefix }} ›</span>
          <span class="truncate">{{ row.item.label }}</span>
          <Check v-if="row.item.checked" class="ml-auto text-foreground" />
        </ContextMenuItem>
        <p v-if="!results.length" class="px-2 py-3 text-center text-sm text-muted-foreground">
          {{ $t("shell.palette.no_results") }}
        </p>
      </div>
    </template>

    <div v-else :class="{ 'max-h-72 overflow-y-auto': scroll }">
      <template v-for="(entry, i) in entries" :key="entry.kind === 'separator' ? `sep-${i}` : entry.id">
        <ContextMenuSeparator v-if="entry.kind === 'separator'" />
        <ContextMenuSub v-else-if="entry.kind === 'sub'">
          <ContextMenuSubTrigger class="gap-2 [&>svg]:size-4 [&>svg]:shrink-0">
            <component :is="entry.icon" v-if="entry.icon" class="text-muted-foreground" />
            {{ entry.label }}
          </ContextMenuSubTrigger>
          <ContextMenuPortal>
            <ContextMenuSubContent class="w-60">
              <ActionMenuBody :entries="entry.entries" scroll />
            </ContextMenuSubContent>
          </ContextMenuPortal>
        </ContextMenuSub>
        <ContextMenuItem v-else :class="itemClass(entry)" @select="e => select(entry, e)">
          <span
            v-if="entry.color !== undefined"
            class="mx-[3px] size-2.5 shrink-0 rounded-full"
            :class="{ 'bg-muted-foreground/40': !entry.color }"
            :style="entry.color ? { backgroundColor: entry.color } : undefined"
            aria-hidden="true"
          />
          <component :is="entry.icon" v-else-if="entry.icon" :class="{ 'text-muted-foreground': !entry.destructive }" />
          <span class="truncate">{{ entry.label }}</span>
          <span v-if="entry.hint" class="ml-auto max-w-28 shrink-0 truncate pl-2 text-xs text-muted-foreground">
            {{ entry.hint }}
          </span>
          <Check v-if="entry.checked" class="text-foreground" :class="{ 'ml-auto': !entry.hint }" />
          <ShortcutHint v-if="entry.hotkey" :hotkey="entry.hotkey" class="ml-auto" />
        </ContextMenuItem>
      </template>
    </div>
  </div>
</template>
