import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/components/ui/toast";
import { ChevronDown, Copy, FileText, ListTodo, Search, Trash2, Zap } from "lucide-react";
import { modKey } from "@/lib/utils";
import { textToTiptapJson } from "@/lib/tiptap";
import { useScratchpadStore } from "@/stores/scratchpadStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useNotesStore } from "@/stores/notesStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/EmptyState";
import type { ScratchpadEntry } from "@/types";

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={label}
          onClick={onClick}
          className="text-muted-foreground hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EntryCard({
  entry,
  selected,
  onToggleSelect,
}: {
  entry: ScratchpadEntry;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // ponytail: heuristic for "longer than 3 lines"; clamp itself is CSS
  const isLong =
    entry.content.split(/\r?\n/).length > 3 || entry.content.length > 240;
  const removeEntry = useScratchpadStore((s) => s.removeEntry);
  const addTask = useTasksStore((s) => s.addTask);
  const createNote = useNotesStore((s) => s.createNote);
  const navigate = useUiStore((s) => s.navigate);

  const convertToTask = async () => {
    const [firstLine, ...rest] = entry.content.split(/\r?\n/);
    const task = await addTask({
      title: firstLine.trim().slice(0, 200) || "Untitled",
      description: rest.join("\n").trim(),
    });
    if (task) {
      await removeEntry(entry.id);
      toast.success("Converted to task");
    }
  };

  const convertToNote = async () => {
    const [firstLine, ...rest] = entry.content.split(/\r?\n/);
    const body = rest.join("\n").trim();
    const note = await createNote(null, {
      title: firstLine.trim().slice(0, 200),
      contentJson: textToTiptapJson(body || firstLine.trim()),
      contentText: body || firstLine.trim(),
    });
    if (note) {
      await removeEntry(entry.id);
      toast.success("Converted to note", {
        action: {
          label: "Open",
          onClick: () =>
            navigate({ name: "notes", folderId: null, noteId: note.id }),
        },
      });
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(entry.content);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="group rounded-lg border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label="Select entry"
          className="mt-0.5"
        />
        <p
          className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-sm ${expanded ? "" : "line-clamp-3"}`}
        >
          {entry.content}
        </p>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
          </span>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
              <ChevronDown
                className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <ActionButton label="Convert to task" onClick={() => void convertToTask()}>
            <ListTodo className="size-4" />
          </ActionButton>
          <ActionButton label="Convert to note" onClick={() => void convertToNote()}>
            <FileText className="size-4" />
          </ActionButton>
          <ActionButton label="Copy" onClick={() => void copy()}>
            <Copy className="size-4" />
          </ActionButton>
          <ActionButton label="Delete" onClick={() => void removeEntry(entry.id)}>
            <Trash2 className="size-4" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function ScratchpadView() {
  const entries = useScratchpadStore((s) => s.entries);
  const removeEntry = useScratchpadStore((s) => s.removeEntry);
  const requestConfirm = useUiStore((s) => s.requestConfirm);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "az">("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? entries.filter((e) => e.content.toLowerCase().includes(q))
      : entries;
    return [...filtered].sort((a, b) =>
      sort === "az"
        ? a.content.localeCompare(b.content)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [entries, query, sort]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelected = async () => {
    const ok = await requestConfirm({
      title: `Delete ${selected.size} ${selected.size === 1 ? "entry" : "entries"}?`,
      description: "Selected scratchpad entries will be permanently deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    for (const id of selected) await removeEntry(id);
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="size-6 text-primary" /> Scratchpad
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Press{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {modKey}+Shift+Space
            </kbd>{" "}
            anywhere — even outside the app — to drop a quick thought here.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nothing here yet"
          description={`Press ${modKey}+Shift+Space from anywhere to capture a thought, or use the tray menu's Quick Drop.`}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter entries…"
                className="pl-8"
              />
            </div>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as typeof sort)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="az">A–Z</SelectItem>
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void deleteSelected()}
              >
                <Trash2 className="size-4" /> Delete ({selected.size})
              </Button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No entries match “{query}”.
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  selected={selected.has(entry.id)}
                  onToggleSelect={() => toggleSelect(entry.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
