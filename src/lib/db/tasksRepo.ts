import { getDb } from "./client";
import { newId, nowIso } from "@/lib/utils";
import { parseRecurrence, serializeRecurrence } from "@/lib/recurrence";
import type { Priority, RecurrenceRule, Task } from "@/types";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  project_id: string | null;
  is_completed: number;
  completed_at: string | null;
  recurrence_rule: string | null;
  parent_task_id: string | null;
  sort_order: number;
  is_trashed: number;
  trashed_at: string | null;
  reminder_offset_min: number | null;
  created_at: string;
  updated_at: string;
  tag_ids: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    dueTime: row.due_time,
    priority: row.priority as Priority,
    projectId: row.project_id,
    isCompleted: row.is_completed === 1,
    completedAt: row.completed_at,
    recurrenceRule: parseRecurrence(row.recurrence_rule),
    parentTaskId: row.parent_task_id,
    sortOrder: row.sort_order,
    isTrashed: row.is_trashed === 1,
    trashedAt: row.trashed_at,
    reminderOffsetMin: row.reminder_offset_min,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tagIds: row.tag_ids ? row.tag_ids.split(",") : [],
  };
}

const SELECT_TASKS = `
  SELECT t.*, (
    SELECT GROUP_CONCAT(tt.tag_id) FROM task_tags tt WHERE tt.task_id = t.id
  ) AS tag_ids
  FROM tasks t
`;

export interface NewTaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: Priority;
  projectId?: string | null;
  recurrenceRule?: RecurrenceRule | null;
  parentTaskId?: string | null;
  reminderOffsetMin?: number | null;
  tagIds?: string[];
}

export const tasksRepo = {
  /** All tasks including completed and subtasks; excludes trashed. */
  async getAll(): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<TaskRow[]>(
      `${SELECT_TASKS} WHERE t.is_trashed = 0 ORDER BY t.sort_order, t.created_at`,
    );
    return rows.map(rowToTask);
  },

  async getTrashed(): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<TaskRow[]>(
      `${SELECT_TASKS} WHERE t.is_trashed = 1 ORDER BY t.trashed_at DESC`,
    );
    return rows.map(rowToTask);
  },

  async create(input: NewTaskInput): Promise<Task> {
    const db = await getDb();
    const id = newId();
    const now = nowIso();
    const maxRow = await db.select<{ max_order: number | null }[]>(
      "SELECT MAX(sort_order) AS max_order FROM tasks WHERE is_trashed = 0",
    );
    const sortOrder = (maxRow[0]?.max_order ?? 0) + 1;

    await db.execute(
      `INSERT INTO tasks (
        id, title, description, due_date, due_time, priority, project_id,
        is_completed, recurrence_rule, parent_task_id, sort_order,
        reminder_offset_min, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$12)`,
      [
        id,
        input.title,
        input.description ?? "",
        input.dueDate ?? null,
        input.dueTime ?? null,
        input.priority ?? "medium",
        input.projectId ?? null,
        serializeRecurrence(input.recurrenceRule ?? null),
        input.parentTaskId ?? null,
        sortOrder,
        input.reminderOffsetMin ?? null,
        now,
      ],
    );
    if (input.tagIds?.length) {
      await this.setTags(id, input.tagIds);
    }
    return {
      id,
      title: input.title,
      description: input.description ?? "",
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      priority: input.priority ?? "medium",
      projectId: input.projectId ?? null,
      isCompleted: false,
      completedAt: null,
      recurrenceRule: input.recurrenceRule ?? null,
      parentTaskId: input.parentTaskId ?? null,
      sortOrder,
      isTrashed: false,
      trashedAt: null,
      reminderOffsetMin: input.reminderOffsetMin ?? null,
      createdAt: now,
      updatedAt: now,
      tagIds: input.tagIds ?? [],
    };
  },

  async update(task: Task): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE tasks SET
        title=$2, description=$3, due_date=$4, due_time=$5, priority=$6,
        project_id=$7, is_completed=$8, completed_at=$9, recurrence_rule=$10,
        parent_task_id=$11, sort_order=$12, is_trashed=$13, trashed_at=$14,
        reminder_offset_min=$15, updated_at=$16
      WHERE id=$1`,
      [
        task.id,
        task.title,
        task.description,
        task.dueDate,
        task.dueTime,
        task.priority,
        task.projectId,
        task.isCompleted ? 1 : 0,
        task.completedAt,
        serializeRecurrence(task.recurrenceRule),
        task.parentTaskId,
        task.sortOrder,
        task.isTrashed ? 1 : 0,
        task.trashedAt,
        task.reminderOffsetMin,
        nowIso(),
      ],
    );
    await this.setTags(task.id, task.tagIds);
  },

  async setTags(taskId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM task_tags WHERE task_id = $1", [taskId]);
    for (const tagId of tagIds) {
      await db.execute(
        "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)",
        [taskId, tagId],
      );
    }
  },

  async setSortOrders(orders: { id: string; sortOrder: number }[]): Promise<void> {
    const db = await getDb();
    for (const { id, sortOrder } of orders) {
      await db.execute("UPDATE tasks SET sort_order = $2 WHERE id = $1", [
        id,
        sortOrder,
      ]);
    }
  },

  async moveToTrash(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE tasks SET is_trashed = 1, trashed_at = $2, updated_at = $2 WHERE id = $1 OR parent_task_id = $1",
      [id, nowIso()],
    );
  },

  async restore(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE tasks SET is_trashed = 0, trashed_at = NULL, updated_at = $2 WHERE id = $1 OR parent_task_id = $1",
      [id, nowIso()],
    );
  },

  async deletePermanently(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "DELETE FROM tasks WHERE id = $1 OR parent_task_id = $1",
      [id],
    );
  },

  /** Permanently remove trashed tasks older than `days` days. */
  async purgeOldTrash(days: number): Promise<void> {
    const db = await getDb();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    await db.execute(
      "DELETE FROM tasks WHERE is_trashed = 1 AND trashed_at < $1",
      [cutoff],
    );
  },

  async search(query: string, limit = 20): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<TaskRow[]>(
      `${SELECT_TASKS}
       WHERE t.is_trashed = 0 AND (t.title LIKE $1 OR t.description LIKE $1)
       ORDER BY t.is_completed, t.updated_at DESC LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows.map(rowToTask);
  },
};
