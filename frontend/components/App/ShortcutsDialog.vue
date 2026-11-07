<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { useHotkeyRegistrations } from "@tanstack/vue-hotkeys";
  import ShortcutHint from "./ShortcutHint.vue";
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import type { ShortcutGroup } from "~/lib/shortcuts";

  const { t } = useI18n();
  const registrations = useHotkeyRegistrations();

  const order: ShortcutGroup[] = ["general", "navigation", "list", "item", "places"];

  // Built from what is registered right now, so page-specific shortcuts only
  // show on the pages that have them.
  const groups = computed(() => {
    const seen = new Set<string>();
    const byGroup = new Map<string, { id: string; name: string; hotkey: never }[]>();
    for (const reg of registrations.value) {
      const meta = reg.options.meta;
      if (!meta?.name || reg.status === "disabled") continue;
      const key = `${meta.group}:${meta.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const group = meta.group ?? "general";
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push({ id: reg.id, name: meta.name, hotkey: reg.hotkey as never });
    }
    return order.filter(g => byGroup.has(g)).map(g => ({ id: g, items: byGroup.get(g)! }));
  });
</script>

<template>
  <Dialog :dialog-id="DialogID.Shortcuts">
    <DialogContent class="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("shell.keyboard_shortcuts") }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t("shell.shortcuts.help") }}</DialogDescription>
      </DialogHeader>
      <div class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <section v-for="group in groups" :key="group.id" class="flex flex-col gap-1">
          <h3 class="mb-1 text-xs font-medium text-muted-foreground">{{ t(`shell.shortcut_groups.${group.id}`) }}</h3>
          <div v-for="item in group.items" :key="item.id" class="flex items-center justify-between gap-4 py-1 text-sm">
            <span>{{ item.name }}</span>
            <ShortcutHint :hotkey="item.hotkey" />
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
