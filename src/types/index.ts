export type Priority = "low" | "medium" | "high" | "urgent";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "custom";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** every N days/weeks/months; for "custom" this is a day interval */
  interval: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** ISO date, e.g. "2026-07-08" */
  dueDate: string | null;
  /** "HH:mm" 24h */
  dueTime: string | null;
  priority: Priority;
  projectId: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  recurrenceRule: RecurrenceRule | null;
  parentTaskId: string | null;
  sortOrder: number;
  isTrashed: boolean;
  trashedAt: string | null;
  reminderOffsetMin: number | null;
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
}

export interface Note {
  id: string;
  title: string;
  /** TipTap document as JSON string */
  contentJson: string;
  /** Plain text extraction for search */
  contentText: string;
  folderId: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface ScratchpadEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface Snippet {
  id: string;
  title: string;
  /** Language name matching @codemirror/language-data, or "Plain Text" */
  language: string;
  description: string;
  code: string;
  isFavorite: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHit {
  type: "note" | "task" | "snippet";
  id: string;
  title: string;
  /** Excerpt with match ranges wrapped in HIGHLIGHT_START/HIGHLIGHT_END markers */
  excerpt: string;
  /** Notes only — needed for navigation */
  folderId?: string | null;
  /** Snippets only */
  language?: string;
}

export type ThemeMode = "light" | "dark" | "system";

export type AppView =
  | { name: "dashboard" }
  | { name: "calendar" }
  | { name: "tasks"; filter: TaskViewFilter }
  | { name: "notes"; folderId?: string | null; noteId?: string }
  | { name: "snippets"; snippetId?: string }
  | { name: "scratchpad" }
  | { name: "settings" }
  | { name: "trash" };

export type TaskViewFilter =
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "all" }
  | { kind: "completed" }
  | { kind: "project"; projectId: string }
  | { kind: "tag"; tagId: string };

export interface AppSettings {
  theme: ThemeMode;
  defaultView: "dashboard" | "tasks" | "notes";
  notificationsEnabled: boolean;
  preReminderMin: number;
  editorFontSize: number;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  autostart: boolean;
  backgroundLight: string; // "none" | light background id, shown in light mode
  backgroundDark: string; // "none" | dark background id, shown in dark mode
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  defaultView: "dashboard",
  notificationsEnabled: true,
  preReminderMin: 15,
  editorFontSize: 16,
  weekStartsOn: 1,
  autostart: false,
  backgroundLight: "none",
  backgroundDark: "none",
};

export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; badgeClass: string }
> = {
  low: {
    label: "Low",
    color: "#64748b",
    badgeClass:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  medium: {
    label: "Medium",
    color: "#3b82f6",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  high: {
    label: "High",
    color: "#f59e0b",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  urgent: {
    label: "Urgent",
    color: "#ef4444",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

/** Palette for folders / projects / tags */
export const COLOR_CHOICES = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#6b7280",
] as const;
