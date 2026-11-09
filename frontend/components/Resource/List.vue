<script setup lang="ts" generic="T">
  import { useI18n } from "vue-i18n";
  import { useWindowVirtualizer } from "@tanstack/vue-virtual";
  import { useHotkey } from "@tanstack/vue-hotkeys";
  import { SHORTCUTS } from "~/lib/shortcuts";
  import { emptySelection, prune, selectAll, selectRange, toggle, type SelectionState } from "~/lib/selection";
  import { resourceListKey } from "./context";

  /**
   * A keyboard-driven list of <ResourceRow>s (Linear-style). It owns focus and
   * selection; rows only render. Render each row in the default slot:
   *
   *   <ResourceList :items="items" :get-key="i => i.id" :to="i => `/item/${i.id}`">
   *     <template #default="{ item }"><ItemResource :item="item" /></template>
   *   </ResourceList>
   *
   * Mouse: click opens, ⌘/Ctrl/⌥-click toggles one row, ⇧-click selects a range.
   * Keys anywhere on the page: J/K move, ⇧J/⇧K extend, X toggles, Enter opens,
   * ⌘A selects all, Esc clears. With the list focused: ↑/↓ (and ⇧), Home/End,
   * Space toggles, ⇧F10 or the menu key opens the row's context menu.
   */
  const props = withDefaults(
    defineProps<{
      items: T[];
      getKey: (item: T) => string;
      /** Where a row leads; used by click and Enter. Return nothing for rows that don't open. */
      to?: (item: T) => string | undefined;
      label: string;
      /** Window-scroll virtualization, for long (infinite) lists. */
      virtual?: boolean;
      /** The row height; with `autoHeight`, the minimum (and the virtualizer's first guess). */
      rowHeight?: number;
      /**
       * Rows grow to fit their content, e.g. stacked rows (`<ResourceRow stack>`)
       * that wrap onto a second line in a narrow list; virtualized rows are measured.
       */
      autoHeight?: boolean;
      selectable?: boolean;
      /** Register the page-wide shortcuts (turn off when another list owns them). */
      hotkeys?: boolean;
      hasNextPage?: boolean;
      isFetchingNextPage?: boolean;
    }>(),
    { to: undefined, rowHeight: 40, selectable: true, hotkeys: true }
  );
  const emit = defineEmits<{ loadMore: []; open: [item: T] }>();

  defineSlots<{
    default(props: { item: T; index: number }): unknown;
    /** e.g. a floating action bar; only rendered while something is selected. */
    selection(props: { items: T[]; clear: () => void }): unknown;
  }>();

  const { t } = useI18n();
  const router = useRouter();

  const keys = computed(() => props.items.map(props.getKey));
  const indexOf = computed(() => new Map(keys.value.map((k, i) => [k, i])));
  const byKey = computed(() => new Map(props.items.map(item => [props.getKey(item), item])));

  // ----- Selection -----

  const selection = shallowRef<SelectionState>(emptySelection());
  watch(keys, k => (selection.value = prune(selection.value, k)));

  const selectedItems = computed(() => props.items.filter(i => selection.value.selected.has(props.getKey(i))));
  const hasSelection = computed(() => selection.value.selected.size > 0);

  const toggleKey = (key: string) => props.selectable && (selection.value = toggle(selection.value, key));
  const extendTo = (key: string) =>
    props.selectable && (selection.value = selectRange(selection.value, keys.value, key));
  const clear = () => (selection.value = emptySelection());

  // ----- Focus (one "active" row, moved by keys and by hovering) -----

  const focused = ref<string | null>(null);
  /** The active row came from hovering (not the keyboard), so it's dropped when the pointer leaves. */
  const focusedByPointer = ref(false);
  watch(focused, () => (focusedByPointer.value = false), { flush: "sync" });
  function hover(key: string) {
    focused.value = key;
    focusedByPointer.value = true;
  }
  function onPointerLeave() {
    if (focusedByPointer.value && !menuKey.value) focused.value = null;
  }
  const focusedIndex = computed(() => (focused.value ? (indexOf.value.get(focused.value) ?? -1) : -1));
  watch(keys, k => {
    if (focused.value && !indexOf.value.has(focused.value))
      focused.value = k[Math.min(focusedIndex.value, k.length - 1)] ?? null;
  });

  function focusIndex(index: number, { extend = false } = {}) {
    if (!keys.value.length) return;
    const i = Math.max(0, Math.min(index, keys.value.length - 1));
    const key = keys.value[i]!;
    if (extend) {
      // Start the range at the row we're leaving if nothing anchors it yet.
      if (selection.value.anchor === null && focused.value) selection.value = toggle(selection.value, focused.value);
      extendTo(key);
    }
    focused.value = key;
    scrollTo(i);
  }
  const step = (delta: number, extend = false) =>
    focusIndex(focusedIndex.value < 0 ? 0 : focusedIndex.value + delta, { extend });

  function open(key: string) {
    const item = byKey.value.get(key);
    if (!item) return;
    emit("open", item);
    const to = props.to?.(item);
    if (to) router.push(to);
  }

  /** The selection, or else the focused row: what M / T / P act on. */
  function target(): T[] {
    if (selectedItems.value.length) return selectedItems.value;
    const item = focused.value ? byKey.value.get(focused.value) : undefined;
    return item ? [item] : [];
  }

  // ----- Context menus -----

  const menuKey = ref<string | null>(null);
  let refocusAfterMenu = false;

  function setMenuOpen(key: string, isOpen: boolean) {
    if (isOpen) {
      menuKey.value = key;
      focused.value = key;
    } else if (menuKey.value === key) {
      menuKey.value = null;
      // Closed with the pointer elsewhere: don't leave the row looking hovered.
      if (!refocusAfterMenu && !listEl.value?.matches(":hover")) focused.value = null;
      if (refocusAfterMenu) nextTick(() => listEl.value?.focus());
      refocusAfterMenu = false;
    }
  }

  /** Open the focused row's menu from the keyboard, as if it were right-clicked. */
  function openMenu() {
    if (!focused.value) return;
    const row = document.getElementById(rowId(focused.value));
    if (!row) return;
    const rect = row.getBoundingClientRect();
    refocusAfterMenu = true;
    row.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + 48, clientY: rect.bottom })
    );
  }

  // ----- Virtualization -----

  const listEl = ref<HTMLElement | null>(null);
  const scrollMargin = ref(0);
  const virtualizer = useWindowVirtualizer(
    computed(() => ({
      count: props.virtual ? props.items.length : 0,
      estimateSize: () => props.rowHeight,
      // Keyed by item, so measured heights follow rows when the list reorders
      getItemKey: (index: number) => keys.value[index] ?? index,
      overscan: 12,
      scrollMargin: scrollMargin.value,
    }))
  );
  const measure = () => {
    if (listEl.value) scrollMargin.value = listEl.value.getBoundingClientRect().top + window.scrollY;
  };
  onMounted(measure);
  useResizeObserver(listEl, measure);

  /** Fixed rows get the height; auto rows get it as a minimum (their `grid` wrapper stretches the row to fill it;
   * its one column is `minmax(0,1fr)` so a long row truncates instead of widening past the list). */
  const rowSize = computed(() =>
    props.autoHeight ? { minHeight: `${props.rowHeight}px` } : { height: `${props.rowHeight}px` }
  );

  const virtualRows = computed(() => (props.virtual ? virtualizer.value.getVirtualItems() : []));
  watch(virtualRows, rows => {
    const last = rows[rows.length - 1];
    if (last && last.index >= props.items.length - 15 && props.hasNextPage && !props.isFetchingNextPage) {
      emit("loadMore");
    }
  });

  function scrollTo(index: number) {
    if (props.virtual) virtualizer.value.scrollToIndex(index, { align: "auto" });
    else document.getElementById(rowId(keys.value[index]!))?.scrollIntoView({ block: "nearest" });
  }

  // ----- Keyboard -----

  const meta = (name: string) => ({ meta: { name: t(name), group: "list" as const } });
  const on = () => props.hotkeys;

  useHotkey(SHORTCUTS.listDown, () => step(1), { ...meta("shell.shortcuts.list_down"), enabled: on });
  useHotkey(SHORTCUTS.listUp, () => step(-1), { ...meta("shell.shortcuts.list_up"), enabled: on });
  useHotkey(SHORTCUTS.listExtendDown, () => step(1, true), {
    ...meta("shell.shortcuts.list_extend_down"),
    enabled: () => on() && props.selectable,
  });
  useHotkey(SHORTCUTS.listExtendUp, () => step(-1, true), {
    ...meta("shell.shortcuts.list_extend_up"),
    enabled: () => on() && props.selectable,
  });
  useHotkey(SHORTCUTS.listOpen, () => focused.value && open(focused.value), {
    ...meta("shell.shortcuts.list_open"),
    enabled: () => on() && !!focused.value,
  });
  useHotkey(SHORTCUTS.listSelect, () => focused.value && toggleKey(focused.value), {
    ...meta("shell.shortcuts.list_select"),
    enabled: () => on() && props.selectable && !!focused.value,
  });
  useHotkey(SHORTCUTS.listSelectAll, () => (selection.value = selectAll(keys.value)), {
    ...meta("shell.shortcuts.list_select_all"),
    enabled: () => on() && props.selectable && keys.value.length > 0,
    ignoreInputs: true,
  });
  // Escape belongs to whatever overlay is on top (dialog, menu, popover). This listener runs
  // before Reka's, so let the event through and only clear when no dismissable layer is open.
  useHotkey(
    SHORTCUTS.selectionClear,
    () => {
      if (!document.querySelector("[data-dismissable-layer]")) clear();
    },
    {
      ...meta("shell.shortcuts.selection_clear"),
      enabled: () => on() && hasSelection.value,
      preventDefault: false,
      stopPropagation: false,
    }
  );

  /** Keys that only apply while the list itself has focus (so they don't clash with the page's). */
  function onKeydown(e: KeyboardEvent) {
    const handled = (() => {
      switch (e.key) {
        case "ArrowDown":
          step(1, e.shiftKey);
          return true;
        case "ArrowUp":
          step(-1, e.shiftKey);
          return true;
        case "Home":
          focusIndex(0, { extend: e.shiftKey });
          return true;
        case "End":
          focusIndex(keys.value.length - 1, { extend: e.shiftKey });
          return true;
        case " ":
          if (focused.value) toggleKey(focused.value);
          return true;
        case "ContextMenu":
          openMenu();
          return true;
        case "F10":
          if (!e.shiftKey) return false;
          openMenu();
          return true;
        default:
          return false;
      }
    })();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onFocus() {
    if (!focused.value && keys.value.length) focused.value = keys.value[0]!;
  }

  // ----- Shared with rows -----

  const uid = useId();
  const rowId = (key: string) => `${uid}-row-${key}`;

  provide(resourceListKey, {
    isSelected: key => selection.value.selected.has(key),
    isFocused: key => focused.value === key,
    isMenuOpen: key => menuKey.value === key,
    hasSelection,
    selectable: computed(() => props.selectable),
    rowId,
    focus: key => (focused.value = key),
    hover,
    toggle: toggleKey,
    extendTo,
    open,
    targetsFor: key => {
      if (selection.value.selected.has(key)) return selectedItems.value;
      const item = byKey.value.get(key);
      return item ? [item] : [];
    },
    setMenuOpen,
    clear,
  });

  defineExpose({
    target,
    clear,
    selectedItems,
    hasTarget: computed(() => target().length > 0),
  });
</script>

<template>
  <div>
    <div
      ref="listEl"
      role="grid"
      tabindex="0"
      :aria-label="label"
      :aria-multiselectable="selectable || undefined"
      :aria-rowcount="items.length"
      :aria-activedescendant="focused ? rowId(focused) : undefined"
      class="@container/list relative px-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
      :style="virtual ? { height: `${virtualizer.getTotalSize()}px` } : undefined"
      @keydown="onKeydown"
      @focus="onFocus"
      @mouseleave="onPointerLeave"
    >
      <template v-if="virtual">
        <div
          v-for="vRow in virtualRows"
          :key="keys[vRow.index]"
          :ref="autoHeight ? el => virtualizer.measureElement(el as HTMLElement | null) : undefined"
          :data-index="vRow.index"
          class="absolute inset-x-1.5 top-0"
          :class="autoHeight && 'grid grid-cols-[minmax(0,1fr)]'"
          :style="{
            ...rowSize,
            transform: `translateY(${vRow.start - virtualizer.options.scrollMargin}px)`,
          }"
        >
          <slot :item="items[vRow.index]!" :index="vRow.index" />
        </div>
      </template>
      <template v-else>
        <div
          v-for="(item, index) in items"
          :key="keys[index]"
          :class="autoHeight && 'grid grid-cols-[minmax(0,1fr)]'"
          :style="rowSize"
        >
          <slot :item="item" :index="index" />
        </div>
      </template>
    </div>
    <slot v-if="selectedItems.length" name="selection" :items="selectedItems" :clear="clear" />
  </div>
</template>
