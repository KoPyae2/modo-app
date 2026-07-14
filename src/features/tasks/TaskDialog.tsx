import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import {
  addDays,
  addMonths,
  format,
  getDay,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { useTasksStore } from "@/stores/tasksStore";
import { useUiStore } from "@/stores/uiStore";
import { dateStr, todayStr } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagPicker } from "@/components/TagPicker";
import { PRIORITIES, PRIORITY_META, type Priority, type RecurrenceRule } from "@/types";
import { cn, newId } from "@/lib/utils";

interface SubtaskDraft {
  id: string;
  existingId: string | null;
  title: string;
  isCompleted: boolean;
}

const RECURRENCE_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom interval..." },
] as const;

const REMINDER_OPTIONS = [
  { value: "none", label: "No reminder" },
  { value: "0", label: "At due time" },
  { value: "5", label: "5 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_OPTIONS = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateButtonLabel(value: string): string {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, "EEE, MMM d, yyyy") : "No date";
}

function normalizeTimeValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})(?::?([0-5]\d))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function TaskDialog() {
  const { open, taskId, defaults } = useUiStore((s) => s.taskDialog);
  const closeTaskDialog = useUiStore((s) => s.closeTaskDialog);
  const tasks = useTasksStore((s) => s.tasks);
  const projects = useTasksStore((s) => s.projects);
  const { addTask, updateTask, moveToTrash } = useTasksStore();

  const editing = useMemo(
    () => (taskId ? (tasks.find((t) => t.id === taskId) ?? null) : null),
    [taskId, tasks],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [projectId, setProjectId] = useState<string>("none");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [recurFreq, setRecurFreq] = useState<string>("none");
  const [recurInterval, setRecurInterval] = useState(2);
  const [reminder, setReminder] = useState<string>("none");
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setDueDate(editing.dueDate ?? "");
      setDueTime(editing.dueTime ?? "");
      setPriority(editing.priority);
      setProjectId(editing.projectId ?? "none");
      setTagIds(editing.tagIds);
      if (editing.recurrenceRule) {
        setRecurFreq(editing.recurrenceRule.freq);
        setRecurInterval(editing.recurrenceRule.interval);
      } else {
        setRecurFreq("none");
        setRecurInterval(2);
      }
      setReminder(
        editing.reminderOffsetMin === null ? "none" : String(editing.reminderOffsetMin),
      );
      setSubtasks(
        tasks
          .filter((t) => t.parentTaskId === editing.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((t) => ({
            id: t.id,
            existingId: t.id,
            title: t.title,
            isCompleted: t.isCompleted,
          })),
      );
    } else {
      setTitle(defaults.title ?? "");
      setDescription("");
      setDueDate(defaults.dueDate ?? "");
      setDueTime("");
      setPriority("medium");
      setProjectId(defaults.projectId ?? "none");
      setTagIds([]);
      setRecurFreq("none");
      setRecurInterval(2);
      setReminder("none");
      setSubtasks([]);
    }
    setNewSubtask("");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const buildRecurrence = (): RecurrenceRule | null => {
    if (recurFreq === "none") return null;
    if (recurFreq === "custom")
      return { freq: "custom", interval: Math.max(1, recurInterval) };
    return { freq: recurFreq as RecurrenceRule["freq"], interval: 1 };
  };

  const addSubtaskDraft = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks((s) => [
      ...s,
      { id: newId(), existingId: null, title: t, isCompleted: false },
    ]);
    setNewSubtask("");
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);

    const common = {
      title: trimmed,
      description: description.trim(),
      dueDate: dueDate || null,
      dueTime: dueDate && dueTime ? dueTime : null,
      priority,
      projectId: projectId === "none" ? null : projectId,
      recurrenceRule: buildRecurrence(),
      reminderOffsetMin: reminder === "none" ? null : Number(reminder),
      tagIds,
    };
    const draftsForSave = newSubtask.trim()
      ? [
          ...subtasks,
          {
            id: newId(),
            existingId: null,
            title: newSubtask.trim(),
            isCompleted: false,
          },
        ]
      : subtasks;

    try {
      if (editing) {
        await updateTask({ ...editing, ...common });
        const existing = tasks.filter((t) => t.parentTaskId === editing.id);
        const keptIds = new Set(
          draftsForSave.filter((s) => s.existingId).map((s) => s.existingId as string),
        );
        for (const sub of existing) {
          if (!keptIds.has(sub.id)) await moveToTrash(sub.id);
        }
        for (const draft of draftsForSave) {
          if (draft.existingId) {
            const row = existing.find((t) => t.id === draft.existingId);
            if (
              row &&
              (row.title !== draft.title || row.isCompleted !== draft.isCompleted)
            ) {
              await updateTask({
                ...row,
                title: draft.title,
                isCompleted: draft.isCompleted,
                completedAt: draft.isCompleted
                  ? (row.completedAt ?? new Date().toISOString())
                  : null,
              });
            }
          } else {
            await addTask({ title: draft.title, parentTaskId: editing.id });
          }
        }
      } else {
        const created = await addTask(common);
        if (created) {
          for (const draft of draftsForSave) {
            await addTask({ title: draft.title, parentTaskId: created.id });
          }
        }
      }
      closeTaskDialog();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && closeTaskDialog()}>
      <DialogContent className="h-[min(90vh,760px)] max-w-3xl flex-col overflow-hidden p-0 [display:flex]">
        <DialogHeader className="border-b bg-secondary/35 px-5 py-4 pr-12">
          <DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            <section className="space-y-3 rounded-xl border bg-background/45 p-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title</Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={2}
                />
              </div>
            </section>

            <section className="grid gap-3 rounded-xl border bg-background/45 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Due date</Label>
                <DatePickerField value={dueDate} onChange={setDueDate} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <TimePickerField
                  value={dueTime}
                  onChange={setDueTime}
                  disabled={!dueDate}
                />
              </div>
            </section>

            <section className="grid gap-3 rounded-xl border bg-background/45 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: PRIORITY_META[p].color }}
                          />
                          {PRIORITY_META[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="grid gap-3 rounded-xl border bg-background/45 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Repeat className="size-3.5" /> Repeat
                </Label>
                <Select value={recurFreq} onValueChange={setRecurFreq}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recurFreq === "custom" && (
                  <div className="flex items-center gap-2 text-sm">
                    Every
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-16"
                      value={recurInterval}
                      onChange={(e) => setRecurInterval(Number(e.target.value) || 1)}
                    />
                    days
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reminder</Label>
                <Select value={reminder} onValueChange={setReminder}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-2 rounded-xl border bg-background/45 p-4">
              <Label>Tags</Label>
              <TagPicker selectedIds={tagIds} onChange={setTagIds} />
            </section>

            <section className="space-y-2 rounded-xl border bg-background/45 p-4">
              <Label>Subtasks</Label>
              <div className="space-y-1.5">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2 rounded-xl bg-secondary/35 p-1.5"
                  >
                    <Checkbox
                      checked={sub.isCompleted}
                      onCheckedChange={(checked) =>
                        setSubtasks((s) =>
                          s.map((x) =>
                            x.id === sub.id ? { ...x, isCompleted: checked === true } : x,
                          ),
                        )
                      }
                      aria-label={`Toggle subtask ${sub.title}`}
                    />
                    <Input
                      value={sub.title}
                      className={cn(
                        "h-8 border-transparent bg-transparent shadow-none",
                        sub.isCompleted && "text-muted-foreground line-through",
                      )}
                      onChange={(e) =>
                        setSubtasks((s) =>
                          s.map((x) =>
                            x.id === sub.id ? { ...x, title: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label="Remove subtask"
                      onClick={() =>
                        setSubtasks((s) => s.filter((x) => x.id !== sub.id))
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-xl border border-dashed bg-background/45 p-1.5">
                  <Plus className="size-4 text-muted-foreground" />
                  <Input
                    value={newSubtask}
                    className="h-8 border-transparent bg-transparent shadow-none"
                    placeholder="Add subtask..."
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubtaskDraft();
                      }
                    }}
                  />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t bg-card px-5 py-4">
            <Button
              variant="outline"
              type="button"
              onClick={closeTaskDialog}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DatePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseDateValue(value);
  const [month, setMonth] = useState(() => selected ?? parseISO(todayStr()));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) setMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const monthStart = startOfMonth(month);
  const startOffset = getDay(monthStart);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = parseISO(todayStr());

  const pickDate = (date: Date) => {
    onChange(dateStr(date));
    setMonth(date);
    setOpen(false);
  };

  const clearDate = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 w-full justify-start rounded-xl bg-card text-left font-medium",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-4 text-primary" />
          <span className="truncate">{dateButtonLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Previous month"
              onClick={() => setMonth((current) => subMonths(current, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Next month"
              onClick={() => setMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOffset }).map((_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = new Date(month.getFullYear(), month.getMonth(), index + 1);
              const active = selected ? isSameDay(day, selected) : false;
              const isCurrentDay = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDate(day)}
                  className={cn(
                    "grid h-9 place-items-center rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                    !active && isCurrentDay && "border border-primary/45 text-primary",
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => pickDate(today)}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => pickDate(addDays(today, 1))}>
              Tomorrow
            </Button>
            <Button variant="outline" size="sm" onClick={() => pickDate(addDays(today, 7))}>
              Next week
            </Button>
            <Button variant="ghost" size="sm" onClick={clearDate}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimePickerField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const applyDraft = () => {
    const normalized = normalizeTimeValue(draft);
    if (!normalized) return;
    onChange(normalized);
    setOpen(false);
  };

  const pickTime = (time: string) => {
    onChange(time);
    setOpen(false);
  };

  const clearTime = () => {
    onChange("");
    setDraft("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-start rounded-xl bg-card text-left font-medium",
            !value && "text-muted-foreground",
          )}
        >
          <Clock className="size-4 text-primary" />
          <span>{disabled ? "Pick date first" : value || "No time"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3"
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {["09:00", "12:00", "15:00", "18:00"].map((time) => (
              <Button
                key={time}
                variant={value === time ? "default" : "outline"}
                size="sm"
                onClick={() => pickTime(time)}
              >
                {time}
              </Button>
            ))}
          </div>

          <div
            className="max-h-44 space-y-1 overflow-y-auto overscroll-contain rounded-lg border bg-background/55 p-1"
            onWheel={(event) => event.stopPropagation()}
          >
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => pickTime(time)}
                className={cn(
                  "flex h-8 w-full items-center rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  value === time && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                {time}
              </button>
            ))}
          </div>

          <div className="flex gap-2 border-t pt-3">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="HH:mm"
              className="h-9"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyDraft();
                }
              }}
            />
            <Button size="sm" onClick={applyDraft}>
              Set
            </Button>
            <Button variant="ghost" size="sm" onClick={clearTime}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
