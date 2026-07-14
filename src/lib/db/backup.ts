import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./client";

/** Tables included in JSON backups, in FK-safe insert order. */
const TABLES = [
  "folders",
  "projects",
  "tags",
  "notes",
  "tasks",
  "note_tags",
  "task_tags",
  "settings",
  "snippets",
  "scratchpad_entries",
] as const;

/** Tables that may be absent (version 1 backups predate them). */
const OPTIONAL_TABLES = new Set<TableName>(["snippets", "scratchpad_entries"]);

type TableName = (typeof TABLES)[number];
type Row = Record<string, unknown>;

const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  folders: ["id", "name", "color", "sort_order", "created_at"],
  projects: ["id", "name", "color", "sort_order", "created_at"],
  tags: ["id", "name", "color"],
  notes: [
    "id",
    "title",
    "content_json",
    "content_text",
    "folder_id",
    "is_pinned",
    "is_favorite",
    "is_trashed",
    "trashed_at",
    "created_at",
    "updated_at",
  ],
  tasks: [
    "id",
    "title",
    "description",
    "due_date",
    "due_time",
    "priority",
    "project_id",
    "is_completed",
    "completed_at",
    "recurrence_rule",
    "parent_task_id",
    "sort_order",
    "is_trashed",
    "trashed_at",
    "reminder_offset_min",
    "created_at",
    "updated_at",
  ],
  note_tags: ["note_id", "tag_id"],
  task_tags: ["task_id", "tag_id"],
  settings: ["key", "value"],
  snippets: [
    "id",
    "title",
    "language",
    "description",
    "code",
    "is_favorite",
    "is_trashed",
    "trashed_at",
    "created_at",
    "updated_at",
  ],
  scratchpad_entries: ["id", "content", "created_at"],
};

const REQUIRED_COLUMNS: Record<TableName, readonly string[]> = {
  folders: ["id", "name", "color", "sort_order", "created_at"],
  projects: ["id", "name", "color", "sort_order", "created_at"],
  tags: ["id", "name", "color"],
  notes: [
    "id",
    "title",
    "content_json",
    "content_text",
    "is_pinned",
    "is_favorite",
    "is_trashed",
    "created_at",
    "updated_at",
  ],
  tasks: [
    "id",
    "title",
    "description",
    "priority",
    "is_completed",
    "sort_order",
    "is_trashed",
    "created_at",
    "updated_at",
  ],
  note_tags: ["note_id", "tag_id"],
  task_tags: ["task_id", "tag_id"],
  settings: ["key", "value"],
  snippets: [
    "id",
    "title",
    "language",
    "description",
    "code",
    "is_favorite",
    "is_trashed",
    "created_at",
    "updated_at",
  ],
  scratchpad_entries: ["id", "content", "created_at"],
};

export interface BackupFile {
  /** "modo" going forward; "note-todo" accepted for pre-rename backups */
  app: "modo" | "note-todo";
  /** v1: notes/tasks only. v2 adds snippets + scratchpad_entries. */
  version: 1 | 2;
  exportedAt: string;
  data: Partial<Record<TableName, Row[]>>;
}

export async function exportAllData(): Promise<BackupFile> {
  const db = await getDb();
  const data = {} as Record<TableName, Row[]>;
  for (const table of TABLES) {
    data[table] = await db.select<Row[]>(`SELECT * FROM ${table}`);
  }
  return {
    app: "modo",
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function isValidBackup(parsed: unknown): parsed is BackupFile {
  if (typeof parsed !== "object" || parsed === null) return false;
  const candidate = parsed as Partial<BackupFile>;
  if (
    (candidate.app !== "modo" && candidate.app !== "note-todo") ||
    (candidate.version !== 1 && candidate.version !== 2) ||
    typeof candidate.data !== "object" ||
    candidate.data === null ||
    Array.isArray(candidate.data)
  ) {
    return false;
  }

  const data = candidate.data as Record<string, unknown>;
  const tableSet = new Set<string>(TABLES);
  if (Object.keys(data).some((table) => !tableSet.has(table))) return false;

  for (const table of TABLES) {
    const rows = data[table];
    if (rows === undefined && OPTIONAL_TABLES.has(table)) continue;
    if (!Array.isArray(rows)) return false;
    const allowedColumns = new Set(TABLE_COLUMNS[table]);
    for (const row of rows) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        return false;
      }
      const record = row as Row;
      if (Object.keys(record).some((column) => !allowedColumns.has(column))) {
        return false;
      }
      if (
        REQUIRED_COLUMNS[table].some(
          (column) => !(column in record) || record[column] === null,
        )
      ) {
        return false;
      }
      if (
        Object.values(record).some(
          (value) =>
            value !== null &&
            typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean",
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Replaces ALL existing data with the backup contents.
 *
 * Runs in Rust (`import_backup` command) inside a single real transaction on
 * one pooled connection. Issuing BEGIN/COMMIT through db.execute() is not
 * safe: the sql plugin uses a connection pool, so the transaction spans
 * connections and leaves the DB write-locked — which is what made settings
 * writes time out with "Failed to save setting" after a broken import.
 */
export async function importAllData(backup: BackupFile): Promise<void> {
  if (!isValidBackup(backup)) {
    throw new Error("Invalid backup file");
  }
  // Ensure the DB is loaded (and migrations ran) before the Rust side
  // looks up the connection pool.
  await getDb();
  await invoke("import_backup", { data: backup.data });
}
