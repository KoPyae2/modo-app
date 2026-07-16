import { create } from "zustand";
import { toast } from "@/components/ui/toast";
import { scratchpadRepo } from "@/lib/db/scratchpadRepo";
import type { ScratchpadEntry } from "@/types";

interface ScratchpadState {
  entries: ScratchpadEntry[];
  loaded: boolean;

  load: () => Promise<void>;
  addEntry: (content: string) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useScratchpadStore = create<ScratchpadState>((set, get) => ({
  entries: [],
  loaded: false,

  load: async () => {
    set({ entries: await scratchpadRepo.getAll(), loaded: true });
  },

  addEntry: async (content) => {
    try {
      const entry = await scratchpadRepo.create(content);
      set((s) => ({ entries: [entry, ...s.entries] }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add scratchpad entry");
    }
  },

  removeEntry: async (id) => {
    const prev = get().entries;
    set({ entries: prev.filter((e) => e.id !== id) });
    try {
      await scratchpadRepo.remove(id);
    } catch (err) {
      set({ entries: prev });
      console.error(err);
      toast.error("Failed to delete entry");
    }
  },

  clearAll: async () => {
    const prev = get().entries;
    set({ entries: [] });
    try {
      await scratchpadRepo.clear();
    } catch (err) {
      set({ entries: prev });
      console.error(err);
      toast.error("Failed to clear scratchpad");
    }
  },
}));
