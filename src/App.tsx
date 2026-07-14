import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { notesRepo } from "@/lib/db/notesRepo";
import { tasksRepo } from "@/lib/db/tasksRepo";
import { snippetsRepo } from "@/lib/db/snippetsRepo";
import { useNotesStore } from "@/stores/notesStore";
import { useScratchpadStore } from "@/stores/scratchpadStore";
import { useSettingsStore, applyTheme } from "@/stores/settingsStore";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useUiStore } from "@/stores/uiStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReminders } from "@/hooks/useReminders";
import { useTrayEvents } from "@/hooks/useTrayEvents";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppTitleBar } from "@/components/layout/AppTitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchDialog } from "@/components/SearchDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ShortcutsHelpModal } from "@/components/ShortcutsHelpModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { CalendarView } from "@/features/calendar/CalendarView";
import { TasksView } from "@/features/tasks/TasksView";
import { TaskDialog } from "@/features/tasks/TaskDialog";
import { NotesView } from "@/features/notes/NotesView";
import { SnippetsView } from "@/features/snippets/SnippetsView";
import { ScratchpadView } from "@/features/scratchpad/ScratchpadView";
import { SettingsView } from "@/features/settings/SettingsView";
import { TrashView } from "@/features/trash/TrashView";

const TRASH_RETENTION_DAYS = 30;

/** Blocking full-app overlay for long operations (backup import/export). */
function GlobalBusyOverlay() {
  const message = useUiStore((s) => s.globalBusy);
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

function MainContent() {
  const view = useUiStore((s) => s.view);
  switch (view.name) {
    case "dashboard":
      return <Dashboard />;
    case "calendar":
      return <CalendarView />;
    case "tasks":
      return <TasksView filter={view.filter} />;
    case "notes":
      return <NotesView folderId={view.folderId} noteId={view.noteId} />;
    case "snippets":
      return <SnippetsView snippetId={view.snippetId} />;
    case "scratchpad":
      return <ScratchpadView />;
    case "settings":
      return <SettingsView />;
    case "trash":
      return <TrashView />;
  }
}

export default function App() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const [ready, setReady] = useState(false);
  const bootedRef = useRef(false);

  useKeyboardShortcuts();
  useReminders();
  useTrayEvents();

  // Boot: load settings first (theme + default view), then all data
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void (async () => {
      try {
        await useSettingsStore.getState().load();
        const { defaultView } = useSettingsStore.getState().settings;
        if (defaultView === "tasks") {
          useUiStore.getState().navigateTasks({ kind: "today" });
        } else if (defaultView === "notes") {
          useUiStore.getState().navigate({ name: "notes", folderId: null });
        }
        await Promise.all([
          useTasksStore.getState().load(),
          useNotesStore.getState().load(),
          useTagsStore.getState().load(),
          useSnippetsStore.getState().load(),
          useScratchpadStore.getState().load(),
        ]);
        // Auto-empty trash items older than the retention window
        await Promise.all([
          tasksRepo.purgeOldTrash(TRASH_RETENTION_DAYS),
          notesRepo.purgeOldTrash(TRASH_RETENTION_DAYS),
          snippetsRepo.purgeOldTrash(TRASH_RETENTION_DAYS),
        ]);
      } catch (err) {
        console.error("Failed to initialize app", err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Apply theme and follow OS changes in "system" mode
  useEffect(() => {
    applyTheme(theme);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(useSettingsStore.getState().settings.theme);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <ErrorBoundary>
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          <AppTitleBar />
          <div className="app-workspace flex min-h-0 flex-1 overflow-hidden">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <MainContent />
            </main>
          </div>
        </div>
        <TaskDialog />
        <CommandPalette />
        <SearchDialog />
        <ConfirmDialog />
        <ShortcutsHelpModal />
        <GlobalBusyOverlay />
        <Toaster position="bottom-right" richColors closeButton />
      </ErrorBoundary>
    </TooltipProvider>
  );
}
