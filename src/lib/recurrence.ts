import { addDays, addMonths, addWeeks, parseISO } from "date-fns";
import { dateStr, todayStr } from "@/lib/dates";
import type { RecurrenceRule } from "@/types";

export function parseRecurrence(raw: string | null): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "freq" in parsed &&
      "interval" in parsed
    ) {
      const rule = parsed as RecurrenceRule;
      if (
        ["daily", "weekly", "monthly", "custom"].includes(rule.freq) &&
        typeof rule.interval === "number" &&
        rule.interval >= 1
      ) {
        return rule;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeRecurrence(rule: RecurrenceRule | null): string | null {
  return rule ? JSON.stringify(rule) : null;
}

/**
 * Next occurrence date after completing a recurring task.
 * Based on the task's due date (or today when it had none / was overdue past today).
 */
export function nextOccurrence(rule: RecurrenceRule, dueDate: string | null): string {
  const base = dueDate ? parseISO(dueDate) : parseISO(todayStr());
  let next: Date;
  switch (rule.freq) {
    case "daily":
      next = addDays(base, rule.interval);
      break;
    case "weekly":
      next = addWeeks(base, rule.interval);
      break;
    case "monthly":
      next = addMonths(base, rule.interval);
      break;
    case "custom":
      next = addDays(base, rule.interval);
      break;
  }
  // If the computed date is still in the past (task was long overdue), roll forward from today
  const today = parseISO(todayStr());
  while (next < today) {
    switch (rule.freq) {
      case "daily":
      case "custom":
        next = addDays(next, rule.interval);
        break;
      case "weekly":
        next = addWeeks(next, rule.interval);
        break;
      case "monthly":
        next = addMonths(next, rule.interval);
        break;
    }
  }
  return dateStr(next);
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const n = rule.interval;
  switch (rule.freq) {
    case "daily":
      return n === 1 ? "Daily" : `Every ${n} days`;
    case "weekly":
      return n === 1 ? "Weekly" : `Every ${n} weeks`;
    case "monthly":
      return n === 1 ? "Monthly" : `Every ${n} months`;
    case "custom":
      return `Every ${n} days`;
  }
}
