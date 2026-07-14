import { getDb } from "./client";
import { newId, nowIso } from "@/lib/utils";
import type { Snippet } from "@/types";

interface SnippetRow {
  id: string;
  title: string;
  language: string;
  description: string;
  code: string;
  is_favorite: number;
  is_trashed: number;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    description: row.description,
    code: row.code,
    isFavorite: row.is_favorite === 1,
    isTrashed: row.is_trashed === 1,
    trashedAt: row.trashed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const snippetsRepo = {
  async getAll(): Promise<Snippet[]> {
    const db = await getDb();
    const rows = await db.select<SnippetRow[]>(
      "SELECT * FROM snippets WHERE is_trashed = 0 ORDER BY is_favorite DESC, updated_at DESC",
    );
    return rows.map(rowToSnippet);
  },

  async getTrashed(): Promise<Snippet[]> {
    const db = await getDb();
    const rows = await db.select<SnippetRow[]>(
      "SELECT * FROM snippets WHERE is_trashed = 1 ORDER BY trashed_at DESC",
    );
    return rows.map(rowToSnippet);
  },

  async create(input: {
    title?: string;
    language?: string;
    description?: string;
    code?: string;
  }): Promise<Snippet> {
    const db = await getDb();
    const id = newId();
    const now = nowIso();
    await db.execute(
      `INSERT INTO snippets (id, title, language, description, code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        id,
        input.title ?? "",
        input.language ?? "Plain Text",
        input.description ?? "",
        input.code ?? "",
        now,
      ],
    );
    return {
      id,
      title: input.title ?? "",
      language: input.language ?? "Plain Text",
      description: input.description ?? "",
      code: input.code ?? "",
      isFavorite: false,
      isTrashed: false,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  },

  async update(snippet: Snippet): Promise<string> {
    const db = await getDb();
    const now = nowIso();
    await db.execute(
      `UPDATE snippets SET
        title=$2, language=$3, description=$4, code=$5,
        is_favorite=$6, is_trashed=$7, trashed_at=$8, updated_at=$9
      WHERE id=$1`,
      [
        snippet.id,
        snippet.title,
        snippet.language,
        snippet.description,
        snippet.code,
        snippet.isFavorite ? 1 : 0,
        snippet.isTrashed ? 1 : 0,
        snippet.trashedAt,
        now,
      ],
    );
    return now;
  },

  async moveToTrash(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE snippets SET is_trashed = 1, trashed_at = $2, updated_at = $2 WHERE id = $1",
      [id, nowIso()],
    );
  },

  async restore(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE snippets SET is_trashed = 0, trashed_at = NULL, updated_at = $2 WHERE id = $1",
      [id, nowIso()],
    );
  },

  async deletePermanently(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM snippets WHERE id = $1", [id]);
  },

  async purgeOldTrash(days: number): Promise<void> {
    const db = await getDb();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    await db.execute(
      "DELETE FROM snippets WHERE is_trashed = 1 AND trashed_at < $1",
      [cutoff],
    );
  },
};
