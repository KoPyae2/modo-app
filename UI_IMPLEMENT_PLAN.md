# UI Implementation Plan: Cute Modern Next-Gen Refresh

## Goal

Upgrade the current Note + Todo interface into a polished, cute, modern desktop productivity app while preserving the existing app architecture, data model, keyboard shortcuts, and offline-first behavior.

The target feel is: calm, friendly, fast, soft, tactile, and highly scannable. The app should look more custom than a stock admin panel, but it must remain practical for repeated daily use.

## Design Direction

Use a refined **Soft UI Evolution** style:

- Warm, friendly surfaces with subtle depth.
- Clear contrast in light and dark mode.
- Rounded but not toy-like controls.
- Soft color accents for status, folders, projects, and priority.
- Dense enough for a productivity dashboard, but with better spacing rhythm.
- Motion should feel responsive, not decorative.

Avoid:

- Heavy glassmorphism.
- Large decorative gradients.
- Marketing-page composition.
- Random shadows or inconsistent border radii.
- Emoji-based UI icons.
- Overly playful visuals that reduce productivity.

## Visual System

### Color Tokens

Replace the current mostly blue/slate visual identity with a warmer but still professional system.

Recommended light mode:

- Background: warm off-white.
- Surface: clean white with subtle warm tint.
- Muted surface: pale peach/cream.
- Primary: warm orange/coral.
- Accent: confident blue or teal.
- Success: mint green.
- Warning: amber.
- Destructive: clear red.

Keep semantic tokens in [src/index.css](src/index.css):

- `--color-background`
- `--color-foreground`
- `--color-card`
- `--color-muted`
- `--color-primary`
- `--color-accent`
- `--color-destructive`
- `--color-border`
- `--color-ring`

Add missing semantic intent tokens only if they remove repeated ad hoc styling:

- `--color-success`
- `--color-warning`
- `--color-info`
- `--shadow-soft`
- `--shadow-popover`

### Dark Mode

Dark mode should not be a simple inversion.

Use:

- Deep neutral background.
- Slightly raised card surfaces.
- Desaturated primary/accent tones.
- Borders that remain visible.
- Secondary text with at least 3:1 contrast.
- Primary body text with at least 4.5:1 contrast.

### Typography

Keep system fonts for now unless we intentionally add bundled or network-loaded fonts later.

Improve hierarchy using:

- App shell labels: 12-13px, medium weight.
- Body/list rows: 14px.
- Editor text: controlled by the existing editor font-size setting.
- Page title: 22-26px, 650-700 weight.
- Card headings: 13-15px, 600 weight.

Do not introduce tiny text below 12px except metadata where it remains readable.

### Shape And Elevation

Use a consistent shape system:

- Small controls: 6px radius.
- Cards/list rows/dialogs: 10-14px radius.
- Large app-shell panels: 16px radius only where useful.
- Avoid nested card-in-card styling.

Use subtle shadows only for:

- Dialogs.
- Popovers/dropdowns.
- Dragging task item.
- Important floating controls.

## Layout Plan

### App Shell

Files:

- [src/App.tsx](src/App.tsx)
- [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
- [src/index.css](src/index.css)

Changes:

- Give the app shell a more intentional background with subtle warm/neutral tone.
- Make the sidebar feel like a persistent productivity rail.
- Add stronger selected navigation affordance using icon, label, and a small accent marker.
- Keep collapsed sidebar behavior.
- Ensure all icon-only sidebar actions have visible focus and `aria-label`.

Acceptance:

- Current view is obvious at a glance.
- Sidebar works in light/dark mode.
- No horizontal overflow at minimum window width.

### Dashboard

File:

- [src/features/dashboard/Dashboard.tsx](src/features/dashboard/Dashboard.tsx)

Changes:

- Convert dashboard into a stronger daily command center.
- Make the date/header compact but more expressive.
- Improve quick-add input with better visual affordance, focus state, and parse hints.
- Replace plain stat cards with soft metric tiles.
- Make Today, Upcoming, Pinned Notes, and Recent Notes use consistent row patterns.
- Add subtle section-level empty states.

Acceptance:

- User can scan today’s work within 3 seconds.
- Quick-add is the primary action.
- Cards remain compact and useful, not decorative.

### Tasks

Files:

- [src/features/tasks/TasksView.tsx](src/features/tasks/TasksView.tsx)
- [src/features/tasks/TaskList.tsx](src/features/tasks/TaskList.tsx)
- [src/features/tasks/TaskItem.tsx](src/features/tasks/TaskItem.tsx)
- [src/features/tasks/TaskDialog.tsx](src/features/tasks/TaskDialog.tsx)

Changes:

- Make task rows softer and more tactile.
- Add clearer completion, overdue, recurring, tag, and project states.
- Improve drag handle visibility without relying only on hover.
- Keep manual sorting stable.
- Improve TaskDialog grouping:
  - Basics.
  - Schedule.
  - Organization.
  - Subtasks.
- Add loading/disabled states to save buttons to prevent double submit.

Acceptance:

- Due/overdue state is obvious without relying on color alone.
- Task actions are discoverable by keyboard and mouse.
- Dialog remains usable at smaller heights.

### Notes

Files:

- [src/features/notes/NotesView.tsx](src/features/notes/NotesView.tsx)
- [src/features/notes/NoteEditor.tsx](src/features/notes/NoteEditor.tsx)
- [src/features/notes/EditorToolbar.tsx](src/features/notes/EditorToolbar.tsx)

Changes:

- Make notes list feel like a modern document inbox.
- Add clearer selected note state.
- Improve note editor focus and reading comfort.
- Keep editor font-size setting working.
- Improve toolbar grouping and active states.
- Ensure pinned/favorite/tag/folder controls are understandable and accessible.

Acceptance:

- User can tell which note is selected.
- Editor feels calm and focused.
- Toolbar buttons have clear hover, active, disabled, and focus states.

### Settings

File:

- [src/features/settings/SettingsView.tsx](src/features/settings/SettingsView.tsx)

Changes:

- Replace simple stacked cards with cleaner grouped preference rows.
- Add more direct feedback when settings are saved or require OS permission.
- Keep the recently fixed editor font size, notification permission, and autostart sync behavior.
- Add helper text only where it clarifies behavior.

Acceptance:

- Every setting visibly changes something or clearly explains when it applies.
- Async system settings show disabled/loading state.

### Trash

File:

- [src/features/trash/TrashView.tsx](src/features/trash/TrashView.tsx)

Changes:

- Improve empty state and item rows.
- Visually separate restore from permanent delete.
- Keep destructive action confirmation.

Acceptance:

- Restore is primary.
- Permanent delete is clearly destructive and visually separated.

## Component System Updates

Files:

- [src/components/ui/button.tsx](src/components/ui/button.tsx)
- [src/components/ui/input.tsx](src/components/ui/input.tsx)
- [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx)
- [src/components/ui/dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx)
- [src/components/ui/select.tsx](src/components/ui/select.tsx)
- [src/components/ui/badge.tsx](src/components/ui/badge.tsx)

Update these first so feature screens benefit automatically:

- Better focus rings.
- Consistent transition duration: 150-200ms.
- Stronger disabled state.
- `cursor-pointer` on interactive controls.
- Minimum practical hit area for icon buttons.
- Softer popover/dialog shadow.
- Consistent border radius.

## Motion System

Add small, purposeful motion:

- Hover/press feedback on buttons and task rows.
- Dialog/popover enter: fade + small scale/translate.
- View content: subtle fade/translate on route/view change if low risk.
- Dragging: shadow + slight scale.

Rules:

- Use transform/opacity only.
- Keep motion 150-250ms for micro-interactions.
- Respect `prefers-reduced-motion`.
- Avoid infinite decorative animations.

## Accessibility Checklist

Must pass before delivery:

- All icon-only buttons have accessible labels.
- Keyboard focus is visible.
- Dialogs trap focus and close with Escape.
- Color is not the only signal for priority, overdue, or destructive states.
- Text contrast meets WCAG AA.
- Touch/click targets are comfortable.
- Reduced motion mode does not break interactions.

## Implementation Phases

### Phase 1: Foundation

1. Update global tokens in [src/index.css](src/index.css).
2. Add motion/reduced-motion utility rules.
3. Upgrade shared UI primitives: button, input, dialog, select, dropdown, badge.
4. Verify `npm run build`.

### Phase 2: App Shell And Dashboard

1. Refresh sidebar navigation.
2. Refresh dashboard header, quick-add, metric tiles, and task/note cards.
3. Verify keyboard shortcuts and command palette still work.
4. Verify light and dark mode.

### Phase 3: Tasks

1. Refresh task list row design.
2. Refresh task badges and status indicators.
3. Improve task dialog layout and async save state.
4. Verify recurrence, subtasks, reorder, trash, and reminders.

### Phase 4: Notes

1. Refresh notes list.
2. Refresh editor surface and toolbar.
3. Confirm editor font size setting works.
4. Confirm autosave still flushes on note switch.

### Phase 5: Settings, Trash, Polish

1. Refresh settings preference groups.
2. Refresh trash rows and empty state.
3. Add final micro-interactions.
4. Run accessibility and responsive checks.
5. Run `npm run build` and `cargo check`.

## Verification Plan

Run after each phase:

```powershell
npm run build
```

Run before final delivery:

```powershell
cd src-tauri
cargo check
```

Manual checks:

- Light mode.
- Dark mode.
- Window minimum size: 720x480.
- Notes editor font size setting.
- Notification permission flow.
- Autostart toggle state.
- Create/edit/delete/restore task.
- Create/edit/delete/restore note.
- Import/export backup.
- Keyboard shortcuts.
- Command palette.

## Success Criteria

The refresh is complete when:

- The app no longer looks like a default component demo.
- The visual language is consistent across Dashboard, Tasks, Notes, Settings, and Trash.
- The UI feels friendly and cute without losing productivity density.
- Settings and core workflows remain functional.
- Builds pass.
- No obvious accessibility regressions are introduced.
