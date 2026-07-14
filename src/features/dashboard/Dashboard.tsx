import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  FileText,
  Flame,
  Pin,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dateStr,
  formatDayHeading,
  formatDueDate,
  formatRelativeUpdated,
  isTaskDueToday,
  isTaskOverdue,
  todayStr,
} from "@/lib/dates";
import { useNotesStore } from "@/stores/notesStore";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { parseQuickAdd } from "./quickAdd";
import { PRIORITY_META, type Task } from "@/types";

/** Max rows a dashboard card shows before the "View all"/"+N more" overflow. */
const MAX_ROWS = 3;

/** Consecutive-day completion streak ending today or yesterday. */
function computeStreak(tasks: Task[]): number {
  const daysWithCompletion = new Set(
    tasks
      .filter((t) => t.completedAt)
      .map((t) => dateStr(parseISO(t.completedAt as string))),
  );
  let streak = 0;
  let cursor = new Date();
  // A streak survives if today has no completion yet; start counting from yesterday.
  if (!daysWithCompletion.has(dateStr(cursor))) {
    cursor = subDays(cursor, 1);
  }
  while (daysWithCompletion.has(dateStr(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

function TaskRow({ task }: { task: Task }) {
  const toggleComplete = useTasksStore((s) => s.toggleComplete);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);
  const overdue = isTaskOverdue(task);

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/60">
      <Checkbox
        checked={task.isCompleted}
        onCheckedChange={() => void toggleComplete(task.id)}
        aria-label={`Complete "${task.title}"`}
      />
      <button
        type="button"
        onClick={() => openTaskDialog({ taskId: task.id })}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm font-medium",
          task.isCompleted && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </button>
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_META[task.priority].color }}
        aria-label={`Priority: ${PRIORITY_META[task.priority].label}`}
      />
      {task.dueDate && (
        <span
          className={cn(
            "shrink-0 text-xs",
            overdue ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatDueDate(task.dueDate, task.dueTime)}
        </span>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cute-card rounded-2xl p-4", className)}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Dashboard() {
  const tasks = useTasksStore((s) => s.tasks);
  const tasksLoaded = useTasksStore((s) => s.loaded);
  const addTask = useTasksStore((s) => s.addTask);
  const notes = useNotesStore((s) => s.notes);
  const notesLoaded = useNotesStore((s) => s.loaded);
  const createNote = useNotesStore((s) => s.createNote);
  const snippets = useSnippetsStore((s) => s.snippets);
  const weekStartsOn = useSettingsStore((s) => s.settings.weekStartsOn);
  const navigate = useUiStore((s) => s.navigate);
  const navigateTasks = useUiStore((s) => s.navigateTasks);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);

  const [quickInput, setQuickInput] = useState("");

  const topLevel = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);
  const today = todayStr();

  const dueToday = useMemo(
    () => topLevel.filter((t) => !t.isCompleted && isTaskDueToday(t)),
    [topLevel],
  );
  const overdue = useMemo(
    () => topLevel.filter((t) => isTaskOverdue(t) && !isTaskDueToday(t)),
    [topLevel],
  );
  const completedToday = useMemo(
    () =>
      topLevel.filter(
        (t) => t.completedAt && dateStr(parseISO(t.completedAt)) === today,
      ),
    [topLevel, today],
  );

  const todayTotal = dueToday.length + overdue.length + completedToday.length;
  const progressPct = todayTotal === 0 ? 0 : (completedToday.length / todayTotal) * 100;

  const upcoming = useMemo(() => {
    const groups = new Map<string, Task[]>();
    const horizon = dateStr(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    for (const t of topLevel) {
      if (t.isCompleted || !t.dueDate) continue;
      if (t.dueDate > today && t.dueDate <= horizon) {
        const arr = groups.get(t.dueDate) ?? [];
        arr.push(t);
        groups.set(t.dueDate, arr);
      }
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [topLevel, today]);

  const streak = useMemo(() => computeStreak(topLevel), [topLevel]);
  const pinnedNotes = useMemo(() => notes.filter((n) => n.isPinned).slice(0, MAX_ROWS), [notes]);
  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_ROWS),
    [notes],
  );

  // ponytail: dashboard cards show max MAX_ROWS rows; full lists live behind "View all"
  const todayItems = useMemo(
    () => [...overdue, ...dueToday, ...completedToday],
    [overdue, dueToday, completedToday],
  );
  const upcomingTotal = useMemo(
    () => upcoming.reduce((n, [, dayTasks]) => n + dayTasks.length, 0),
    [upcoming],
  );
  const upcomingCapped = useMemo(() => {
    const out: [string, Task[]][] = [];
    let n = 0;
    for (const [day, dayTasks] of upcoming) {
      if (n >= MAX_ROWS) break;
      const take = dayTasks.slice(0, MAX_ROWS - n);
      out.push([day, take]);
      n += take.length;
    }
    return out;
  }, [upcoming]);

  const handleQuickAdd = async () => {
    const parsed = parseQuickAdd(quickInput, weekStartsOn);
    if (!parsed) return;
    if (parsed.kind === "note") {
      const note = await createNote(null);
      if (note) {
        await useNotesStore
          .getState()
          .saveContent(note.id, parsed.title, "{}", "");
        navigate({ name: "notes", folderId: null, noteId: note.id });
      }
    } else {
      await addTask({
        title: parsed.title,
        dueDate: parsed.dueDate,
        priority: parsed.priority,
      });
    }
    setQuickInput("");
  };

  if (!tasksLoaded || !notesLoaded) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-5 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {format(new Date(), "EEEE, MMMM d")}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {dueToday.length + overdue.length === 0
            ? "No tasks due today - enjoy your day!"
            : `${dueToday.length + overdue.length} ${dueToday.length + overdue.length === 1 ? "task" : "tasks"} on your plate today`}
        </p>
      </header>

      <div className="mb-6 flex gap-2 rounded-2xl border bg-card/75 p-2 shadow-sm">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleQuickAdd();
            }}
            placeholder={'Quick add - try "Buy milk tomorrow !high" or "note: meeting ideas"'}
            className="h-11 border-transparent bg-transparent pl-9 shadow-none focus-visible:bg-card"
            aria-label="Quick add task or note"
          />
        </div>
        <Button className="h-11 rounded-xl px-5" onClick={() => void handleQuickAdd()} disabled={!quickInput.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="cute-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's progress</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {completedToday.length}/{todayTotal}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              tasks done
            </span>
          </p>
          <Progress value={progressPct} className="mt-2" />
        </div>
        <div className="cute-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completion streak</p>
          <p className="mt-1 flex items-center gap-1.5 text-3xl font-bold tabular-nums">
            <Flame className={cn("size-6", streak > 0 ? "text-primary" : "text-muted-foreground/40")} />
            {streak}
            <span className="text-sm font-normal text-muted-foreground">
              {streak === 1 ? "day" : "days"}
            </span>
          </p>
        </div>
        <div className="cute-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overdue</p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1.5 text-3xl font-bold tabular-nums",
              overdue.length > 0 && "text-destructive",
            )}
          >
            <AlertTriangle
              className={cn(
                "size-6",
                overdue.length > 0 ? "text-destructive" : "text-muted-foreground/40",
              )}
            />
            {overdue.length}
            <span className="text-sm font-normal text-muted-foreground">
              {overdue.length === 1 ? "task" : "tasks"}
            </span>
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            {
              label: "Open tasks",
              value: topLevel.filter((t) => !t.isCompleted).length,
              onClick: () => navigateTasks({ kind: "all" }),
            },
            {
              label: "Completed (7 days)",
              value: topLevel.filter(
                (t) =>
                  t.completedAt &&
                  t.completedAt >= subDays(new Date(), 7).toISOString(),
              ).length,
              onClick: () => navigateTasks({ kind: "completed" }),
            },
            {
              label: "Notes",
              value: notes.length,
              onClick: () => navigate({ name: "notes", folderId: null }),
            },
            {
              label: "Snippets",
              value: snippets.length,
              onClick: () => navigate({ name: "snippets" }),
            },
          ] as const
        ).map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className="cute-card rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Today"
          icon={<Calendar />}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => navigateTasks({ kind: "today" })}
            >
              View all <ArrowRight className="size-3" />
            </Button>
          }
        >
          {overdue.length === 0 && dueToday.length === 0 && completedToday.length === 0 ? (
            <div className="rounded-xl bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Nothing due today</p>
              <p className="mt-1">
                Your schedule is clear.{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => openTaskDialog({ defaults: { dueDate: today } })}
                >
                  Add a task
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {todayItems.slice(0, MAX_ROWS).map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
              {todayItems.length > MAX_ROWS && (
                <button
                  type="button"
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-primary hover:bg-accent/60"
                  onClick={() => navigateTasks({ kind: "today" })}
                >
                  +{todayItems.length - MAX_ROWS} more…
                </button>
              )}
            </div>
          )}
        </Card>

        <Card
          title="Upcoming (7 days)"
          icon={<Calendar />}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => navigateTasks({ kind: "upcoming" })}
            >
              View all <ArrowRight className="size-3" />
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <div className="rounded-xl bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No upcoming tasks</p>
              <p className="mt-1">Tasks scheduled in the next 7 days will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingCapped.map(([day, dayTasks]) => (
                <div key={day}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {formatDayHeading(day)}
                  </p>
                  <div className="space-y-0.5">
                    {dayTasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              ))}
              {upcomingTotal > MAX_ROWS && (
                <button
                  type="button"
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-primary hover:bg-accent/60"
                  onClick={() => navigateTasks({ kind: "upcoming" })}
                >
                  +{upcomingTotal - MAX_ROWS} more…
                </button>
              )}
            </div>
          )}
        </Card>

        {pinnedNotes.length > 0 && (
          <Card title="Pinned notes" icon={<Pin />}>
            <div className="space-y-0.5">
              {pinnedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() =>
                    navigate({ name: "notes", folderId: note.folderId, noteId: note.id })
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/60"
                >
                  <Pin className="size-3.5 shrink-0 fill-current text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {note.title || "Untitled"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeUpdated(note.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card
          title="Recent notes"
          icon={<FileText />}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => navigate({ name: "notes", folderId: null })}
            >
              View all <ArrowRight className="size-3" />
            </Button>
          }
        >
          {recentNotes.length === 0 ? (
            <div className="rounded-xl bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No notes yet</p>
              <p className="mt-1">
                Keep ideas and details here.{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => {
                    void createNote(null).then((note) => {
                      if (note)
                        navigate({ name: "notes", folderId: null, noteId: note.id });
                    });
                  }}
                >
                  Create one
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() =>
                    navigate({ name: "notes", folderId: note.folderId, noteId: note.id })
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/60"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {note.title || "Untitled"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeUpdated(note.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
