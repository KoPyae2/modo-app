import { create } from "zustand";
import type { AppView, TaskViewFilter } from "@/types";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((confirmed: boolean) => void) | null;
}

interface TaskDialogState {
  open: boolean;
  /** Editing an existing task when set */
  taskId: string | null;
  /** Prefills for a new task */
  defaults: { dueDate?: string | null; projectId?: string | null; title?: string };
}

interface UiState {
  view: AppView;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  searchOpen: boolean;
  shortcutsHelpOpen: boolean;
  /** Message for the app-wide blocking overlay (e.g. "Importing backup…") */
  globalBusy: string | null;
  taskDialog: TaskDialogState;
  confirm: ConfirmState;

  navigate: (view: AppView) => void;
  navigateTasks: (filter: TaskViewFilter) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setGlobalBusy: (message: string | null) => void;
  openTaskDialog: (opts?: {
    taskId?: string;
    defaults?: TaskDialogState["defaults"];
  }) => void;
  closeTaskDialog: () => void;
  /** Promise-based confirm dialog for destructive actions */
  requestConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  view: { name: "dashboard" },
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  searchOpen: false,
  shortcutsHelpOpen: false,
  globalBusy: null,
  taskDialog: { open: false, taskId: null, defaults: {} },
  confirm: {
    open: false,
    title: "",
    description: "",
    resolve: null,
  },

  navigate: (view) => set({ view }),
  navigateTasks: (filter) => set({ view: { name: "tasks", filter } }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
  setGlobalBusy: (message) => set({ globalBusy: message }),

  openTaskDialog: (opts) =>
    set({
      taskDialog: {
        open: true,
        taskId: opts?.taskId ?? null,
        defaults: opts?.defaults ?? {},
      },
    }),
  closeTaskDialog: () =>
    set({ taskDialog: { open: false, taskId: null, defaults: {} } }),

  requestConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { ...opts, open: true, resolve } });
    }),
  resolveConfirm: (confirmed) => {
    get().confirm.resolve?.(confirmed);
    set({
      confirm: { open: false, title: "", description: "", resolve: null },
    });
  },
}));
