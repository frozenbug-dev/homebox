<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Check, GripVertical } from "@lucide/vue";
  import { vDragSource, type DragData } from "~/lib/dnd";
  import { cn } from "@/lib/utils";
  import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
  import { useResourceListContext } from "./context";

  /**
   * One row of a <ResourceList>: a selection box, a `left` and a `right` slot,
   * and an optional context menu (`menu` slot, given what it acts on; opened by
   * right-click, long-press or the keyboard). ⌘/Ctrl/⌥-click selects.
   * Selection, focus and opening are handled by the list.
   */
  const props = defineProps<{
    /** The key the list knows this row by. */
    id: string;
    /** Makes the row draggable (e.g. onto places); shows a ⋮⋮ grip in the selection box. */
    dragData?: () => DragData;
    class?: string;
  }>();

  defineSlots<{
    left(): unknown;
    right(): unknown;
    menu(props: { targets: unknown[] }): unknown;
  }>();

  const { t } = useI18n();
  const list = useResourceListContext();

  const selected = computed(() => list.isSelected(props.id));
  const focused = computed(() => list.isFocused(props.id));
  const menuOpen = computed(() => list.isMenuOpen(props.id));
  const menuTargets = ref<unknown[]>([]);

  /** Clicks on controls inside the row (links, pickers, buttons) don't open it. */
  const INTERACTIVE = "a,button,input,textarea,select,label,[role=button],[role=combobox],[data-row-ignore]";

  /** Runs before the row's children see the click, so ⌘/⇧-clicks never trigger a link or control. */
  function onClickCapture(e: MouseEvent) {
    if (e.button !== 0 || !list.selectable.value) return;
    const box = (e.target as Element).closest("[data-row-select]");
    if (e.shiftKey) list.extendTo(props.id);
    else if (e.metaKey || e.ctrlKey || e.altKey || box) list.toggle(props.id);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  /** On a Mac, Ctrl-click arrives as a context menu (left button): select instead, like ⌘-click. */
  function onContextMenuCapture(e: MouseEvent) {
    if (!e.ctrlKey || e.button !== 0 || !list.selectable.value) return;
    list.toggle(props.id);
    e.preventDefault();
    e.stopPropagation();
  }

  function onClick(e: MouseEvent) {
    const control = (e.target as Element).closest(INTERACTIVE);
    if (e.defaultPrevented || (control && control !== e.currentTarget)) return;
    list.open(props.id);
  }

  function onMenuOpen(open: boolean) {
    if (open) menuTargets.value = list.targetsFor(props.id);
    list.setMenuOpen(props.id, open);
  }
</script>

<template>
  <ContextMenu @update:open="onMenuOpen">
    <ContextMenuTrigger as-child :disabled="!$slots.menu">
      <div
        :id="list.rowId(id)"
        v-drag-source="dragData ?? null"
        role="row"
        :aria-selected="list.selectable.value ? selected : undefined"
        :class="
          cn(
            'group/row flex h-full cursor-pointer items-center gap-3 rounded-md pr-3 pl-1 select-none',
            focused || menuOpen ? 'bg-muted/70' : 'hover:bg-muted/70',
            selected && 'bg-primary/8 hover:bg-primary/12',
            selected && (focused || menuOpen) && 'bg-primary/12',
            props.class
          )
        "
        @click.capture="onClickCapture"
        @contextmenu.capture="onContextMenuCapture"
        @click="onClick"
        @mousedown="e => e.shiftKey && e.preventDefault()"
        @mouseenter="list.hover(id)"
      >
        <span
          v-if="list.selectable.value"
          role="gridcell"
          data-row-select
          class="flex size-7 shrink-0 items-center justify-center"
          :aria-label="t('components.item.view.selectable.select_card')"
        >
          <GripVertical
            v-if="dragData && !list.hasSelection.value && !focused"
            class="size-3.5 cursor-grab text-muted-foreground/50 group-hover/row:hidden pointer-coarse:hidden"
            aria-hidden="true"
          />
          <span
            class="size-4 items-center justify-center rounded-[4px] border shadow-xs transition-colors"
            :class="[
              selected ? 'flex border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
              !selected &&
                (list.hasSelection.value || focused
                  ? 'flex'
                  : dragData
                    ? 'hidden group-hover/row:flex pointer-coarse:flex'
                    : 'flex opacity-0 group-hover/row:opacity-100 pointer-coarse:opacity-100'),
            ]"
            aria-hidden="true"
          >
            <Check v-if="selected" class="size-3" :stroke-width="3" />
          </span>
        </span>
        <span v-else class="w-1 shrink-0" />

        <span role="gridcell" class="flex min-w-0 flex-1 items-center gap-2.5">
          <slot name="left" />
        </span>
        <span
          v-if="$slots.right"
          role="gridcell"
          class="flex shrink-0 items-center gap-3 text-[13px] text-muted-foreground"
        >
          <slot name="right" />
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent v-if="$slots.menu" class="w-56">
      <slot name="menu" :targets="menuTargets" />
    </ContextMenuContent>
  </ContextMenu>
</template>
