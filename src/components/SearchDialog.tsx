import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, FileText, ListTodo, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchRepo,
  HIGHLIGHT_START,
  HIGHLIGHT_END,
} from "@/lib/db/searchRepo";
import { useUiStore } from "@/stores/uiStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { SearchHit } from "@/types";

const TYPE_META: Record<SearchHit["type"], { label: string; icon: React.ReactNode }> = {
  note: { label: "Notes", icon: <FileText className="size-4" /> },
  task: { label: "Tasks", icon: <ListTodo className="size-4" /> },
  snippet: { label: "Snippets", icon: <Code2 className="size-4" /> },
};

/** Render an excerpt, turning highlight markers into styled spans. */
function Excerpt({ text }: { text: string }) {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    const chunks = text.split(HIGHLIGHT_START);
    out.push(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      const end = chunks[i].indexOf(HIGHLIGHT_END);
      if (end < 0) {
        out.push(chunks[i]);
        continue;
      }
      out.push(
        <span key={i} className="rounded-sm bg-primary/20 font-medium text-foreground">
          {chunks[i].slice(0, end)}
        </span>,
        chunks[i].slice(end + 1),
      );
    }
    return out;
  }, [text]);
  return <span className="line-clamp-2 text-xs text-muted-foreground">{nodes}</span>;
}

export function SearchDialog() {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const navigate = useUiStore((s) => s.navigate);
  const openTaskDialog = useUiStore((s) => s.openTaskDialog);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searched, setSearched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setSelectedIndex(0);
      setSearched(false);
    }
  }, [open]);

  // Debounced search-as-you-type
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      void searchRepo.searchAll(query).then((results) => {
        setHits(results);
        setSelectedIndex(0);
        setSearched(true);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const grouped = useMemo(() => {
    const order: SearchHit["type"][] = ["note", "task", "snippet"];
    return order
      .map((type) => ({ type, items: hits.filter((h) => h.type === type) }))
      .filter((g) => g.items.length > 0);
  }, [hits]);

  /** Flat list in display order for keyboard navigation */
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const openHit = (hit: SearchHit) => {
    setOpen(false);
    switch (hit.type) {
      case "note":
        navigate({ name: "notes", folderId: hit.folderId ?? null, noteId: hit.id });
        break;
      case "task":
        openTaskDialog({ taskId: hit.id });
        break;
      case "snippet":
        navigate({ name: "snippets", snippetId: hit.id });
        break;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flat[selectedIndex]) {
      e.preventDefault();
      openHit(flat[selectedIndex]);
    }
  };

  // Keep the selected row visible while navigating with arrows
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Search everything</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search notes, tasks and snippets…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search everything"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searched
                ? "No results found."
                : "Type to search across everything you've written."}
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.type}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {TYPE_META[group.type].label}
                </div>
                {group.items.map((hit) => {
                  const index = flat.indexOf(hit);
                  return (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      type="button"
                      data-selected={index === selectedIndex}
                      onClick={() => openHit(hit)}
                      onMouseMove={() => setSelectedIndex(index)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                        index === selectedIndex && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                        {TYPE_META[hit.type].icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {hit.title || "Untitled"}
                          </span>
                          {hit.language && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                              {hit.language}
                            </span>
                          )}
                        </span>
                        <Excerpt text={hit.excerpt} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
