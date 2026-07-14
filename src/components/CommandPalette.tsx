import { Command } from "cmdk";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Code2,
  FileText,
  LayoutDashboard,
  ListTodo,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDate } from "@/lib/dates";
import { useNotesStore } from "@/stores/notesStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PRIORITY_META } from "@/types";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const navigate = useUiStore((s) => s.navigate);
  const navigateTasks = useUiStore((s) => s.navigateTasks);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  const notes = useNotesStore((s) => s.notes);
  const createNote = useNotesStore((s) => s.createNote);
  const tasks = useTasksStore((s) => s.tasks);
  const toggleComplete = useTasksStore((s) => s.toggleComplete);
  const setSetting = useSettingsStore((s) => s.set);
  const theme = useSettingsStore((s) => s.settings.theme);

  const close = () => setOpen(false);

  const run = (fn: () => void) => {
    close();
    fn();
  };

  const openTasks = tasks.filter((t) => !t.isCompleted && !t.parentTaskId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-2xl p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          label="Command palette"
          className="bg-card/95 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <div className="flex items-center gap-3 border-b bg-secondary/35 px-4 py-3">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              placeholder="Search notes, tasks, or type a command..."
              className="h-9 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[28rem] overflow-y-auto p-2">
            <Command.Empty className="rounded-xl border bg-muted/45 px-4 py-5 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Search className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">No results found</p>
                  <p className="mt-1 text-xs">Try a different search or command.</p>
                </div>
              </div>
            </Command.Empty>

            <Command.Group heading="Actions">
              <PaletteItem
                onSelect={() => run(() => openTaskDialog({}))}
                icon={<Plus />}
                label="New Task"
                shortcut="Ctrl T"
              />
              <PaletteItem
                onSelect={() =>
                  run(() => {
                    void createNote().then((note) => {
                      if (note)
                        navigate({ name: "notes", folderId: null, noteId: note.id });
                    });
                  })
                }
                icon={<Plus />}
                label="New Note"
                shortcut="Ctrl N"
              />
              <PaletteItem
                onSelect={() => run(() => setSearchOpen(true))}
                icon={<Search />}
                label="Search everything"
                shortcut="Ctrl F"
              />
              <PaletteItem
                onSelect={() =>
                  run(() => void setSetting("theme", theme === "dark" ? "light" : "dark"))
                }
                icon={theme === "dark" ? <Sun /> : <Moon />}
                label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              />
            </Command.Group>

            <Command.Group heading="Go to">
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "dashboard" }))}
                icon={<LayoutDashboard />}
                label="Dashboard"
                shortcut="Ctrl 1"
              />
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "calendar" }))}
                icon={<CalendarDays />}
                label="Calendar"
                shortcut="Ctrl 6"
              />
              <PaletteItem
                onSelect={() => run(() => navigateTasks({ kind: "today" }))}
                icon={<Calendar />}
                label="Today"
                shortcut="Ctrl 2"
              />
              <PaletteItem
                onSelect={() => run(() => navigateTasks({ kind: "upcoming" }))}
                icon={<CalendarClock />}
                label="Upcoming"
              />
              <PaletteItem
                onSelect={() => run(() => navigateTasks({ kind: "all" }))}
                icon={<ListTodo />}
                label="All Tasks"
              />
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "notes", folderId: null }))}
                icon={<FileText />}
                label="All Notes"
                shortcut="Ctrl 3"
              />
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "snippets" }))}
                icon={<Code2 />}
                label="Snippets"
                shortcut="Ctrl 4"
              />
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "scratchpad" }))}
                icon={<Zap />}
                label="Scratchpad"
                shortcut="Ctrl 5"
              />
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "trash" }))}
                icon={<Trash2 />}
                label="Trash"
              />
              <PaletteItem
                onSelect={() => run(() => navigate({ name: "settings" }))}
                icon={<Settings />}
                label="Settings"
                shortcut="Ctrl ,"
              />
            </Command.Group>

            {openTasks.length > 0 && (
              <Command.Group heading="Tasks">
                {openTasks.slice(0, 50).map((task) => (
                  <PaletteItem
                    key={task.id}
                    value={`task ${task.title} ${task.description}`}
                    onSelect={() => run(() => openTaskDialog({ taskId: task.id }))}
                    icon={
                      <button
                        type="button"
                        aria-label="Complete task"
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleComplete(task.id);
                        }}
                      >
                        <CheckCircle2 />
                      </button>
                    }
                    label={task.title}
                    detail={
                      <>
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: PRIORITY_META[task.priority].color }}
                        />
                        {task.dueDate && (
                          <span>{formatDueDate(task.dueDate, task.dueTime)}</span>
                        )}
                      </>
                    }
                  />
                ))}
              </Command.Group>
            )}

            {notes.length > 0 && (
              <Command.Group heading="Notes">
                {notes.slice(0, 50).map((note) => (
                  <PaletteItem
                    key={note.id}
                    value={`note ${note.title} ${note.contentText.slice(0, 200)}`}
                    onSelect={() =>
                      run(() =>
                        navigate({
                          name: "notes",
                          folderId: note.folderId,
                          noteId: note.id,
                        }),
                      )
                    }
                    icon={<FileText />}
                    label={note.title || "Untitled"}
                    detail={
                      note.contentText ? (
                        <span className="truncate">{note.contentText.slice(0, 60)}</span>
                      ) : undefined
                    }
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

interface PaletteItemProps {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  detail?: React.ReactNode;
  shortcut?: string;
  value?: string;
}

function PaletteItem({ onSelect, icon, label, detail, shortcut, value }: PaletteItemProps) {
  return (
    <Command.Item
      value={value ?? label}
      onSelect={onSelect}
      className={cn(
        "flex cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {detail && (
        <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-muted-foreground">
          {detail}
        </span>
      )}
      {shortcut && (
        <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}

