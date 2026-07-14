import { addDays, nextMonday, nextSunday } from "date-fns";
import { dateStr, todayStr } from "@/lib/dates";
import type { AppSettings, Priority } from "@/types";

export interface QuickAddResult {
  kind: "task" | "note";
  title: string;
  dueDate: string | null;
  priority: Priority;
}

/**
 * Natural quick-add parsing:
 *  - "note: shopping ideas" → creates a note
 *  - "today" / "tomorrow" / "next week" set the due date
 *  - "!low !med !high !urgent" set priority
 */
export function parseQuickAdd(
  raw: string,
  weekStartsOn: AppSettings["weekStartsOn"] = 1,
): QuickAddResult | null {
  let text = raw.trim();
  if (!text) return null;

  if (/^note:/i.test(text)) {
    return {
      kind: "note",
      title: text.replace(/^note:\s*/i, "").trim(),
      dueDate: null,
      priority: "medium",
    };
  }

  let dueDate: string | null = null;
  let priority: Priority = "medium";

  const priorityMatch = text.match(/!(urgent|high|med(?:ium)?|low)\b/i);
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase();
    priority = p.startsWith("med") ? "medium" : (p as Priority);
    text = text.replace(priorityMatch[0], "").trim();
  }

  const applyDate = (pattern: RegExp, date: string) => {
    if (dueDate) return;
    const m = text.match(pattern);
    if (m) {
      dueDate = date;
      text = text.replace(m[0], "").replace(/\s{2,}/g, " ").trim();
    }
  };

  applyDate(/\btoday\b/i, todayStr());
  applyDate(/\btomorrow\b/i, dateStr(addDays(new Date(), 1)));
  applyDate(
    /\bnext week\b/i,
    dateStr(weekStartsOn === 0 ? nextSunday(new Date()) : nextMonday(new Date())),
  );

  if (!text) return null;
  return { kind: "task", title: text, dueDate, priority };
}
