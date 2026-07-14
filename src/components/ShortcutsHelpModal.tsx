import { useUiStore } from "@/stores/uiStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { modKey } from "@/lib/utils";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [modKey, "K"], label: "Command palette" },
  { keys: [modKey, "F"], label: "Search everything" },
  { keys: [modKey, "N"], label: "New note" },
  { keys: [modKey, "T"], label: "New task" },
  { keys: [modKey, "1"], label: "Go to Dashboard" },
  { keys: [modKey, "2"], label: "Go to Tasks (Today)" },
  { keys: [modKey, "3"], label: "Go to Notes" },
  { keys: [modKey, "4"], label: "Go to Snippets" },
  { keys: [modKey, "5"], label: "Go to Scratchpad" },
  { keys: [modKey, "6"], label: "Go to Calendar" },
  { keys: [modKey, "Shift", "Space"], label: "Quick Drop (works system-wide)" },
  { keys: [modKey, ","], label: "Settings" },
  { keys: [modKey, "/"], label: "This help" },
  { keys: ["Esc"], label: "Close dialogs" },
  { keys: [modKey, "B"], label: "Bold (in editor)" },
  { keys: [modKey, "I"], label: "Italic (in editor)" },
  { keys: [modKey, "U"], label: "Underline (in editor)" },
];

export function ShortcutsHelpModal() {
  const open = useUiStore((s) => s.shortcutsHelpOpen);
  const setOpen = useUiStore((s) => s.setShortcutsHelpOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
            >
              <span>{s.label}</span>
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
