import { getDb } from "./client";
import { newId, nowIso } from "@/lib/utils";
import type { ScratchpadEntry } from "@/types";

interface ScratchpadRow {
  id: string;
  content: string;
  created_at: string;
}

function rowToEntry(row: ScratchpadRow): ScratchpadEntry {
  return { id: row.id, content: row.content, createdAt: row.created_at };
}

export const scratchpadRepo = {
  async getAll(): Promise<ScratchpadEntry[]> {
    const db = await getDb();
    const rows = await db.select<ScratchpadRow[]>(
      "SELECT * FROM scratchpad_entries ORDER BY created_at DESC",
    );
    return rows.map(rowToEntry);
  },

  async create(content: string): Promise<ScratchpadEntry> {
    const db = await getDb();
    const id = newId();
    const now = nowIso();
    await db.execute(
      "INSERT INTO scratchpad_entries (id, content, created_at) VALUES ($1, $2, $3)",
      [id, content, now],
    );
    return { id, content, createdAt: now };
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM scratchpad_entries WHERE id = $1", [id]);
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM scratchpad_entries");
  },
};
