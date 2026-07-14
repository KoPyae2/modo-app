import { getDb } from "./client";
import { newId, nowIso } from "@/lib/utils";
import type { Note } from "@/types";

interface NoteRow {
  id: string;
  title: string;
  content_json: string;
  content_text: string;
  folder_id: string | null;
  is_pinned: number;
  is_favorite: number;
  is_trashed: number;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
  tag_ids: string | null;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    contentJson: row.content_json,
    contentText: row.content_text,
    folderId: row.folder_id,
    isPinned: row.is_pinned === 1,
    isFavorite: row.is_favorite === 1,
    isTrashed: row.is_trashed === 1,
    trashedAt: row.trashed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tagIds: row.tag_ids ? row.tag_ids.split(",") : [],
  };
}

const SELECT_NOTES = `
  SELECT n.*, (
    SELECT GROUP_CONCAT(nt.tag_id) FROM note_tags nt WHERE nt.note_id = n.id
  ) AS tag_ids
  FROM notes n
`;

export const notesRepo = {
  async getAll(): Promise<Note[]> {
    const db = await getDb();
    const rows = await db.select<NoteRow[]>(
      `${SELECT_NOTES} WHERE n.is_trashed = 0 ORDER BY n.is_pinned DESC, n.updated_at DESC`,
    );
    return rows.map(rowToNote);
  },

  async getTrashed(): Promise<Note[]> {
    const db = await getDb();
    const rows = await db.select<NoteRow[]>(
      `${SELECT_NOTES} WHERE n.is_trashed = 1 ORDER BY n.trashed_at DESC`,
    );
    return rows.map(rowToNote);
  },

  async create(input: {
    title?: string;
    contentJson?: string;
    contentText?: string;
    folderId?: string | null;
  }): Promise<Note> {
    const db = await getDb();
    const id = newId();
    const now = nowIso();
    await db.execute(
      `INSERT INTO notes (id, title, content_json, content_text, folder_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        id,
        input.title ?? "",
        input.contentJson ?? "{}",
        input.contentText ?? "",
        input.folderId ?? null,
        now,
      ],
    );
    return {
      id,
      title: input.title ?? "",
      contentJson: input.contentJson ?? "{}",
      contentText: input.contentText ?? "",
      folderId: input.folderId ?? null,
      isPinned: false,
      isFavorite: false,
      isTrashed: false,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
      tagIds: [],
    };
  },

  async update(note: Note): Promise<void> {
    const db = await getDb();
    await db.execute(
      `UPDATE notes SET
        title=$2, content_json=$3, content_text=$4, folder_id=$5,
        is_pinned=$6, is_favorite=$7, is_trashed=$8, trashed_at=$9, updated_at=$10
      WHERE id=$1`,
      [
        note.id,
        note.title,
        note.contentJson,
        note.contentText,
        note.folderId,
        note.isPinned ? 1 : 0,
        note.isFavorite ? 1 : 0,
        note.isTrashed ? 1 : 0,
        note.trashedAt,
        nowIso(),
      ],
    );
    await this.setTags(note.id, note.tagIds);
  },

  /** Content-only update used by autosave; keeps tag writes off the hot path. */
  async updateContent(
    id: string,
    title: string,
    contentJson: string,
    contentText: string,
  ): Promise<string> {
    const db = await getDb();
    const now = nowIso();
    await db.execute(
      "UPDATE notes SET title=$2, content_json=$3, content_text=$4, updated_at=$5 WHERE id=$1",
      [id, title, contentJson, contentText, now],
    );
    return now;
  },

  async setTags(noteId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM note_tags WHERE note_id = $1", [noteId]);
    for (const tagId of tagIds) {
      await db.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES ($1, $2)",
        [noteId, tagId],
      );
    }
  },

  async moveToTrash(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE notes SET is_trashed = 1, trashed_at = $2, updated_at = $2 WHERE id = $1",
      [id, nowIso()],
    );
  },

  async restore(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE notes SET is_trashed = 0, trashed_at = NULL, updated_at = $2 WHERE id = $1",
      [id, nowIso()],
    );
  },

  async deletePermanently(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM notes WHERE id = $1", [id]);
  },

  async purgeOldTrash(days: number): Promise<void> {
    const db = await getDb();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    await db.execute(
      "DELETE FROM notes WHERE is_trashed = 1 AND trashed_at < $1",
      [cutoff],
    );
  },

  async search(query: string, limit = 20): Promise<Note[]> {
    const db = await getDb();
    const rows = await db.select<NoteRow[]>(
      `${SELECT_NOTES}
       WHERE n.is_trashed = 0 AND (n.title LIKE $1 OR n.content_text LIKE $1)
       ORDER BY n.updated_at DESC LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows.map(rowToNote);
  },
};
