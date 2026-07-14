import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Folder as FolderIcon, Hash, Heart, Pin, Trash2 } from "lucide-react";
import { cn, debounce } from "@/lib/utils";
import { formatTimestamp } from "@/lib/dates";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TagPicker } from "@/components/TagPicker";
import { EditorToolbar } from "./EditorToolbar";
import type { Note } from "@/types";

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const { saveContent, updateNote, moveToTrash } = useNotesStore();
  const folders = useNotesStore((s) => s.folders);
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize);
  const requestConfirm = useUiStore((s) => s.requestConfirm);

  const [title, setTitle] = useState(note.title);
  const titleRef = useRef(title);
  titleRef.current = title;

  // Stable debounced save shared by title + content changes
  const debouncedSave = useMemo(
    () =>
      debounce(
        (id: string, t: string, json: string, text: string) =>
          void saveContent(id, t, json, text),
        800,
      ),
    [saveContent],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false }),
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        CharacterCount,
        Placeholder.configure({ placeholder: "Start writing..." }),
      ],
      content: parseContent(note.contentJson),
      editorProps: {
        attributes: {
          class: "tiptap",
        },
      },
      onUpdate: ({ editor }) => {
        debouncedSave(
          note.id,
          titleRef.current,
          JSON.stringify(editor.getJSON()),
          editor.getText(),
        );
      },
    },
    [note.id],
  );

  // Flush pending edits when switching notes / unmounting
  useEffect(() => {
    setTitle(note.title);
    return () => debouncedSave.flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (editor) {
      debouncedSave(
        note.id,
        value,
        JSON.stringify(editor.getJSON()),
        editor.getText(),
      );
    }
  };

  const words = useMemo(() => {
    const storage = editor?.storage.characterCount as
      | { words: () => number }
      | undefined;
    return storage?.words() ?? 0;
    // storage.words() reads live editor state; recompute on note switch is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.state]);

  const folder = folders.find((f) => f.id === note.folderId);

  const handleDelete = async () => {
    const ok = await requestConfirm({
      title: "Move note to trash?",
      description: `"${note.title || "Untitled"}" will be moved to trash. You can restore it later.`,
      confirmLabel: "Move to Trash",
      destructive: true,
    });
    if (ok) void moveToTrash(note.id);
  };

  if (!editor) return null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-card/45 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <FolderIcon
                  className="size-3.5"
                  style={folder ? { color: folder.color } : undefined}
                />
                {folder?.name ?? "No folder"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => void updateNote({ ...note, folderId: null })}
              >
                No folder
              </DropdownMenuItem>
              {folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onClick={() => void updateNote({ ...note, folderId: f.id })}
                >
                  <FolderIcon style={{ color: f.color }} />
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="iconSm" aria-label="Tags">
                <Hash className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <TagPicker
                selectedIds={note.tagIds}
                onChange={(tagIds) => void updateNote({ ...note, tagIds })}
              />
            </PopoverContent>
          </Popover>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                onClick={() => void updateNote({ ...note, isPinned: !note.isPinned })}
              >
                <Pin
                  className={cn(
                    "size-4",
                    note.isPinned && "fill-current text-primary",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{note.isPinned ? "Unpin" : "Pin to top"}</TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={note.isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() =>
                  void updateNote({ ...note, isFavorite: !note.isFavorite })
                }
              >
                <Heart
                  className={cn(
                    "size-4",
                    note.isFavorite && "fill-current text-red-500",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {note.isFavorite ? "Unfavorite" : "Favorite"}
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="iconSm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Move note to trash"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <EditorToolbar editor={editor} />

      {/* Title stays pinned; only the note body scrolls */}
      <div className="shrink-0">
        <div className="mx-auto w-full max-w-3xl px-8 pb-3 pt-6">
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
                e.preventDefault();
                editor.chain().focus("start").run();
              }
            }}
            placeholder="Untitled"
            aria-label="Note title"
            className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-8 pt-1">
          <div
            className="flex flex-1 flex-col pb-12"
            style={{ "--editor-font-size": `${fontSize}px` } as React.CSSProperties}
          >
            <EditorContent
              editor={editor}
              className="flex flex-1 flex-col [&>.tiptap]:flex-1"
            />
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t bg-card/35 px-4 py-2 text-xs text-muted-foreground">
        <span>{words} {words === 1 ? "word" : "words"}</span>
        <span>
          Created {formatTimestamp(note.createdAt)} · Updated {formatTimestamp(note.updatedAt)}
        </span>
      </footer>
    </div>
  );
}

function parseContent(contentJson: string): object | string {
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed
    ) {
      return parsed;
    }
    return "";
  } catch {
    return "";
  }
}


