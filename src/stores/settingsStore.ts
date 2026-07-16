import { create } from "zustand";
import { toast } from "@/components/ui/toast";
import { settingsRepo } from "@/lib/db/settingsRepo";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await settingsRepo.getAll();
    set({ settings, loaded: true });
  },

  set: async (key, value) => {
    const prevValue = get().settings[key];
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
    try {
      await settingsRepo.set(key, value);
    } catch (err) {
      // Roll back only this key so concurrent edits aren't clobbered
      set((s) => ({ settings: { ...s.settings, [key]: prevValue } }));
      toast.error("Failed to save setting");
      console.error(err);
    }
  },
}));

/** Apply theme mode to <html>. Called on change and on OS theme change. */
export function applyTheme(mode: AppSettings["theme"]) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}
