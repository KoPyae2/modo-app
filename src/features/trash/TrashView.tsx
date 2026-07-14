import { useEffect, useMemo, useState } from "react";
import { Code2, FileText, ListTodo, RotateCcw, Trash2, X } from "lucide-react";
import { formatTimestamp } from "@/lib/dates";
import { useNotesStore } from "@/stores/notesStore";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { useLazyList } from "@/hooks/useLazyList";

type TrashKind = "task" | "note" | "snippet";

interface TrashEntry {
  kind: TrashKind;
  id: string;
  title: string;
  meta?: string;
  trashedAt: string | null;
}

const entryKey = (e: Pick<TrashEntry, "kind" | "id">) => `${e.kind}:${e.id}`;

function TrashSection({
  icon,
  title,
  entries,
  selected,
  onToggle,
  onToggleAll,
  onRestore,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  entries: TrashEntry[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: (entries: TrashEntry[], select: boolean) => void;
  onRestore: (entry: TrashEntry) => void;
  onDelete: (entry: TrashEntry) => void;
}) {
  const { visible, hasMore, sentinelRef } = useLazyList(entries, 50);
  if (entries.length === 0) return null;
  const allSelected = entries.every((e) => selected.has(entryKey(e)));
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(c) => onToggleAll(entries, c === true)}
          aria-label={`Select all ${title.toLowerCase()}`}
          className="size-4"
        />
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground [&_svg]:size-4">
          {icon} {title}
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {entries.length}
          </span>
        </h2>
      </div>
      <div className="space-y-2">
        {visible.map((entry) => {
          const key = entryKey(entry);
          const isSelected = selected.has(key);
          return (
            <div
              key={key}
              className={
                "flex items-center gap-3 cute-card rounded-xl px-4 py-2.5" +
                (isSelected ? " border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "")
              }
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(key)}
                aria-label={`Select "${entry.title}"`}
                className="size-4"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entry.title}
                  {entry.meta && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                      {entry.meta}
                    </span>
                  )}
                </p>
                {entry.trashedAt && (
                  <p className="text-xs text-muted-foreground">
                    Deleted {formatTimestamp(entry.trashedAt)}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => onRestore(entry)}>
                <RotateCcw className="size-3.5" /> Restore
              </Button>
              <Button
                variant="ghost"
                size="iconSm"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete forever"
                onClick={() => onDelete(entry)}
              >
                <X className="size-4" />
              </Button>
            </div>
          );
        })}
        {hasMore && <div ref={sentinelRef} className="h-8" aria-hidden />}
      </div>
    </section>
  );
}

export function TrashView() {
  const trashedTasks = useTasksStore((s) => s.trashedTasks);
  const loadTaskTrash = useTasksStore((s) => s.loadTrash);
  const restoreTask = useTasksStore((s) => s.restoreTask);
  const restoreManyTasks = useTasksStore((s) => s.restoreManyTasks);
  const deleteTaskPermanently = useTasksStore((s) => s.deleteTaskPermanently);
  const deleteManyTasksPermanently = useTasksStore((s) => s.deleteManyTasksPermanently);

  const trashedNotes = useNotesStore((s) => s.trashedNotes);
  const loadNoteTrash = useNotesStore((s) => s.loadTrash);
  const restoreNote = useNotesStore((s) => s.restoreNote);
  const restoreManyNotes = useNotesStore((s) => s.restoreManyNotes);
  const deleteNotePermanently = useNotesStore((s) => s.deleteNotePermanently);
  const deleteManyNotesPermanently = useNotesStore((s) => s.deleteManyNotesPermanently);

  const trashedSnippets = useSnippetsStore((s) => s.trashedSnippets);
  const loadSnippetTrash = useSnippetsStore((s) => s.loadTrash);
  const restoreSnippet = useSnippetsStore((s) => s.restoreSnippet);
  const restoreManySnippets = useSnippetsStore((s) => s.restoreManySnippets);
  const deleteSnippetPermanently = useSnippetsStore((s) => s.deleteSnippetPermanently);
  const deleteManySnippetsPermanently = useSnippetsStore((s) => s.deleteManySnippetsPermanently);

  const requestConfirm = useUiStore((s) => s.requestConfirm);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadTaskTrash();
    void loadNoteTrash();
    void loadSnippetTrash();
  }, [loadTaskTrash, loadNoteTrash, loadSnippetTrash]);

  const taskEntries = useMemo<TrashEntry[]>(
    () =>
      trashedTasks
        // Subtasks are trashed with their parent; only show top-level entries
        .filter((t) => !t.parentTaskId || !trashedTasks.some((p) => p.id === t.parentTaskId))
        .map((t) => ({ kind: "task", id: t.id, title: t.title, trashedAt: t.trashedAt })),
    [trashedTasks],
  );
  const noteEntries = useMemo<TrashEntry[]>(
    () =>
      trashedNotes.map((n) => ({
        kind: "note",
        id: n.id,
        title: n.title || "Untitled",
        trashedAt: n.trashedAt,
      })),
    [trashedNotes],
  );
  const snippetEntries = useMemo<TrashEntry[]>(
    () =>
      trashedSnippets.map((s) => ({
        kind: "snippet",
        id: s.id,
        title: s.title || "Untitled",
        meta: s.language,
        trashedAt: s.trashedAt,
      })),
    [trashedSnippets],
  );

  const allEntries = useMemo(
    () => [...taskEntries, ...noteEntries, ...snippetEntries],
    [taskEntries, noteEntries, snippetEntries],
  );
  const total = allEntries.length;
  const empty = total === 0;

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = (entries: TrashEntry[], select: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of entries) {
        if (select) next.add(entryKey(e));
        else next.delete(entryKey(e));
      }
      return next;
    });

  /** Split a set of selection keys into per-kind id lists. */
  const splitByKind = (keys: Set<string>) => {
    const ids: Record<TrashKind, string[]> = { task: [], note: [], snippet: [] };
    for (const e of allEntries) {
      if (keys.has(entryKey(e))) ids[e.kind].push(e.id);
    }
    return ids;
  };

  const restoreSelected = async () => {
    const ids = splitByKind(selected);
    await Promise.all([
      restoreManyTasks(ids.task),
      restoreManyNotes(ids.note),
      restoreManySnippets(ids.snippet),
    ]);
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    const ok = await requestConfirm({
      title: `Delete ${selected.size} ${selected.size === 1 ? "item" : "items"} permanently?`,
      description: "They will be deleted forever. This cannot be undone.",
      confirmLabel: "Delete Forever",
      destructive: true,
    });
    if (!ok) return;
    const ids = splitByKind(selected);
    await Promise.all([
      deleteManyTasksPermanently(ids.task),
      deleteManyNotesPermanently(ids.note),
      deleteManySnippetsPermanently(ids.snippet),
    ]);
    setSelected(new Set());
  };

  const emptyTrash = async () => {
    const ok = await requestConfirm({
      title: "Empty trash?",
      description: `All ${total} ${total === 1 ? "item" : "items"} will be deleted forever. This cannot be undone.`,
      confirmLabel: "Empty Trash",
      destructive: true,
    });
    if (!ok) return;
    await Promise.all([
      deleteManyTasksPermanently(taskEntries.map((e) => e.id)),
      deleteManyNotesPermanently(noteEntries.map((e) => e.id)),
      deleteManySnippetsPermanently(snippetEntries.map((e) => e.id)),
    ]);
    setSelected(new Set());
  };

  const confirmDeleteOne = async (label: string) =>
    requestConfirm({
      title: "Delete permanently?",
      description: `"${label}" will be deleted forever. This cannot be undone.`,
      confirmLabel: "Delete Forever",
      destructive: true,
    });

  const restoreOne = (entry: TrashEntry) => {
    if (entry.kind === "task") void restoreTask(entry.id);
    else if (entry.kind === "note") void restoreNote(entry.id);
    else void restoreSnippet(entry.id);
  };

  const deleteOne = (entry: TrashEntry) => {
    void confirmDeleteOne(entry.title).then((ok) => {
      if (!ok) return;
      if (entry.kind === "task") void deleteTaskPermanently(entry.id);
      else if (entry.kind === "note") void deleteNotePermanently(entry.id);
      else void deleteSnippetPermanently(entry.id);
    });
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Trash
            {total > 0 && (
              <span className="ml-2 align-middle rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {total} {total === 1 ? "item" : "items"}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Items in the trash are deleted forever after 30 days.
          </p>
        </div>
        {!empty && (
          <div className="flex items-center gap-1.5">
            {selected.size > 0 ? (
              <>
                <span className="mr-1 text-sm font-medium text-muted-foreground">
                  {selected.size} selected
                </span>
                <Button variant="outline" size="sm" onClick={() => void restoreSelected()}>
                  <RotateCcw className="size-3.5" /> Restore
                </Button>
                <Button variant="destructive" size="sm" onClick={() => void deleteSelected()}>
                  <Trash2 className="size-3.5" /> Delete Forever
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="size-3.5" /> Cancel
                </Button>
              </>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => void emptyTrash()}>
                <Trash2 className="size-3.5" /> Empty Trash
              </Button>
            )}
          </div>
        )}
      </header>

      {empty ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Deleted notes, tasks and snippets will appear here."
        />
      ) : (
        <div className="space-y-6">
          <TrashSection
            icon={<ListTodo />}
            title="Tasks"
            entries={taskEntries}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onRestore={restoreOne}
            onDelete={deleteOne}
          />
          <TrashSection
            icon={<FileText />}
            title="Notes"
            entries={noteEntries}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onRestore={restoreOne}
            onDelete={deleteOne}
          />
          <TrashSection
            icon={<Code2 />}
            title="Snippets"
            entries={snippetEntries}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onRestore={restoreOne}
            onDelete={deleteOne}
          />
        </div>
      )}
    </div>
  );
}
