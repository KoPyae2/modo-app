import { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Hash,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDate, isTaskOverdue } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { useTasksStore } from "@/stores/tasksStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useUiStore } from "@/stores/uiStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { PRIORITY_META, type Task } from "@/types";

interface TaskItemProps {
  task: Task;
  /** Enable the drag handle (manual sort only) */
  draggable?: boolean;
  /** Selection mode: checkbox selects instead of completing */
  selected?: boolean;
  onSelectToggle?: (id: string) => void;
  /** Called when the pointer sweeps over this row with the button held (drag-select) */
  onSelectSweep?: (id: string) => void;
}

export function TaskItem({ task, draggable = false, selected = false, onSelectToggle, onSelectSweep }: TaskItemProps) {
  const tasks = useTasksStore((s) => s.tasks);
  const projects = useTasksStore((s) => s.projects);
  const { toggleComplete, moveToTrash } = useTasksStore();
  const tags = useTagsStore((s) => s.tags);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const [expanded, setExpanded] = useState(false);

  const subtasks = useMemo(
    () =>
      tasks
        .filter((t) => t.parentTaskId === task.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks, task.id],
  );
  const doneCount = subtasks.filter((t) => t.isCompleted).length;
  const project = projects.find((p) => p.id === task.projectId);
  const taskTags = tags.filter((t) => task.tagIds.includes(t.id));
  const overdue = isTaskOverdue(task);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !draggable });

  const handleDelete = async () => {
    const ok = await requestConfirm({
      title: "Move task to trash?",
      description: `"${task.title}" will be moved to trash. You can restore it later.`,
      confirmLabel: "Move to Trash",
      destructive: true,
    });
    if (ok) void moveToTrash(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group cute-card rounded-xl transition-colors duration-150 hover:border-primary/25",
        isDragging && "z-10 opacity-70 shadow-lg",
        onSelectToggle && "cursor-pointer select-none",
        selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/30",
      )}
      // ponytail: drag-select = toggle on pointerdown, sweep rows while button held
      onPointerDown={
        onSelectToggle
          ? (e) => {
              if (e.button === 0) onSelectToggle(task.id);
            }
          : undefined
      }
      onPointerEnter={
        onSelectSweep
          ? (e) => {
              if (e.buttons === 1) onSelectSweep(task.id);
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2 p-3">
        {draggable && (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 opacity-60 transition-opacity hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        {onSelectToggle ? (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelectToggle(task.id)}
            className="pointer-events-none mt-0.5 size-5 rounded-md"
            aria-label={`Select "${task.title}"`}
          />
        ) : (
          <Checkbox
            checked={task.isCompleted}
            onCheckedChange={() => void toggleComplete(task.id)}
            className="mt-0.5 size-5 rounded-md"
            aria-label={`Mark "${task.title}" ${task.isCompleted ? "incomplete" : "complete"}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className={cn(
                "min-w-0 rounded-sm text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                task.isCompleted && "text-muted-foreground line-through",
              )}
              onClick={onSelectToggle ? undefined : () => openTaskDialog({ taskId: task.id })}
            >
              {task.title}
            </button>
            {!onSelectToggle && (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => openTaskDialog({ taskId: task.id })}
                aria-label="Edit task"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="iconSm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void handleDelete()}
                aria-label="Delete task"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            )}
          </div>

          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className={PRIORITY_META[task.priority].badgeClass}>
              {PRIORITY_META[task.priority].label}
            </Badge>
            {task.dueDate && (
              <Badge
                variant="outline"
                className={cn(overdue && "border-destructive/50 text-destructive")}
              >
                <Calendar className="size-3" />
                {formatDueDate(task.dueDate, task.dueTime)}
                {overdue && " · Overdue"}
              </Badge>
            )}
            {task.recurrenceRule && (
              <Badge variant="secondary">
                <Repeat className="size-3" />
                {describeRecurrence(task.recurrenceRule)}
              </Badge>
            )}
            {project && (
              <Badge variant="outline">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                {project.name}
              </Badge>
            )}
            {taskTags.map((tag) => (
              <Badge key={tag.id} variant="outline" style={{ color: tag.color }}>
                <Hash className="size-3" />
                {tag.name}
              </Badge>
            ))}
          </div>

          {subtasks.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <span>
                  {doneCount}/{subtasks.length} subtasks
                </span>
                <Progress
                  value={(doneCount / subtasks.length) * 100}
                  className="max-w-32 flex-1"
                />
              </button>
              {expanded && (
                <ul className="mt-1.5 space-y-1 pl-5">
                  {subtasks.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={sub.isCompleted}
                        onCheckedChange={() => void toggleComplete(sub.id)}
                        className="size-3.5"
                        aria-label={`Toggle subtask ${sub.title}`}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          sub.isCompleted && "text-muted-foreground line-through",
                        )}
                      >
                        {sub.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


