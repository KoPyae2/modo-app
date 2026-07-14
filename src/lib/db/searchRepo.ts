import { getDb } from "./client";
import type { SearchHit } from "@/types";

/**
 * Match ranges in excerpts are wrapped in these control characters instead of
 * HTML so results can be rendered as React nodes without injecting markup.
 */
export const HIGHLIGHT_START = String.fromCharCode(1);
export const HIGHLIGHT_END = String.fromCharCode(2);

const EXCERPT_TOKENS = 12;
const LIMIT_PER_TYPE = 8;

/**
 * Turn free text into an FTS5 MATCH expression: every token quoted (so user
 * input can't break the query syntax), the last token as a prefix so results
 * update while typing. Returns null when there is nothing to search for.
 */
function buildMatchQuery(raw: string): string | null {
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '""'))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`)).join(" ");
}

interface NoteHitRow {
  id: string;
  title: string;
  folder_id: string | null;
  excerpt: string;
}

interface TaskHitRow {
  id: string;
  title: string;
  excerpt: string;
}

interface SnippetHitRow {
  id: string;
  title: string;
  language: string;
  excerpt: string;
}

async function ftsSearch(match: string): Promise<SearchHit[]> {
  const db = await getDb();
  const [noteRows, taskRows, snippetRows] = await Promise.all([
    db.select<NoteHitRow[]>(
      `SELECT n.id, n.title, n.folder_id,
              snippet(notes_fts, -1, $2, $3, '…', $4) AS excerpt
       FROM notes_fts
       JOIN notes n ON n.rowid = notes_fts.rowid
       WHERE notes_fts MATCH $1 AND n.is_trashed = 0
       ORDER BY bm25(notes_fts, 4.0, 1.0)
       LIMIT $5`,
      [match, HIGHLIGHT_START, HIGHLIGHT_END, EXCERPT_TOKENS, LIMIT_PER_TYPE],
    ),
    db.select<TaskHitRow[]>(
      `SELECT t.id, t.title,
              snippet(tasks_fts, -1, $2, $3, '…', $4) AS excerpt
       FROM tasks_fts
       JOIN tasks t ON t.rowid = tasks_fts.rowid
       WHERE tasks_fts MATCH $1 AND t.is_trashed = 0
       ORDER BY bm25(tasks_fts, 4.0, 1.0)
       LIMIT $5`,
      [match, HIGHLIGHT_START, HIGHLIGHT_END, EXCERPT_TOKENS, LIMIT_PER_TYPE],
    ),
    db.select<SnippetHitRow[]>(
      `SELECT s.id, s.title, s.language,
              snippet(snippets_fts, -1, $2, $3, '…', $4) AS excerpt
       FROM snippets_fts
       JOIN snippets s ON s.rowid = snippets_fts.rowid
       WHERE snippets_fts MATCH $1 AND s.is_trashed = 0
       ORDER BY bm25(snippets_fts, 4.0, 2.0, 1.0)
       LIMIT $5`,
      [match, HIGHLIGHT_START, HIGHLIGHT_END, EXCERPT_TOKENS, LIMIT_PER_TYPE],
    ),
  ]);

  return [
    ...noteRows.map<SearchHit>((r) => ({
      type: "note",
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      folderId: r.folder_id,
    })),
    ...taskRows.map<SearchHit>((r) => ({
      type: "task",
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
    })),
    ...snippetRows.map<SearchHit>((r) => ({
      type: "snippet",
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      language: r.language,
    })),
  ];
}

/** Build a marked excerpt around the first case-insensitive match of `query`. */
function likeExcerpt(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, 80);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, idx) +
    HIGHLIGHT_START +
    text.slice(idx, idx + query.length) +
    HIGHLIGHT_END +
    text.slice(idx + query.length, end) +
    (end < text.length ? "…" : "")
  );
}

/** Substring fallback in case FTS5 is unavailable in the bundled SQLite. */
async function likeSearch(query: string): Promise<SearchHit[]> {
  const db = await getDb();
  const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const [noteRows, taskRows, snippetRows] = await Promise.all([
    db.select<{ id: string; title: string; folder_id: string | null; content_text: string }[]>(
      `SELECT id, title, folder_id, content_text FROM notes
       WHERE is_trashed = 0 AND (title LIKE $1 ESCAPE '\\' OR content_text LIKE $1 ESCAPE '\\')
       ORDER BY updated_at DESC LIMIT $2`,
      [pattern, LIMIT_PER_TYPE],
    ),
    db.select<{ id: string; title: string; description: string }[]>(
      `SELECT id, title, description FROM tasks
       WHERE is_trashed = 0 AND (title LIKE $1 ESCAPE '\\' OR description LIKE $1 ESCAPE '\\')
       ORDER BY updated_at DESC LIMIT $2`,
      [pattern, LIMIT_PER_TYPE],
    ),
    db.select<{ id: string; title: string; language: string; description: string; code: string }[]>(
      `SELECT id, title, language, description, code FROM snippets
       WHERE is_trashed = 0 AND (title LIKE $1 ESCAPE '\\' OR description LIKE $1 ESCAPE '\\' OR code LIKE $1 ESCAPE '\\')
       ORDER BY updated_at DESC LIMIT $2`,
      [pattern, LIMIT_PER_TYPE],
    ),
  ]);

  return [
    ...noteRows.map<SearchHit>((r) => ({
      type: "note",
      id: r.id,
      title: r.title,
      excerpt: likeExcerpt(`${r.title} ${r.content_text}`, query),
      folderId: r.folder_id,
    })),
    ...taskRows.map<SearchHit>((r) => ({
      type: "task",
      id: r.id,
      title: r.title,
      excerpt: likeExcerpt(`${r.title} ${r.description}`, query),
    })),
    ...snippetRows.map<SearchHit>((r) => ({
      type: "snippet",
      id: r.id,
      title: r.title,
      excerpt: likeExcerpt(`${r.title} ${r.description} ${r.code}`, query),
      language: r.language,
    })),
  ];
}

let ftsAvailable = true;

export const searchRepo = {
  /** Unified ranked search over notes, tasks and snippets. */
  async searchAll(query: string): Promise<SearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (ftsAvailable) {
      const match = buildMatchQuery(trimmed);
      if (!match) return [];
      try {
        return await ftsSearch(match);
      } catch (err) {
        console.error("FTS search failed, falling back to LIKE", err);
        ftsAvailable = false;
      }
    }
    return likeSearch(trimmed);
  },
};
