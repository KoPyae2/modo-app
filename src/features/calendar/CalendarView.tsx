import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  setMonth as setMonthIndex,
  setYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateStr, todayStr } from "@/lib/dates";
import { useTasksStore } from "@/stores/tasksStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PRIORITY_META, type Task } from "@/types";
import { DayDetailPanel } from "./DayDetailPanel";

const MAX_VISIBLE = 3;

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2026, i, 1), "MMM"),
);

/** Clickable "July 2026" title that opens a month + year jump dropdown. */
function MonthYearPicker({
  month,
  onSelect,
}: {
  month: Date;
  onSelect: (next: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => month.getFullYear());

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPickerYear(month.getFullYear());
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1.5 rounded-lg px-2 py-1 text-2xl font-bold tracking-tight transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Jump to month"
        >
          {format(month, "MMMM yyyy")}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setPickerYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold">{pickerYear}</span>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setPickerYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABELS.map((label, i) => {
            const current =
              i === month.getMonth() && pickerYear === month.getFullYear();
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onSelect(startOfMonth(setMonthIndex(setYear(month, pickerYear), i)));
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  current && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CalendarView() {
  const tasks = useTasksStore((s) => s.tasks);
  const weekStartsOn = useSettingsStore((s) => s.settings.weekStartsOn);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  /** ISO date of the day open in the slide-over panel */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn }),
      }),
    [month, weekStartsOn],
  );

  const weekdayLabels = useMemo(
    () => days.slice(0, 7).map((d) => format(d, "EEE")),
    [days],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentTaskId || !task.dueDate) continue;
      const arr = map.get(task.dueDate) ?? [];
      arr.push(task);
      map.set(task.dueDate, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) =>
        (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"),
      );
    }
    return map;
  }, [tasks]);

  const today = todayStr();

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <MonthYearPicker month={month} onSelect={setMonth} />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px text-center">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="pb-2 text-xs font-semibold text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
        {days.map((day) => {
          const key = dateStr(day);
          const dayTasks = tasksByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const visible = dayTasks.slice(0, MAX_VISIBLE);
          const hidden = dayTasks.length - visible.length;

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDay(key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedDay(key);
                }
              }}
              className={cn(
                "group flex min-h-24 cursor-pointer flex-col gap-1 bg-background p-1.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                !inMonth && "bg-muted/40 text-muted-foreground/60",
              )}
              aria-label={`Open ${format(day, "PPP")}`}
            >
              <span
                className={cn(
                  "self-end text-xs font-medium",
                  isToday(day) &&
                    "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              {visible.map((task) => {
                const overdue = !task.isCompleted && task.dueDate! < today;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs",
                      task.isCompleted && "text-muted-foreground line-through opacity-50",
                      overdue && "bg-destructive/10 text-destructive",
                    )}
                    title={task.title}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: PRIORITY_META[task.priority].color,
                      }}
                    />
                    <span className="truncate">{task.title}</span>
                    {task.recurrenceRule && (
                      <Repeat className="size-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
              {hidden > 0 && (
                <span className="rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  +{hidden} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      <DayDetailPanel dateKey={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  );
}
