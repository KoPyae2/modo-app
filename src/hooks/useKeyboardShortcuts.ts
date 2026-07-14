import { useEffect } from "react";
import { useNotesStore } from "@/stores/notesStore";
import { useUiStore } from "@/stores/uiStore";

/**
 * Global shortcuts:
 *  Ctrl/Cmd+K  command palette      Ctrl/Cmd+N  new note
 *  Ctrl/Cmd+T  new task             Ctrl/Cmd+1/2/3  dashboard/tasks/notes
 *  Ctrl/Cmd+4  snippets             Ctrl/Cmd+5  scratchpad
 *  Ctrl/Cmd+6  calendar
 *  Ctrl/Cmd+F  search everything    Ctrl/Cmd+,  settings
 *  Ctrl/Cmd+/  shortcuts help
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const ui = useUiStore.getState();

      switch (e.key.toLowerCase()) {
        case "k":
          e.preventDefault();
          ui.setCommandPaletteOpen(!ui.commandPaletteOpen);
          break;
        case "n":
          e.preventDefault();
          void useNotesStore
            .getState()
            .createNote(null)
            .then((note) => {
              if (note)
                ui.navigate({ name: "notes", folderId: null, noteId: note.id });
            });
          break;
        case "t":
          e.preventDefault();
          ui.openTaskDialog({});
          break;
        case "1":
          e.preventDefault();
          ui.navigate({ name: "dashboard" });
          break;
        case "2":
          e.preventDefault();
          ui.navigateTasks({ kind: "today" });
          break;
        case "3":
          e.preventDefault();
          ui.navigate({ name: "notes", folderId: null });
          break;
        case "4":
          e.preventDefault();
          ui.navigate({ name: "snippets" });
          break;
        case "5":
          e.preventDefault();
          ui.navigate({ name: "scratchpad" });
          break;
        case "6":
          e.preventDefault();
          ui.navigate({ name: "calendar" });
          break;
        case "f":
          e.preventDefault();
          ui.setSearchOpen(!ui.searchOpen);
          break;
        case ",":
          e.preventDefault();
          ui.navigate({ name: "settings" });
          break;
        case "/":
          e.preventDefault();
          ui.setShortcutsHelpOpen(!ui.shortcutsHelpOpen);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
