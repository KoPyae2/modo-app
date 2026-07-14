import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Zap } from "lucide-react";
import { scratchpadRepo } from "@/lib/db/scratchpadRepo";
import { settingsRepo } from "@/lib/db/settingsRepo";

/** Sync the quick-capture window's theme with the app setting. */
async function applyThemeFromSettings() {
  try {
    const settings = await settingsRepo.getAll();
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (err) {
    console.error("Failed to load theme for quick capture", err);
  }
}

export function QuickCapture() {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void applyThemeFromSettings();
    const unlisteners: Promise<() => void>[] = [
      // Fired from Rust whenever the global hotkey / tray shows this window
      listen("quick://focus", () => {
        void applyThemeFromSettings();
        textareaRef.current?.focus();
      }),
      // Hide (but keep the draft) when the window loses focus
      getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) void getCurrentWindow().hide();
      }),
    ];
    return () => {
      for (const p of unlisteners) void p.then((fn) => fn());
    };
  }, []);

  const save = async () => {
    const content = value.trim();
    if (!content) {
      void getCurrentWindow().hide();
      return;
    }
    setSaving(true);
    try {
      await scratchpadRepo.create(content);
      await emit("scratchpad://changed");
      setValue("");
      await getCurrentWindow().hide();
    } catch (err) {
      console.error("Failed to save scratchpad entry", err);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      void getCurrentWindow().hide();
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden border bg-background text-foreground">
      <div
        data-tauri-drag-region
        className="flex select-none items-center justify-between border-b bg-card/60 px-4 py-2"
      >
        <span
          data-tauri-drag-region
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground"
        >
          <Zap className="size-3.5 text-primary" /> Quick Drop
        </span>
        <span data-tauri-drag-region className="text-[11px] text-muted-foreground">
          Enter to save · Shift+Enter for a new line · Esc to close
        </span>
      </div>
      <textarea
        ref={textareaRef}
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Drop a thought, link, or todo… it lands in your Scratchpad."
        className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
