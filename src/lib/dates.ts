import {
  addDays,
  format,
  isBefore,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Task } from "@/types";

/** Today's local date as "yyyy-MM-dd" */
export function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function dateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Combine a task's dueDate + dueTime into a local Date (end of day when no time). */
export function taskDueAt(task: Pick<Task, "dueDate" | "dueTime">): Date | null {
  if (!task.dueDate) return null;
  const date = parseISO(task.dueDate);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(":").map(Number);
    date.setHours(h, m, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

export function isTaskOverdue(task: Task): boolean {
  if (task.isCompleted || !task.dueDate) return false;
  const due = taskDueAt(task);
  return due !== null && isBefore(due, new Date());
}

export function isTaskDueToday(task: Task): boolean {
  return task.dueDate !== null && isToday(parseISO(task.dueDate));
}

/** Human label for a due date: Today, Tomorrow, Mon Jul 13, ... */
export function formatDueDate(dueDate: string, dueTime: string | null): string {
  const d = parseISO(dueDate);
  let label: string;
  if (isToday(d)) label = "Today";
  else if (isTomorrow(d)) label = "Tomorrow";
  else if (isBefore(d, startOfDay(new Date()))) label = format(d, "MMM d");
  else if (isBefore(d, addDays(new Date(), 7))) label = format(d, "EEE");
  else label = format(d, "MMM d");
  return dueTime ? `${label} ${dueTime}` : label;
}

export function formatDayHeading(dateIso: string): string {
  const d = parseISO(dateIso);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

export function formatTimestamp(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy h:mm a");
}

export function formatRelativeUpdated(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  return format(d, "MMM d, yyyy");
}
