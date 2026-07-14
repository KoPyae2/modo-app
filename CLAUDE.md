# MoDo (formerly Note + Todo) — Tauri v2 Desktop App

Local-first, offline-capable desktop productivity app: Notes + Todos + unified Dashboard.

## Model & token economy (IMPORTANT)

Default to the cheapest model that can do the job. Do NOT use the top-tier model for everything.

- **Small tasks** (typo fixes, renames, single-line edits, formatting, writing a simple component from an existing pattern, commit messages): use the smallest/fastest model. Delegate to a subagent with `model: haiku`.
- **Normal tasks** (standard feature work, bug fixes with a known cause, refactors within one file, writing tests): use the mid-tier model (`model: sonnet`).
- **Top-tier model only for**: cross-cutting architecture changes, tricky multi-file debugging, Rust ↔ frontend IPC design, DB migration design.
- Ask before escalating to the top-tier model for long-running work.

Token discipline:
- Search with `grep`/`glob` for symbols instead of reading whole files; read only the line ranges you need.
- Never re-read a file you already have in context unless it changed.
- Don't read `package-lock.json`, `Cargo.lock`, `dist/`, `node_modules/`, or `src-tauri/target/`.
- Make targeted edits; never rewrite a whole file for a small change.
- Keep replies short: what changed, where, and how to verify. No restating code you just wrote.
- Run `npm run build` / `cargo check` only when finishing a change or when asked — not after every edit.
- Use subagents for exploratory/broad searches so raw output stays out of the main context.

## Stack
- React 19 + TypeScript (strict, no `any`), Vite
- Tauri v2 (Rust backend)
- SQLite via `tauri-plugin-sql` (migrations defined in Rust, `src-tauri/src/lib.rs`)
- Zustand stores per domain: `tasksStore`, `notesStore`, `uiStore`, `settingsStore`
- Tailwind CSS v4 (`@tailwindcss/vite`), shadcn-style components on Radix primitives in `src/components/ui/`
- TipTap v2 (rich text; stored as JSON in `content_json` + plain text in `content_text` for search)
- CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/language-data`, lazy-loaded language modes) for the snippet vault
- SQLite FTS5 (`notes_fts`, `tasks_fts`, `snippets_fts` + sync triggers in migration v2) powers unified search; `searchRepo` falls back to LIKE if FTS5 is unavailable
- lucide-react icons, date-fns, @dnd-kit (drag & drop), sonner (toasts), cmdk (command palette)

## Architecture rules
- All DB access through the typed repository layer in `src/lib/db/` — never raw SQL in components
- Optimistic UI updates in stores, then persist to SQLite; rollback + toast on error
- IDs are `crypto.randomUUID()` TEXT primary keys
- Soft delete (trash) for notes, tasks, and snippets; auto-purge after 30 days on startup
- Debounced autosave (800 ms) for the note editor
- Confirm dialogs for destructive actions; empty states for every list view
- New DB schema changes go in a new migration version in `src-tauri/src/lib.rs` — never edit existing migrations
- Reuse `src/components/ui/` primitives; don't create one-off styled components

## Structure
- `src/components/` — shared UI (`ui/` primitives, layout, command palette, search dialog)
- `src/features/{notes,tasks,dashboard,snippets,scratchpad,settings,trash}/`
- `src/stores/`, `src/lib/` (db layer, utils, recurrence), `src/hooks/`, `src/types/`
- `src/quick/` — separate React entry (`quick.html`) for the frameless quick-capture window (Vite multi-page build)

## Key behaviors
- Recurring tasks (daily/weekly/monthly/custom interval) regenerate the next occurrence on completion
- Reminders: polled in-frontend, fired via Tauri notification plugin (due time + configurable pre-reminder)
- System tray (Rust) emits `tray://new-task`, `tray://new-note` events; frontend listens
- Global quick-drop: OS-wide Ctrl+Shift+Space (tauri-plugin-global-shortcut, registered in Rust) shows the always-on-top `quick-capture` window; Enter saves to `scratchpad_entries` and emits `scratchpad://changed` for the main window; Esc/blur hides. Scratchpad entries convert to tasks/notes
- Keyboard: Ctrl+K palette, Ctrl+F search everything, Ctrl+N note, Ctrl+T task, Ctrl+1/2/3/4/5 views, Ctrl+, settings, Ctrl+/ help, Esc closes
- Theme light/dark/system persisted in `settings` table; `dark` class on `<html>`

## Workflow
- Plan multi-file changes briefly before editing; skip planning for trivial edits
- Verify: `npm run build` for TS changes, `cargo check` in `src-tauri/` for Rust changes — only the one that applies
- Never commit unless explicitly asked

## Commands
- `npm run tauri dev` — run app
- `npm run build` — typecheck (tsc) + bundle frontend
- `cargo check` in `src-tauri/` — verify Rust
