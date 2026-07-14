import { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, FileText, Heart, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeUpdated } from "@/lib/dates";
import { useNotesStore } from "@/stores/notesStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLazyList } from "@/hooks/useLazyList";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { NoteEditor } from "./NoteEditor";
import type { Note } from "@/types";

interface NotesViewProps {
  folderId?: string | null;
  noteId?: string;
}

type NoteSort = "updated" | "created" | "title";

const NOTE_SORT_LABELS: Record<NoteSort, string> = {
  updated: "Last updated",
  created: "Date created",
  title: "Title A–Z",
};

export function NotesView({ folderId = null, noteId }: NotesViewProps) {
  const notes = useNotesStore((s) => s.notes);
  const folders = useNotesStore((s) => s.folders);
  const loaded = useNotesStore((s) => s.loaded);
  const createNote = useNotesStore((s) => s.createNote);
  const moveManyToTrash = useNotesStore((s) => s.moveManyToTrash);
  const navigate = useUiStore((s) => s.navigate);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<NoteSort>("updated");
  const [favOnly, setFavOnly] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const inFolder = useMemo(
    () =>
      folderId === null ? notes : notes.filter((n) => n.folderId === folderId),
    [notes, folderId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inFolder.filter((n) => {
      if (favOnly && !n.isFavorite) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.contentText.toLowerCase().includes(q)
      );
    });
  }, [inFolder, query, favOnly]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        switch (sortBy) {
          case "title":
            return (a.title || "Untitled").localeCompare(b.title || "Untitled");
          case "created":
            return b.createdAt.localeCompare(a.createdAt);
          case "updated":
            return b.updatedAt.localeCompare(a.updatedAt);
        }
      }),
    [filtered, sortBy],
  );

  const selected: Note | undefined =
    sorted.find((n) => n.id === noteId) ?? sorted[0];

  const { visible, hasMore, sentinelRef } = useLazyList(sorted, 50);

  // Keep URL-ish state in sync so the editor targets an existing note
  useEffect(() => {
    if (noteId && loaded && !notes.some((n) => n.id === noteId)) {
      navigate({ name: "notes", folderId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, loaded, notes]);

  const folder = folders.find((f) => f.id === folderId);

  const handleCreate = async () => {
    const note = await createNote(folderId);
    if (note) navigate({ name: "notes", folderId, noteId: note.id });
  };

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    const ok = await requestConfirm({
      title: `Move ${ids.length} ${ids.length === 1 ? "note" : "notes"} to trash?`,
      description: "You can restore them from the trash later.",
      confirmLabel: "Move to Trash",
      destructive: true,
    });
    if (!ok) return;
    await moveManyToTrash(ids);
    exitSelecting();
    if (noteId && ids.includes(noteId)) navigate({ name: "notes", folderId });
  };

  if (!loaded) {
    return (
      <div className="flex h-full">
        <div className="w-72 space-y-2 border-r bg-card/55 backdrop-blur-xl p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-9 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex w-72 shrink-0 flex-col border-r bg-card/55 backdrop-blur-xl">
        <div className="space-y-2 border-b bg-card/45 p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">
              {folder ? folder.name : "All Notes"}
              <span className="ml-2 font-normal text-muted-foreground">
                {sorted.length}
              </span>
            </h1>
            <div className="flex items-center gap-0.5">
              {sorted.length > 0 && (
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
                  aria-label={selecting ? "Exit selection mode" : "Select notes"}
                  className={cn(selecting && "text-primary")}
                >
                  <CheckSquare className="size-4" />
                </Button>
              )}
              <Button size="iconSm" variant="ghost" onClick={() => void handleCreate()} aria-label="New note">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          {selecting && (
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.size === sorted.length
                        ? new Set()
                        : new Set(sorted.map((n) => n.id)),
                    )
                  }
                >
                  {selectedIds.size === sorted.length ? "Clear" : "All"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={selectedIds.size === 0}
                  onClick={() => void deleteSelected()}
                >
                  <Trash2 className="size-3" /> Delete
                </Button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="size-6"
                  onClick={exitSelecting}
                  aria-label="Cancel selection"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes..."
              className="h-8 pl-8"
              aria-label="Search notes"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as NoteSort)}>
              <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Sort notes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(NOTE_SORT_LABELS) as NoteSort[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {NOTE_SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={favOnly ? "secondary" : "ghost"}
              size="iconSm"
              onClick={() => setFavOnly((f) => !f)}
              aria-label={favOnly ? "Show all notes" : "Show favorites only"}
              aria-pressed={favOnly}
            >
              <Heart className={cn("size-4", favOnly && "fill-current text-red-500")} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sorted.length === 0 ? (
            <div className="rounded-xl border bg-card/55 p-4 text-sm text-muted-foreground">
              <FileText className="mb-2 size-4 text-primary" />
              <p className="font-medium text-foreground">
                {query || favOnly ? "No matching notes" : "No notes yet"}
              </p>
              <p className="mt-1 text-xs leading-5">
                {query || favOnly
                  ? "Try a different search or filter."
                  : "Create a note to start writing."}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {visible.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() =>
                      selecting
                        ? toggleSelected(note.id)
                        : navigate({ name: "notes", folderId, noteId: note.id })
                    }
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selecting && selectedIds.has(note.id)
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : selected?.id === note.id && !selecting
                          ? "bg-accent"
                          : "hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {selecting && (
                        <span
                          aria-hidden
                          className={cn(
                            "mr-0.5 grid size-3.5 shrink-0 place-items-center rounded border",
                            selectedIds.has(note.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {selectedIds.has(note.id) && <Check className="size-2.5" />}
                        </span>
                      )}
                      {note.isPinned && (
                        <Pin className="size-3 shrink-0 fill-current text-primary" />
                      )}
                      {note.isFavorite && (
                        <Heart className="size-3 shrink-0 fill-current text-red-500" />
                      )}
                      <span className="truncate text-sm font-medium">
                        {note.title || "Untitled"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {note.contentText.slice(0, 80) || "No content"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {formatRelativeUpdated(note.updatedAt)}
                    </p>
                  </button>
                </li>
              ))}
              {hasMore && <li ref={sentinelRef} className="h-8" aria-hidden />}
            </ul>
          )}
        </div>
      </div>

      {selected ? (
        <NoteEditor key={selected.id} note={selected} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={FileText}
            title="No note selected"
            description={
              folder
                ? `Create your first note in "${folder.name}".`
                : "Create your first note to get started."
            }
            actionLabel="New Note"
            onAction={() => void handleCreate()}
          />
        </div>
      )}
    </div>
  );
}

