import { create } from "zustand";
import { toast } from "@/components/ui/toast";
import { tagsRepo } from "@/lib/db/collectionsRepo";
import type { Tag } from "@/types";

interface TagsState {
  tags: Tag[];
  loaded: boolean;
  load: () => Promise<void>;
  addTag: (name: string, color: string) => Promise<Tag | null>;
  updateTag: (tag: Tag) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  loaded: false,

  load: async () => {
    set({ tags: await tagsRepo.getAll(), loaded: true });
  },

  addTag: async (name, color) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = get().tags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    try {
      const tag = await tagsRepo.create(trimmed, color);
      set((s) => ({ tags: [...s.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }));
      return tag;
    } catch (err) {
      console.error(err);
      toast.error("Failed to create tag");
      return null;
    }
  },

  updateTag: async (tag) => {
    const prev = get().tags;
    set({ tags: prev.map((t) => (t.id === tag.id ? tag : t)) });
    try {
      await tagsRepo.update(tag);
    } catch (err) {
      set({ tags: prev });
      console.error(err);
      toast.error("Failed to update tag");
    }
  },

  deleteTag: async (id) => {
    const prev = get().tags;
    set({ tags: prev.filter((t) => t.id !== id) });
    try {
      await tagsRepo.delete(id);
    } catch (err) {
      set({ tags: prev });
      console.error(err);
      toast.error("Failed to delete tag");
    }
  },
}));
