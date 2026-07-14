import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNotesStore } from "@/stores/notesStore";
import { useScratchpadStore } from "@/stores/scratchpadStore";
import { useUiStore } from "@/stores/uiStore";

/** React to system tray quick actions and cross-window events. */
export function useTrayEvents() {
  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [
      listen("tray://new-task", () => {
        useUiStore.getState().openTaskDialog({});
      }),
      // The quick-capture window saved a new entry — refresh the scratchpad
      listen("scratchpad://changed", () => {
        void useScratchpadStore.getState().load();
      }),
      listen("tray://new-note", () => {
        void useNotesStore
          .getState()
          .createNote(null)
          .then((note) => {
            if (note) {
              useUiStore
                .getState()
                .navigate({ name: "notes", folderId: null, noteId: note.id });
            }
          });
      }),
    ];
    return () => {
      for (const p of unlisteners) void p.then((fn) => fn());
    };
  }, []);
}
