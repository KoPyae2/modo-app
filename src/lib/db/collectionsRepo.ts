import { getDb } from "./client";
import { newId, nowIso } from "@/lib/utils";
import type { Folder, Project, Tag } from "@/types";

/** Folders (notes), projects (tasks) and tags share simple CRUD shapes. */

export const foldersRepo = {
  async getAll(): Promise<Folder[]> {
    const db = await getDb();
    const rows = await db.select<
      { id: string; name: string; color: string; sort_order: number; created_at: string }[]
    >("SELECT * FROM folders ORDER BY sort_order, name");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));
  },

  async create(name: string, color: string): Promise<Folder> {
    const db = await getDb();
    const id = newId();
    const now = nowIso();
    const maxRow = await db.select<{ m: number | null }[]>(
      "SELECT MAX(sort_order) AS m FROM folders",
    );
    const sortOrder = (maxRow[0]?.m ?? 0) + 1;
    await db.execute(
      "INSERT INTO folders (id, name, color, sort_order, created_at) VALUES ($1,$2,$3,$4,$5)",
      [id, name, color, sortOrder, now],
    );
    return { id, name, color, sortOrder, createdAt: now };
  },

  async update(folder: Folder): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE folders SET name=$2, color=$3, sort_order=$4 WHERE id=$1",
      [folder.id, folder.name, folder.color, folder.sortOrder],
    );
  },

  /** Notes inside keep existing but lose their folder (FK ON DELETE SET NULL). */
  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM folders WHERE id = $1", [id]);
  },
};

export const projectsRepo = {
  async getAll(): Promise<Project[]> {
    const db = await getDb();
    const rows = await db.select<
      { id: string; name: string; color: string; sort_order: number; created_at: string }[]
    >("SELECT * FROM projects ORDER BY sort_order, name");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));
  },

  async create(name: string, color: string): Promise<Project> {
    const db = await getDb();
    const id = newId();
    const now = nowIso();
    const maxRow = await db.select<{ m: number | null }[]>(
      "SELECT MAX(sort_order) AS m FROM projects",
    );
    const sortOrder = (maxRow[0]?.m ?? 0) + 1;
    await db.execute(
      "INSERT INTO projects (id, name, color, sort_order, created_at) VALUES ($1,$2,$3,$4,$5)",
      [id, name, color, sortOrder, now],
    );
    return { id, name, color, sortOrder, createdAt: now };
  },

  async update(project: Project): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE projects SET name=$2, color=$3, sort_order=$4 WHERE id=$1",
      [project.id, project.name, project.color, project.sortOrder],
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM projects WHERE id = $1", [id]);
  },
};

export const tagsRepo = {
  async getAll(): Promise<Tag[]> {
    const db = await getDb();
    const rows = await db.select<{ id: string; name: string; color: string }[]>(
      "SELECT * FROM tags ORDER BY name",
    );
    return rows;
  },

  async create(name: string, color: string): Promise<Tag> {
    const db = await getDb();
    const id = newId();
    await db.execute("INSERT INTO tags (id, name, color) VALUES ($1,$2,$3)", [
      id,
      name,
      color,
    ]);
    return { id, name, color };
  },

  async update(tag: Tag): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE tags SET name=$2, color=$3 WHERE id=$1", [
      tag.id,
      tag.name,
      tag.color,
    ]);
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM tags WHERE id = $1", [id]);
  },
};
