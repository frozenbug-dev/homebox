<script setup lang="ts">
  import type { ContextMenuRootEmits, ContextMenuRootProps } from "reka-ui";
  import { reactiveOmit, useVModel } from "@vueuse/core";
  import { ContextMenuRoot, useForwardProps } from "reka-ui";

  const props = defineProps<ContextMenuRootProps>();
  const emits = defineEmits<ContextMenuRootEmits>();

  const forwarded = useForwardProps(reactiveOmit(props, "open"));
  const open = useVModel(props, "open", emits, { passive: true, defaultValue: false });

  /*
   * A click outside an open menu only closes it, like a native context menu.
   * Without this the click also lands on whatever is under it: reka keeps every
   * trigger (each list row) clickable through its body pointer-events lock, and
   * on touch it closes the menu on the `click` itself, so tapping beside the
   * menu would also open the row there.
   *
   * A left-button pointerdown outside the menu arms the guard; the click that
   * follows is swallowed before anything sees it (window, capture phase), and
   * the menu is closed here, since swallowing it also hides it from reka.
   */
  let armed = false;
  let listening = false;
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;

  const insideMenu = (target: EventTarget | null) => target instanceof Element && !!target.closest('[role="menu"]');

  function onPointerDown(e: PointerEvent) {
    // Ctrl-click is a right-click on a Mac: it opens another menu and fires no click
    armed = open.value && e.button === 0 && !e.ctrlKey && !insideMenu(e.target);
    if (!armed && !open.value) stopListening();
  }

  function onClick(e: MouseEvent) {
    if (!armed) return;
    armed = false;
    e.preventDefault();
    e.stopPropagation();
    open.value = false;
    stopListening();
  }

  function startListening() {
    clearTimeout(disarmTimer);
    if (listening) return;
    listening = true;
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
  }

  function stopListening() {
    clearTimeout(disarmTimer);
    armed = false;
    if (!listening) return;
    listening = false;
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("click", onClick, true);
  }

  watch(open, isOpen => {
    if (isOpen) startListening();
    // A mouse closes the menu on pointerdown, before its click: keep the guard
    // until that click arrives (or, if it never does, briefly).
    else if (armed) disarmTimer = setTimeout(stopListening, 1000);
    else stopListening();
  });

  onBeforeUnmount(stopListening);
</script>

<template>
  <ContextMenuRoot v-bind="forwarded" v-model:open="open">
    <slot />
  </ContextMenuRoot>
</template>
