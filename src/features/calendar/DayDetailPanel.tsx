import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarPlus, FileText, Pencil, Plus, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasksStore } from "@/stores/tasksStore";
import { useNotesStore } from "@/stores/notesStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PRIORITY_META } from "@/types";

interface DayDetailPanelProps {
  /** ISO date ("2026-07-14") of the open day, or null when closed */
  dateKey: string | null;
  onClose: () => void;
}

export function DayDetailPanel({ dateKey, onClose }: DayDetailPanelProps) {
  const tasks = useTasksStore((s) => s.tasks);
  const { toggleComplete, addTask } = useTasksStore();
  const notes = useNotesStore((s) => s.notes);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);
  const navigate = useUiStore((s) => s.navigate);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentTaskId && t.dueDate === dateKey)
        .sort(
          (a, b) =>
            Number(a.isCompleted) - Number(b.isCompleted) ||
            (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"),
        ),
    [tasks, dateKey],
  );

  const dayNotes = useMemo(
    () => notes.filter((n) => !n.isTrashed && n.createdAt.slice(0, 10) === dateKey),
    [notes, dateKey],
  );

  const date = dateKey ? parseISO(dateKey) : null;

  const resetForm = () => {
    setAdding(false);
    setNewTitle("");
    setNewTime("");
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title || !dateKey) return;
    await addTask({ title, dueDate: dateKey, dueTime: newTime || null });
    resetForm();
  };

  return (
    <Sheet
      open={dateKey !== null}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <SheetContent>
        {date && (
          <>
            <SheetHeader>
              <SheetDescription>{format(date, "EEEE")}</SheetDescription>
              <SheetTitle className="text-2xl">
                {format(date, "MMMM d, yyyy")}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 pt-4">
              {/* Tasks */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tasks · {dayTasks.length}
                </h3>
                {dayTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No tasks for this day
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayTasks.map((task) => (
                      <li
                        key={task.id}
                        className={cn(
                          "group flex items-start gap-2.5 rounded-lg border bg-background p-2.5 transition-all hover:border-primary/25",
                          task.isCompleted && "opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={task.isCompleted}
                          onCheckedChange={() => void toggleComplete(task.id)}
                          className="mt-0.5 size-5 rounded-md"
                          aria-label={`Mark "${task.title}" ${task.isCompleted ? "incomplete" : "complete"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              task.isCompleted && "line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className="size-1.5 rounded-full"
                              style={{
                                backgroundColor: PRIORITY_META[task.priority].color,
                              }}
                            />
                            <span>{PRIORITY_META[task.priority].label}</span>
                            {task.dueTime && <span>· {task.dueTime}</span>}
                            {task.recurrenceRule && <Repeat className="size-3" />}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                          onClick={() => openTaskDialog({ taskId: task.id })}
                          aria-label="Edit task"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Notes created that day */}
              {dayNotes.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes · {dayNotes.length}
                  </h3>
                  <ul className="space-y-1.5">
                    {dayNotes.map((note) => (
                      <li key={note.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate({
                              name: "notes",
                              folderId: note.folderId,
                              noteId: note.id,
                            });
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-primary/25 hover:bg-accent/40"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">
                            {note.title || "Untitled note"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Add task footer */}
            <div className="border-t p-4">
              {adding ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAdd();
                  }}
                >
                  <Input
                    autoFocus
                    placeholder="Task title…"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") resetForm();
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-32"
                      aria-label="Due time"
                    />
                    <div className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetForm}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={!newTitle.trim()}>
                      <CalendarPlus className="size-4" />
                      Add
                    </Button>
                  </div>
                </form>
              ) : (
                <Button className="w-full" onClick={() => setAdding(true)}>
                  <Plus className="size-4" />
                  Add New Task
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
