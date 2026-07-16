import { useEffect, useMemo, useState } from "react";
import CodeMirror, { type ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { languages as languageDescriptions } from "@codemirror/language-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/components/ui/toast";
import { Check, CheckSquare, Code2, Copy, Plus, Search, Star, Trash2, X } from "lucide-react";
import { cn, debounce } from "@/lib/utils";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useSettingsStore } from "@/stores/settingsStore";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/EmptyState";
import { useLazyList } from "@/hooks/useLazyList";
import type { Snippet } from "@/types";

type CmExtensions = NonNullable<ReactCodeMirrorProps["extensions"]>;

/** Names must match LanguageDescription.name in @codemirror/language-data */
export const LANGUAGE_OPTIONS = [
  "Plain Text",
  "JavaScript",
  "TypeScript",
  "JSX",
  "TSX",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C",
  "C++",
  "C#",
  "HTML",
  "CSS",
  "SCSS",
  "SQL",
  "Shell",
  "JSON",
  "YAML",
  "Markdown",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "XML",
  "TOML",
  "Dockerfile",
] as const;

function useIsDark(): boolean {
  const theme = useSettingsStore((s) => s.settings.theme);
  const [sysDark, setSysDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return theme === "dark" || (theme === "system" && sysDark);
}

/** Lazily load the CodeMirror language support for a language-data name. */
function useLanguageExtension(language: string): CmExtensions {
  const [extensions, setExtensions] = useState<CmExtensions>([]);
  useEffect(() => {
    let cancelled = false;
    const desc = languageDescriptions.find((l) => l.name === language);
    if (!desc) {
      setExtensions([]);
      return;
    }
    void desc.load().then((support) => {
      if (!cancelled) setExtensions([support]);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);
  return extensions;
}

const AUTOSAVE_MS = 800;

function SnippetEditor({ snippet }: { snippet: Snippet }) {
  const saveContent = useSnippetsStore((s) => s.saveContent);
  const toggleFavorite = useSnippetsStore((s) => s.toggleFavorite);
  const moveToTrash = useSnippetsStore((s) => s.moveToTrash);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const navigate = useUiStore((s) => s.navigate);
  const isDark = useIsDark();

  const [title, setTitle] = useState(snippet.title);
  const [language, setLanguage] = useState(snippet.language);
  const [description, setDescription] = useState(snippet.description);
  const [code, setCode] = useState(snippet.code);
  const langExtensions = useLanguageExtension(language);

  const debouncedSave = useMemo(
    () =>
      debounce(
        (
          id: string,
          fields: Pick<Snippet, "title" | "language" | "description" | "code">,
        ) => void saveContent(id, fields),
        AUTOSAVE_MS,
      ),
    [saveContent],
  );

  // Flush pending changes when switching snippets or unmounting
  useEffect(() => () => debouncedSave.flush(), [snippet.id, debouncedSave]);

  const schedule = (fields: Partial<Pick<Snippet, "title" | "language" | "description" | "code">>) => {
    const next = { title, language, description, code, ...fields };
    debouncedSave(snippet.id, next);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const deleteSnippet = async () => {
    const ok = await requestConfirm({
      title: `Delete snippet "${title || "Untitled"}"?`,
      description: "It will be moved to the trash.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) {
      debouncedSave.cancel();
      await moveToTrash(snippet.id);
      navigate({ name: "snippets" });
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule({ title: e.target.value });
          }}
          placeholder="Snippet title…"
          className="h-9 flex-1 border-none bg-transparent text-base font-semibold shadow-none focus-visible:ring-0"
          aria-label="Snippet title"
        />
        <Select
          value={language}
          onValueChange={(value) => {
            setLanguage(value);
            schedule({ language: value });
          }}
        >
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((lang) => (
              <SelectItem key={lang} value={lang} className="text-xs">
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={snippet.isFavorite ? "Unfavorite" : "Favorite"}
              onClick={() => void toggleFavorite(snippet.id)}
            >
              <Star
                className={cn(
                  "size-4",
                  snippet.isFavorite
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {snippet.isFavorite ? "Remove from favorites" : "Add to favorites"}
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="iconSm" aria-label="Copy code" onClick={() => void copyCode()}>
              <Copy className="size-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy code</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="iconSm" aria-label="Delete snippet" onClick={() => void deleteSnippet()}>
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>

      <div className="border-b px-4 py-2">
        <Input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            schedule({ description: e.target.value });
          }}
          placeholder="What is this snippet for? (optional)"
          className="h-8 border-none bg-transparent text-sm shadow-none focus-visible:ring-0"
          aria-label="Snippet description"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={code}
          onChange={(value) => {
            setCode(value);
            schedule({ code: value });
          }}
          extensions={langExtensions}
          theme={isDark ? "dark" : "light"}
          placeholder="Paste or write your code here…"
          className="h-full text-[13px] [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:font-mono"
          height="100%"
        />
      </div>
    </div>
  );
}

export function SnippetsView({ snippetId }: { snippetId?: string }) {
  const snippets = useSnippetsStore((s) => s.snippets);
  const createSnippet = useSnippetsStore((s) => s.createSnippet);
  const moveManyToTrash = useSnippetsStore((s) => s.moveManyToTrash);
  const navigate = useUiStore((s) => s.navigate);
  const requestConfirm = useUiStore((s) => s.requestConfirm);

  const [query, setQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title">("updated");
  const [favOnly, setFavOnly] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const usedLanguages = useMemo(
    () => [...new Set(snippets.map((s) => s.language))].sort(),
    [snippets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = snippets.filter((s) => {
      if (languageFilter !== "all" && s.language !== languageFilter) return false;
      if (favOnly && !s.isFavorite) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    });
    result.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.title || "Untitled").localeCompare(b.title || "Untitled");
        case "created":
          return b.createdAt.localeCompare(a.createdAt);
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
    return result;
  }, [snippets, query, languageFilter, favOnly, sortBy]);

  // Fall back to the first snippet so the editor is never empty (matches Notes)
  const selected = snippets.find((s) => s.id === snippetId) ?? filtered[0] ?? null;

  const { visible, hasMore, sentinelRef } = useLazyList(filtered, 50);

  const onNew = () => {
    void createSnippet().then((snippet) => {
      if (snippet) navigate({ name: "snippets", snippetId: snippet.id });
    });
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    const ok = await requestConfirm({
      title: `Move ${ids.length} ${ids.length === 1 ? "snippet" : "snippets"} to trash?`,
      description: "You can restore them from the trash later.",
      confirmLabel: "Move to Trash",
      destructive: true,
    });
    if (!ok) return;
    await moveManyToTrash(ids);
    exitSelecting();
    if (snippetId && ids.includes(snippetId)) navigate({ name: "snippets" });
  };

  return (
    <div className="flex h-full">
      <div className="flex w-80 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Code2 className="size-5 text-primary" /> Snippets
          </h1>
          <div className="flex items-center gap-1">
            {filtered.length > 0 && (
              <Button
                size="iconSm"
                variant="ghost"
                onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
                aria-label={selecting ? "Exit selection mode" : "Select snippets"}
                className={cn(selecting && "text-primary")}
              >
                <CheckSquare className="size-4" />
              </Button>
            )}
            <Button size="sm" onClick={onNew}>
              <Plus className="size-4" /> New
            </Button>
          </div>
        </div>
        {selecting && (
          <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-muted/60 px-2 py-1.5">
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
                    selectedIds.size === filtered.length
                      ? new Set()
                      : new Set(filtered.map((s) => s.id)),
                  )
                }
              >
                {selectedIds.size === filtered.length ? "Clear" : "All"}
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
        <div className="space-y-2 border-b px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter snippets…"
              className="h-8 pl-8 text-sm"
              aria-label="Filter snippets"
            />
          </div>
          {usedLanguages.length > 1 && (
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="h-8 text-xs" aria-label="Filter by language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All languages
                </SelectItem>
                {usedLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang} className="text-xs">
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1.5">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Sort snippets">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated" className="text-xs">
                  Last updated
                </SelectItem>
                <SelectItem value="created" className="text-xs">
                  Date created
                </SelectItem>
                <SelectItem value="title" className="text-xs">
                  Title A–Z
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={favOnly ? "secondary" : "ghost"}
              size="iconSm"
              onClick={() => setFavOnly((f) => !f)}
              aria-label={favOnly ? "Show all snippets" : "Show favorites only"}
              aria-pressed={favOnly}
            >
              <Star className={cn("size-4", favOnly && "fill-current text-amber-500")} />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-card/55 p-4 text-sm text-muted-foreground">
              <Code2 className="mb-2 size-4 text-primary" />
              <p className="font-medium text-foreground">
                {snippets.length === 0 ? "No snippets yet" : "No matching snippets"}
              </p>
              <p className="mt-1 text-xs leading-5">
                {snippets.length === 0
                  ? "Save reusable code here."
                  : "Adjust your search or language filter."}
              </p>
            </div>
          ) : (
            visible.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() =>
                  selecting
                    ? toggleSelected(snippet.id)
                    : navigate({ name: "snippets", snippetId: snippet.id })
                }
                className={cn(
                  "mb-1 block w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selecting && selectedIds.has(snippet.id)
                    ? "border-primary/45 bg-primary/10"
                    : snippet.id === selected?.id && !selecting
                      ? "border-primary/45 bg-primary/10 shadow-sm"
                      : "border-transparent hover:border-border/70 hover:bg-accent/40",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {selecting && (
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-3.5 shrink-0 place-items-center rounded border",
                        selectedIds.has(snippet.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {selectedIds.has(snippet.id) && <Check className="size-2.5" />}
                    </span>
                  )}
                  {snippet.isFavorite && (
                    <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {snippet.title || "Untitled"}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-px font-mono text-[10px]">
                    {snippet.language}
                  </span>
                  <span className="truncate">
                    {formatDistanceToNow(new Date(snippet.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </button>
            ))
          )}
          {hasMore && <div ref={sentinelRef} className="h-8" aria-hidden />}
        </div>
      </div>

      {selected ? (
        <SnippetEditor key={selected.id} snippet={selected} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Code2}
            title={snippets.length === 0 ? "Your code snippet vault" : "No snippet selected"}
            description={
              snippets.length === 0
                ? "Save reusable code with syntax highlighting, searchable alongside your notes and tasks."
                : "Select a snippet from the list or create a new one."
            }
            actionLabel="New snippet"
            onAction={onNew}
          />
        </div>
      )}
    </div>
  );
}
