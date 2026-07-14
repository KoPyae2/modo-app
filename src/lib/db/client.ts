import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

/** Singleton DB handle. Migrations run in Rust when the DB is first loaded. */
export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:notetodo.db");
  }
  return db;
}
