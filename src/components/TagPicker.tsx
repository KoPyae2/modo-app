import { useState } from "react";
import { Check, Hash, Plus } from "lucide-react";
import { useTagsStore } from "@/stores/tagsStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COLOR_CHOICES } from "@/types";

interface TagPickerProps {
  selectedIds: string[];
  onChange: (tagIds: string[]) => void;
}

/** Multi-select tag picker with inline tag creation. */
export function TagPicker({ selectedIds, onChange }: TagPickerProps) {
  const tags = useTagsStore((s) => s.tags);
  const addTag = useTagsStore((s) => s.addTag);
  const [query, setQuery] = useState("");

  const selected = tags.filter((t) => selectedIds.includes(t.id));
  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
  );

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  const createAndSelect = async () => {
    const name = query.trim();
    if (!name) return;
    const color = COLOR_CHOICES[tags.length % COLOR_CHOICES.length];
    const tag = await addTag(name, color);
    if (tag && !selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id]);
    setQuery("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-auto min-h-9 w-full justify-start px-3 py-1.5 font-normal"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Add tags…</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selected.map((tag) => (
                <Badge key={tag.id} variant="outline" style={{ color: tag.color }}>
                  <Hash className="size-3" />
                  {tag.name}
                </Badge>
              ))}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or create tag…"
          className="mb-2 h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!exactMatch && query.trim()) void createAndSelect();
            }
          }}
        />
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Hash className="size-3.5" style={{ color: tag.color }} />
              <span className="flex-1 truncate text-left">{tag.name}</span>
              <Check
                className={cn(
                  "size-4",
                  selectedIds.includes(tag.id) ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => void createAndSelect()}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
            >
              <Plus className="size-3.5" />
              Create “{query.trim()}”
            </button>
          )}
          {filtered.length === 0 && !query.trim() && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No tags yet</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
