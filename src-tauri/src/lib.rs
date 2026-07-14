use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial_schema",
        kind: MigrationKind::Up,
        sql: r#"
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#6b7280',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#6b7280',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                content_json TEXT NOT NULL DEFAULT '{}',
                content_text TEXT NOT NULL DEFAULT '',
                folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_trashed INTEGER NOT NULL DEFAULT 0,
                trashed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                due_date TEXT,
                due_time TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                is_completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                recurrence_rule TEXT,
                parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_trashed INTEGER NOT NULL DEFAULT 0,
                trashed_at TEXT,
                reminder_offset_min INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#6b7280'
            );

            CREATE TABLE IF NOT EXISTS note_tags (
                note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (note_id, tag_id)
            );

            CREATE TABLE IF NOT EXISTS task_tags (
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (task_id, tag_id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
            CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
        "#,
    },
    Migration {
        version: 2,
        description: "scratchpad_snippets_fts",
        kind: MigrationKind::Up,
        sql: r#"
            CREATE TABLE IF NOT EXISTS scratchpad_entries (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                language TEXT NOT NULL DEFAULT 'Plain Text',
                description TEXT NOT NULL DEFAULT '',
                code TEXT NOT NULL DEFAULT '',
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_trashed INTEGER NOT NULL DEFAULT 0,
                trashed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_snippets_updated ON snippets(updated_at);
            CREATE INDEX IF NOT EXISTS idx_scratchpad_created ON scratchpad_entries(created_at);

            CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                title, content_text,
                content='notes', content_rowid='rowid',
                tokenize='unicode61 remove_diacritics 2'
            );
            CREATE TRIGGER IF NOT EXISTS trg_notes_fts_ai AFTER INSERT ON notes BEGIN
                INSERT INTO notes_fts(rowid, title, content_text)
                VALUES (new.rowid, new.title, new.content_text);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_notes_fts_ad AFTER DELETE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, title, content_text)
                VALUES ('delete', old.rowid, old.title, old.content_text);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_notes_fts_au AFTER UPDATE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, title, content_text)
                VALUES ('delete', old.rowid, old.title, old.content_text);
                INSERT INTO notes_fts(rowid, title, content_text)
                VALUES (new.rowid, new.title, new.content_text);
            END;
            INSERT INTO notes_fts(rowid, title, content_text)
                SELECT rowid, title, content_text FROM notes;

            CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
                title, description,
                content='tasks', content_rowid='rowid',
                tokenize='unicode61 remove_diacritics 2'
            );
            CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_ai AFTER INSERT ON tasks BEGIN
                INSERT INTO tasks_fts(rowid, title, description)
                VALUES (new.rowid, new.title, new.description);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_ad AFTER DELETE ON tasks BEGIN
                INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
                VALUES ('delete', old.rowid, old.title, old.description);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_au AFTER UPDATE ON tasks BEGIN
                INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
                VALUES ('delete', old.rowid, old.title, old.description);
                INSERT INTO tasks_fts(rowid, title, description)
                VALUES (new.rowid, new.title, new.description);
            END;
            INSERT INTO tasks_fts(rowid, title, description)
                SELECT rowid, title, description FROM tasks;

            CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
                title, description, code,
                content='snippets', content_rowid='rowid',
                tokenize='unicode61 remove_diacritics 2'
            );
            CREATE TRIGGER IF NOT EXISTS trg_snippets_fts_ai AFTER INSERT ON snippets BEGIN
                INSERT INTO snippets_fts(rowid, title, description, code)
                VALUES (new.rowid, new.title, new.description, new.code);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_snippets_fts_ad AFTER DELETE ON snippets BEGIN
                INSERT INTO snippets_fts(snippets_fts, rowid, title, description, code)
                VALUES ('delete', old.rowid, old.title, old.description, old.code);
            END;
            CREATE TRIGGER IF NOT EXISTS trg_snippets_fts_au AFTER UPDATE ON snippets BEGIN
                INSERT INTO snippets_fts(snippets_fts, rowid, title, description, code)
                VALUES ('delete', old.rowid, old.title, old.description, old.code);
                INSERT INTO snippets_fts(rowid, title, description, code)
                VALUES (new.rowid, new.title, new.description, new.code);
            END;
        "#,
    }]
}

const DB_URL: &str = "sqlite:notetodo.db";

/// Tables importable from a JSON backup, in FK-safe insert order, each with
/// its allowed columns. Doubles as the SQL identifier whitelist — only these
/// names ever reach a query string.
const IMPORT_TABLES: &[(&str, &[&str])] = &[
    ("folders", &["id", "name", "color", "sort_order", "created_at"]),
    ("projects", &["id", "name", "color", "sort_order", "created_at"]),
    ("tags", &["id", "name", "color"]),
    (
        "notes",
        &[
            "id", "title", "content_json", "content_text", "folder_id", "is_pinned",
            "is_favorite", "is_trashed", "trashed_at", "created_at", "updated_at",
        ],
    ),
    (
        "tasks",
        &[
            "id", "title", "description", "due_date", "due_time", "priority",
            "project_id", "is_completed", "completed_at", "recurrence_rule",
            "parent_task_id", "sort_order", "is_trashed", "trashed_at",
            "reminder_offset_min", "created_at", "updated_at",
        ],
    ),
    ("note_tags", &["note_id", "tag_id"]),
    ("task_tags", &["task_id", "tag_id"]),
    ("settings", &["key", "value"]),
    (
        "snippets",
        &[
            "id", "title", "language", "description", "code", "is_favorite",
            "is_trashed", "trashed_at", "created_at", "updated_at",
        ],
    ),
    ("scratchpad_entries", &["id", "content", "created_at"]),
];

/// External-content FTS indexes to rebuild after a bulk import.
const FTS_TABLES: &[&str] = &["notes_fts", "tasks_fts", "snippets_fts"];

type BackupRow = serde_json::Map<String, serde_json::Value>;

fn bind_json<'q>(
    query: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    value: &'q serde_json::Value,
) -> Result<sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>, String> {
    use serde_json::Value;
    Ok(match value {
        Value::Null => query.bind(None::<String>),
        Value::Bool(b) => query.bind(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                query.bind(i)
            } else {
                query.bind(n.as_f64().ok_or("unsupported number in backup")?)
            }
        }
        Value::String(s) => query.bind(s.as_str()),
        _ => return Err("nested arrays/objects are not allowed in a backup".into()),
    })
}

/// Replaces the contents of every table present in `data` in ONE real
/// transaction on a single pooled connection. The JS layer must never issue
/// raw BEGIN/COMMIT through db.execute(): statements go through a connection
/// pool, so a manual transaction spans connections and leaves the database
/// write-locked (which then makes every later write time out).
#[tauri::command]
async fn import_backup(
    app: tauri::AppHandle,
    data: std::collections::HashMap<String, Vec<BackupRow>>,
) -> Result<(), String> {
    for table in data.keys() {
        if !IMPORT_TABLES.iter().any(|(name, _)| name == table) {
            return Err(format!("unknown table in backup: {table}"));
        }
    }

    let pool = {
        let instances = app.state::<tauri_plugin_sql::DbInstances>();
        let lock = instances.0.read().await;
        match lock.get(DB_URL) {
            Some(tauri_plugin_sql::DbPool::Sqlite(pool)) => pool.clone(),
            _ => return Err("database is not loaded yet".into()),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    // Backup rows arrive in file order (tasks may reference parent tasks that
    // come later); enforce foreign keys at commit instead of per statement.
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Delete in reverse FK order, only tables the backup actually contains
    for (table, _) in IMPORT_TABLES.iter().rev() {
        if data.contains_key(*table) {
            sqlx::query(&format!("DELETE FROM {table}"))
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    for (table, allowed) in IMPORT_TABLES {
        let Some(rows) = data.get(*table) else { continue };
        for row in rows {
            // Whitelisted columns only, in the table's canonical order
            let cols: Vec<&str> = allowed
                .iter()
                .copied()
                .filter(|c| row.contains_key(*c))
                .collect();
            if cols.is_empty() || cols.len() != row.len() {
                return Err(format!("invalid row in backup table {table}"));
            }
            let sql = format!(
                "INSERT OR REPLACE INTO {table} ({}) VALUES ({})",
                cols.join(","),
                vec!["?"; cols.len()].join(",")
            );
            let mut query = sqlx::query(&sql);
            for col in &cols {
                query = bind_json(query, &row[*col])?;
            }
            query.execute(&mut *tx).await.map_err(|e| e.to_string())?;
        }
    }

    // Bulk delete + insert can leave external-content FTS indexes stale;
    // a rebuild is cheap and guarantees search consistency.
    for fts in FTS_TABLES {
        let exists: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
                .bind(fts)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        if exists.is_some() {
            sqlx::query(&format!("INSERT INTO {fts}({fts}) VALUES('rebuild')"))
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())
}

/// Bring the frameless quick-capture window to the front, centered, focused.
fn show_quick_capture(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("quick-capture") {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("quick://focus", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing window when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&["quick-capture"])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:notetodo.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![import_backup])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
            }
            // Global quick-capture hotkey (Ctrl+Shift+Space) — works even when
            // the app is hidden in the tray. Registration failure (e.g. the
            // combo is taken by another app) must not prevent startup.
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, _shortcut, event| {
                        if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            show_quick_capture(app);
                        }
                    })
                    .build(),
            )?;
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                if let Err(err) = app.global_shortcut().register("ctrl+shift+space") {
                    eprintln!("failed to register quick-capture shortcut: {err}");
                }
            }

            let quick_drop = MenuItem::with_id(app, "quick_drop", "Quick Drop", true, None::<&str>)?;
            let new_task = MenuItem::with_id(app, "new_task", "New Task", true, None::<&str>)?;
            let new_note = MenuItem::with_id(app, "new_note", "New Note", true, None::<&str>)?;
            let toggle = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quick_drop, &new_task, &new_note, &toggle, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("MoDo")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let show_window = |app: &tauri::AppHandle| {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    };
                    match event.id().as_ref() {
                        "quick_drop" => show_quick_capture(app),
                        "new_task" => {
                            show_window(app);
                            let _ = app.emit("tray://new-task", ());
                        }
                        "new_note" => {
                            show_window(app);
                            let _ = app.emit("tray://new-note", ());
                        }
                        "toggle" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Left click on the tray icon shows the window
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
