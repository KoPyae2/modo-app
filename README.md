# MoDo

A desktop productivity app for notes, tasks, snippets, reminders, and quick capture. Built with Tauri 2, React 19, TypeScript, Vite, Tailwind CSS, Zustand, TipTap, CodeMirror, and SQLite.

## Features

- Tasks with due dates, due times, priorities, subtasks, recurrence, reminders, sorting, filters, projects, and tags.
- Notes with a TipTap rich text editor, folders, tags, pinned notes, favorites, and editor font-size settings.
- Snippets with CodeMirror editing, language selection, favorites, search, and copy support.
- Scratchpad / Quick Drop for fast capture from anywhere.
- Dashboard with quick add, progress, streak, overdue, today, upcoming, and recent notes.
- Global search and command palette.
- Trash with restore and permanent delete.
- Custom Tauri title bar with app window controls.
- System tray actions for opening the app, quick drop, new task, and new note.
- Desktop notifications and optional autostart.
- Light, dark, and system theme modes.

## Tech Stack

- App shell: Tauri 2
- Frontend: React 19, TypeScript, Vite
- Styling: Tailwind CSS 4, Radix primitives, lucide-react icons
- State: Zustand
- Database: SQLite through `@tauri-apps/plugin-sql`
- Editor: TipTap
- Code editor: CodeMirror
- Native plugins: notification, autostart, opener, global shortcut, window state, single instance

## Requirements

- Node.js and npm
- Rust toolchain
- Tauri system dependencies for your OS

For Windows development, install the Microsoft C++ Build Tools / Visual Studio Build Tools if Rust or Tauri asks for them.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the Tauri app in development:

```bash
npm run tauri dev
```

Run only the Vite frontend:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Build the desktop app:

```bash
npm run tauri build
```

## Useful Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build frontend |
| `npm run preview` | Preview built frontend |
| `npm run tauri dev` | Run the desktop app in development |
| `npm run tauri build` | Build production desktop bundles |

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Command palette |
| `Ctrl/Cmd + F` | Search everything |
| `Ctrl/Cmd + N` | New note |
| `Ctrl/Cmd + T` | New task |
| `Ctrl/Cmd + 1` | Dashboard |
| `Ctrl/Cmd + 2` | Today tasks |
| `Ctrl/Cmd + 3` | Notes |
| `Ctrl/Cmd + 4` | Snippets |
| `Ctrl/Cmd + 5` | Scratchpad |
| `Ctrl/Cmd + Shift + Space` | Quick Drop system-wide shortcut |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + /` | Keyboard shortcuts help |
| `Esc` | Close dialogs |

## Project Structure

```text
src/
  components/          shared UI, layout, dialogs, command/search tools
  components/layout/   app title bar and sidebar
  components/ui/       local UI primitives
  features/            dashboard, tasks, notes, snippets, scratchpad, settings, trash
  hooks/               keyboard shortcuts, reminders, tray events
  lib/                 database repositories, dates, recurrence, TipTap helpers
  quick/               Quick Drop window frontend
  stores/              Zustand state stores
  types/               shared TypeScript types

src-tauri/
  capabilities/        Tauri permissions
  icons/               bundled app icons
  src/                 Rust setup, migrations, tray, global shortcut, windows
  tauri.conf.json      Tauri application config

public/
  app-icon.png         app icon used by the frontend
```

## Native App Notes

- The main window uses a custom title bar, so Tauri window decorations are disabled in `src-tauri/tauri.conf.json`.
- App icons are configured in `src-tauri/icons` and referenced by the Tauri bundle config.
- SQLite data is stored through the Tauri SQL plugin using `sqlite:notetodo.db`.
- Quick Drop runs in the separate `quick.html` window and is opened by the global shortcut or tray menu.
- The app registers `Ctrl+Shift+Space` as the global quick-capture shortcut.

## UI Direction

The current interface is designed as a calm desktop productivity workspace:

- logo-color based blue/teal theme
- minimal professional sidebar
- full-screen empty states
- custom title bar
- consistent light and dark mode tokens
- compact task, note, snippet, and dashboard surfaces

## Development Notes

- Keep UI colors tied to semantic tokens in `src/index.css`.
- Prefer existing local components in `src/components/ui` before adding new libraries.
- Keep Tauri permissions in sync with native APIs used by the frontend.
- Run `npm run build` before packaging to catch TypeScript errors.
- Use `npm run tauri dev` for real desktop behavior, tray behavior, window controls, notifications, and global shortcuts.

## Current Build Status

`npm run build` passes. Vite may print a large chunk warning because the app includes rich editor and CodeMirror language modules.
