import { useI18n } from "vue-i18n";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { SHORTCUTS } from "~/lib/shortcuts";
import { useDialog } from "~/components/ui/dialog-provider";
import { DialogID } from "~/components/ui/dialog-provider/utils";

/**
 * App-wide shortcuts, registered once by the default layout. Each carries
 * meta so the "?" cheatsheet can list it.
 */
export function useGlobalShortcuts(handlers: { scan: () => void }) {
  const { t } = useI18n();
  const { openDialog } = useDialog();
  const router = useRouter();

  const general = (name: string) => ({ meta: { name: t(name), group: "general" } });
  const nav = (name: string) => ({ meta: { name: t(name), group: "navigation" } });

  // Works from inside text fields too, like every other command palette.
  useHotkey(SHORTCUTS.commandPalette, () => openDialog(DialogID.CommandPalette), {
    ...general("shell.shortcuts.command_palette"),
    ignoreInputs: false,
  });
  useHotkey(SHORTCUTS.help, () => openDialog(DialogID.Shortcuts), general("shell.shortcuts.help"));
  useHotkey(
    SHORTCUTS.newItem,
    () => openDialog(DialogID.CreateEntity, { params: { baseType: "item" } }),
    general("shell.shortcuts.new_item")
  );
  useHotkey(
    SHORTCUTS.newPlace,
    () => openDialog(DialogID.CreateEntity, { params: { baseType: "location" } }),
    general("shell.shortcuts.new_place")
  );
  useHotkey(SHORTCUTS.scan, handlers.scan, general("shell.shortcuts.scan"));

  useHotkey(SHORTCUTS.goHome, () => router.push("/home"), nav("shell.shortcuts.go_home"));
  useHotkey(SHORTCUTS.goItems, () => router.push("/items"), nav("shell.shortcuts.go_items"));
  useHotkey(SHORTCUTS.goPlaces, () => router.push("/locations"), nav("shell.shortcuts.go_places"));
  useHotkey(SHORTCUTS.goTags, () => router.push("/tags"), nav("shell.shortcuts.go_tags"));
}
