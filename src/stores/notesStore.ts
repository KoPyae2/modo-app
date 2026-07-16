import { create } from "zustand";
import { toast } from "@/components/ui/toast";
import { notesRepo } from "@/lib/db/notesRepo";
import { foldersRepo } from "@/lib/db/collectionsRepo";
import type { Folder, Note } from "@/types";

interface NotesState {
  notes: Note[];
  trashedNotes: Note[];
  folders: Folder[];
  loaded: boolean;

  load: () => Promise<void>;
  loadTrash: () => Promise<void>;

  createNote: (
    folderId?: string | null,
    content?: { title?: string; contentJson?: string; contentText?: string },
  ) => Promise<Note | null>;
  /** Full metadata update (pin, favorite, folder, tags...) */
  updateNote: (note: Note) => Promise<void>;
  /** Debounced-autosave target: content only */
  saveContent: (
    id: string,
    title: string,
    contentJson: string,
    contentText: string,
  ) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  moveManyToTrash: (ids: string[]) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  restoreManyNotes: (ids: string[]) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  deleteManyNotesPermanently: (ids: string[]) => Promise<void>;

  addFolder: (name: string, color: string) => Promise<Folder | null>;
  updateFolder: (folder: Folder) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  trashedNotes: [],
  folders: [],
  loaded: false,

  load: async () => {
    const [notes, folders] = await Promise.all([
      notesRepo.getAll(),
      foldersRepo.getAll(),
    ]);
    set({ notes, folders, loaded: true });
  },

  loadTrash: async () => {
    set({ trashedNotes: await notesRepo.getTrashed() });
  },

  createNote: async (folderId, content) => {
    try {
      const note = await notesRepo.create({ folderId: folderId ?? null, ...content });
      set((s) => ({ notes: [note, ...s.notes] }));
      return note;
    } catch (err) {
      console.error(err);
      toast.error("Failed to create note");
      return null;
    }
  },

  updateNote: async (note) => {
    const prev = get().notes;
    set({ notes: prev.map((n) => (n.id === note.id ? note : n)) });
    try {
      await notesRepo.update(note);
    } catch (err) {
      set({ notes: prev });
      console.error(err);
      toast.error("Failed to update note");
    }
  },

  saveContent: async (id, title, contentJson, contentText) => {
    try {
      const updatedAt = await notesRepo.updateContent(
        id,
        title,
        contentJson,
        contentText,
      );
      set((s) => ({
        notes: s.notes.map((n) =>
          n.id === id ? { ...n, title, contentJson, contentText, updatedAt } : n,
        ),
      }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to save note");
    }
  },

  moveToTrash: async (id) => {
    const prev = get().notes;
    set({ notes: prev.filter((n) => n.id !== id) });
    try {
      await notesRepo.moveToTrash(id);
      toast.success("Note moved to trash");
    } catch (err) {
      set({ notes: prev });
      console.error(err);
      toast.error("Failed to delete note");
    }
  },

  moveManyToTrash: async (ids) => {
    if (ids.length === 0) return;
    const prev = get().notes;
    const idSet = new Set(ids);
    set({ notes: prev.filter((n) => !idSet.has(n.id)) });
    try {
      for (const id of ids) await notesRepo.moveToTrash(id);
      toast.success(`${ids.length} ${ids.length === 1 ? "note" : "notes"} moved to trash`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete notes");
      void get().load();
    }
  },

  restoreNote: async (id) => {
    try {
      await notesRepo.restore(id);
      await Promise.all([get().load(), get().loadTrash()]);
      toast.success("Note restored");
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore note");
    }
  },

  restoreManyNotes: async (ids) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await notesRepo.restore(id);
      await Promise.all([get().load(), get().loadTrash()]);
      toast.success(`${ids.length} ${ids.length === 1 ? "note" : "notes"} restored`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore notes");
      void get().loadTrash();
    }
  },

  deleteNotePermanently: async (id) => {
    try {
      await notesRepo.deletePermanently(id);
      set((s) => ({
        trashedNotes: s.trashedNotes.filter((n) => n.id !== id),
      }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete note");
    }
  },

  deleteManyNotesPermanently: async (ids) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await notesRepo.deletePermanently(id);
      const idSet = new Set(ids);
      set((s) => ({
        trashedNotes: s.trashedNotes.filter((n) => !idSet.has(n.id)),
      }));
      toast.success(`${ids.length} ${ids.length === 1 ? "note" : "notes"} deleted forever`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete notes");
      void get().loadTrash();
    }
  },

  addFolder: async (name, color) => {
    try {
      const folder = await foldersRepo.create(name, color);
      set((s) => ({ folders: [...s.folders, folder] }));
      return folder;
    } catch (err) {
      console.error(err);
      toast.error("Failed to create folder");
      return null;
    }
  },

  updateFolder: async (folder) => {
    const prev = get().folders;
    set({ folders: prev.map((f) => (f.id === folder.id ? folder : f)) });
    try {
      await foldersRepo.update(folder);
    } catch (err) {
      set({ folders: prev });
      console.error(err);
      toast.error("Failed to update folder");
    }
  },

  deleteFolder: async (id) => {
    const prev = get().folders;
    set({ folders: prev.filter((f) => f.id !== id) });
    try {
      await foldersRepo.delete(id);
      await get().load();
    } catch (err) {
      set({ folders: prev });
      console.error(err);
      toast.error("Failed to delete folder");
    }
  },
}));
