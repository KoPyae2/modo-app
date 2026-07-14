import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListTodo,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { dateStr, formatDayHeading, isTaskOverdue, todayStr } from "@/lib/dates";
import { useTasksStore } from "@/stores/tasksStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskList } from "./TaskList";
import { PRIORITIES, PRIORITY_META, type Priority, type Task, type TaskViewFilter } from "@/types";

type SortBy = "manual" | "dueDate" | "priority" | "createdAt";

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SORT_LABELS: Record<SortBy, string> = {
  manual: "Manual",
  dueDate: "Due date",
  priority: "Priority",
  createdAt: "Created",
};

function filterTitle(
  filter: TaskViewFilter,
  projectName?: string,
  tagName?: string,
): string {
  switch (filter.kind) {
    case "today":
      return "Today";
    case "upcoming":
      return "Upcoming";
    case "all":
      return "All Tasks";
    case "completed":
      return "Completed";
    case "project":
      return projectName ?? "Project";
    case "tag":
      return tagName ? `#${tagName}` : "Tag";
  }
}

export function TasksView({ filter }: { filter: TaskViewFilter }) {
  const tasks = useTasksStore((s) => s.tasks);
  const loaded = useTasksStore((s) => s.loaded);
  const projects = useTasksStore((s) => s.projects);
  const rescheduleOverdueToToday = useTasksStore((s) => s.rescheduleOverdueToToday);
  const moveManyToTrash = useTasksStore((s) => s.moveManyToTrash);
  const tags = useTagsStore((s) => s.tags);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);
  const requestConfirm = useUiStore((s) => s.requestConfirm);

  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Whether the current drag-select gesture is selecting (true) or deselecting (false)
  const sweepTarget = useRef(false);

  const topLevel = useMemo(
    () => tasks.filter((t) => !t.parentTaskId),
    [tasks],
  );

  const filtered = useMemo(() => {
    const today = todayStr();
    let result: Task[];
    switch (filter.kind) {
      case "today":
        result = topLevel.filter(
          (t) =>
            !t.isCompleted &&
            t.dueDate !== null &&
            (t.dueDate === today || isTaskOverdue(t)),
        );
        break;
      case "upcoming": {
        const horizon = dateStr(addDays(new Date(), 7));
        result = topLevel.filter(
          (t) =>
            !t.isCompleted &&
            t.dueDate !== null &&
            t.dueDate > today &&
            t.dueDate <= horizon,
        );
        break;
      }
      case "all":
        result = topLevel.filter((t) => showCompleted || !t.isCompleted);
        break;
      case "completed":
        result = topLevel.filter((t) => t.isCompleted);
        break;
      case "project":
        result = topLevel.filter(
          (t) => t.projectId === filter.projectId && (showCompleted || !t.isCompleted),
        );
        break;
      case "tag":
        result = topLevel.filter(
          (t) => t.tagIds.includes(filter.tagId) && (showCompleted || !t.isCompleted),
        );
        break;
    }
    if (priorityFilter.length > 0) {
      result = result.filter((t) => priorityFilter.includes(t.priority));
    }
    return result;
  }, [topLevel, filter, priorityFilter, showCompleted]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "manual":
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        break;
      case "dueDate":
        list.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return a.sortOrder - b.sortOrder;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return (
            a.dueDate.localeCompare(b.dueDate) ||
            (a.dueTime ?? "24:00").localeCompare(b.dueTime ?? "24:00")
          );
        });
        break;
      case "priority":
        list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
        break;
      case "createdAt":
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return list;
  }, [filtered, sortBy]);

  const overdueCount = useMemo(
    () => topLevel.filter((t) => isTaskOverdue(t)).length,
    [topLevel],
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Back to page 1 whenever the visible set changes
  useEffect(() => {
    setPage(1);
  }, [filter, sortBy, priorityFilter, showCompleted, pageSize]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  /** Upcoming view groups the current page by day */
  const groupedByDay = useMemo(() => {
    if (filter.kind !== "upcoming") return null;
    const groups = new Map<string, Task[]>();
    for (const task of paged) {
      const key = task.dueDate ?? "";
      const arr = groups.get(key) ?? [];
      arr.push(task);
      groups.set(key, arr);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [paged, filter.kind]);

  const project = filter.kind === "project" ? projects.find((p) => p.id === filter.projectId) : undefined;
  const tag = filter.kind === "tag" ? tags.find((t) => t.id === filter.tagId) : undefined;
  const title = filterTitle(filter, project?.name, tag?.name);
  const supportsCompletedToggle =
    filter.kind === "all" || filter.kind === "project" || filter.kind === "tag";

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      sweepTarget.current = next.has(id);
      return next;
    });

  /** Drag-select: apply the gesture's target state to rows swept over */
  const sweepSelected = (id: string) =>
    setSelectedIds((prev) => {
      if (prev.has(id) === sweepTarget.current) return prev;
      const next = new Set(prev);
      if (sweepTarget.current) next.add(id);
      else next.delete(id);
      return next;
    });

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    const ok = await requestConfirm({
      title: `Move ${ids.length} ${ids.length === 1 ? "task" : "tasks"} to trash?`,
      description: "You can restore them from the trash later.",
      confirmLabel: "Move to Trash",
      destructive: true,
    });
    if (!ok) return;
    await moveManyToTrash(ids);
    exitSelecting();
  };

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          {filter.kind === "project" && project && (
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: project.color }}
            />
          )}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "task" : "tasks"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {selecting ? (
            <>
              <span className="mr-1 text-sm font-medium text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedIds(
                    selectedIds.size === sorted.length
                      ? new Set()
                      : new Set(sorted.map((t) => t.id)),
                  )
                }
              >
                {selectedIds.size === sorted.length ? "Clear all" : "Select all"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => void deleteSelected()}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelecting} aria-label="Exit selection mode">
                <X className="size-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <>
          {sorted.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setSelecting(true)}>
              <CheckSquare className="size-3.5" />
              Select
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="size-3.5" />
                {SORT_LABELS[sortBy]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={sortBy === key}
                  onCheckedChange={() => setSortBy(key)}
                >
                  {SORT_LABELS[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="size-3.5" />
                Filter
                {priorityFilter.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {priorityFilter.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              {PRIORITIES.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={priorityFilter.includes(p)}
                  onCheckedChange={(checked) =>
                    setPriorityFilter((prev) =>
                      checked ? [...prev, p] : prev.filter((x) => x !== p),
                    )
                  }
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: PRIORITY_META[p].color }}
                    />
                    {PRIORITY_META[p].label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              {supportsCompletedToggle && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={showCompleted}
                    onCheckedChange={(c) => setShowCompleted(c === true)}
                  >
                    Show completed
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            onClick={() =>
              openTaskDialog({
                defaults: {
                  dueDate: filter.kind === "today" ? todayStr() : undefined,
                  projectId: filter.kind === "project" ? filter.projectId : undefined,
                },
              })
            }
          >
            <Plus className="size-4" />
            New Task
          </Button>
            </>
          )}
        </div>
      </header>

      {filter.kind === "today" && overdueCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 shadow-sm px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            {overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void rescheduleOverdueToToday()}
          >
            Reschedule all to today
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        filter.kind === "completed" ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing completed yet"
            description="Completed tasks will show up here."
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="No tasks here"
            description={
              filter.kind === "today"
                ? "You're all caught up for today. Enjoy!"
                : "Create a task to get started."
            }
            actionLabel="New Task"
            onAction={() => openTaskDialog({})}
          />
        )
      ) : groupedByDay ? (
        <div className="space-y-6">
          {groupedByDay.map(([day, dayTasks]) => (
            <section key={day}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-muted-foreground">
                {formatDayHeading(day)}
                <span className="text-xs font-normal text-muted-foreground/70">
                  {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                </span>
              </h2>
              <TaskList
                tasks={dayTasks}
                selectedIds={selecting ? selectedIds : undefined}
                onSelectToggle={selecting ? toggleSelected : undefined}
                onSelectSweep={selecting ? sweepSelected : undefined}
              />
            </section>
          ))}
        </div>
      ) : (
        <TaskList
          tasks={paged}
          sortable={sortBy === "manual" && sorted.length <= pageSize}
          selectedIds={selecting ? selectedIds : undefined}
          onSelectToggle={selecting ? toggleSelected : undefined}
          onSelectSweep={selecting ? sweepSelected : undefined}
        />
      )}

      {sorted.length > 0 && (
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                  {pageSize} / page
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {[10, 25, 50, 100].map((size) => (
                  <DropdownMenuCheckboxItem
                    key={size}
                    checked={pageSize === size}
                    onCheckedChange={() => setPageSize(size)}
                  >
                    {size} per page
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="min-w-20 text-center text-sm tabular-nums text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}


