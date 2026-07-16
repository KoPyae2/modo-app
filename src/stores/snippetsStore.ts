import { create } from "zustand";
import { toast } from "@/components/ui/toast";
import { snippetsRepo } from "@/lib/db/snippetsRepo";
import type { Snippet } from "@/types";

interface SnippetsState {
  snippets: Snippet[];
  trashedSnippets: Snippet[];
  loaded: boolean;

  load: () => Promise<void>;
  loadTrash: () => Promise<void>;

  createSnippet: (input?: { language?: string }) => Promise<Snippet | null>;
  updateSnippet: (snippet: Snippet) => Promise<void>;
  /** Debounced-autosave target: content fields only, no list re-sort churn */
  saveContent: (
    id: string,
    fields: Pick<Snippet, "title" | "language" | "description" | "code">,
  ) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  moveManyToTrash: (ids: string[]) => Promise<void>;
  restoreSnippet: (id: string) => Promise<void>;
  restoreManySnippets: (ids: string[]) => Promise<void>;
  deleteSnippetPermanently: (id: string) => Promise<void>;
  deleteManySnippetsPermanently: (ids: string[]) => Promise<void>;
}

export const useSnippetsStore = create<SnippetsState>((set, get) => ({
  snippets: [],
  trashedSnippets: [],
  loaded: false,

  load: async () => {
    set({ snippets: await snippetsRepo.getAll(), loaded: true });
  },

  loadTrash: async () => {
    set({ trashedSnippets: await snippetsRepo.getTrashed() });
  },

  createSnippet: async (input) => {
    try {
      const snippet = await snippetsRepo.create(input ?? {});
      set((s) => ({ snippets: [snippet, ...s.snippets] }));
      return snippet;
    } catch (err) {
      console.error(err);
      toast.error("Failed to create snippet");
      return null;
    }
  },

  updateSnippet: async (snippet) => {
    const prev = get().snippets;
    set({ snippets: prev.map((s) => (s.id === snippet.id ? snippet : s)) });
    try {
      const updatedAt = await snippetsRepo.update(snippet);
      set((s) => ({
        snippets: s.snippets.map((x) =>
          x.id === snippet.id ? { ...x, updatedAt } : x,
        ),
      }));
    } catch (err) {
      set({ snippets: prev });
      console.error(err);
      toast.error("Failed to update snippet");
    }
  },

  saveContent: async (id, fields) => {
    const current = get().snippets.find((s) => s.id === id);
    if (!current) return;
    try {
      const updatedAt = await snippetsRepo.update({ ...current, ...fields });
      set((s) => ({
        snippets: s.snippets.map((x) =>
          x.id === id ? { ...x, ...fields, updatedAt } : x,
        ),
      }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to save snippet");
    }
  },

  toggleFavorite: async (id) => {
    const current = get().snippets.find((s) => s.id === id);
    if (!current) return;
    await get().updateSnippet({ ...current, isFavorite: !current.isFavorite });
  },

  moveToTrash: async (id) => {
    const prev = get().snippets;
    set({ snippets: prev.filter((s) => s.id !== id) });
    try {
      await snippetsRepo.moveToTrash(id);
      toast.success("Snippet moved to trash");
    } catch (err) {
      set({ snippets: prev });
      console.error(err);
      toast.error("Failed to delete snippet");
    }
  },

  moveManyToTrash: async (ids) => {
    if (ids.length === 0) return;
    const prev = get().snippets;
    const idSet = new Set(ids);
    set({ snippets: prev.filter((s) => !idSet.has(s.id)) });
    try {
      for (const id of ids) await snippetsRepo.moveToTrash(id);
      toast.success(`${ids.length} ${ids.length === 1 ? "snippet" : "snippets"} moved to trash`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete snippets");
      void get().load();
    }
  },

  restoreSnippet: async (id) => {
    try {
      await snippetsRepo.restore(id);
      await Promise.all([get().load(), get().loadTrash()]);
      toast.success("Snippet restored");
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore snippet");
    }
  },

  restoreManySnippets: async (ids) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await snippetsRepo.restore(id);
      await Promise.all([get().load(), get().loadTrash()]);
      toast.success(`${ids.length} ${ids.length === 1 ? "snippet" : "snippets"} restored`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore snippets");
      void get().loadTrash();
    }
  },

  deleteSnippetPermanently: async (id) => {
    try {
      await snippetsRepo.deletePermanently(id);
      set((s) => ({
        trashedSnippets: s.trashedSnippets.filter((x) => x.id !== id),
      }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete snippet");
    }
  },

  deleteManySnippetsPermanently: async (ids) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await snippetsRepo.deletePermanently(id);
      const idSet = new Set(ids);
      set((s) => ({
        trashedSnippets: s.trashedSnippets.filter((x) => !idSet.has(x.id)),
      }));
      toast.success(`${ids.length} ${ids.length === 1 ? "snippet" : "snippets"} deleted forever`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete snippets");
      void get().loadTrash();
    }
  },
}));
