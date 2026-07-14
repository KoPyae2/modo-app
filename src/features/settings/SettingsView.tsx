import { useEffect, useRef, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { toast } from "sonner";
import { Bell, Database, Download, Laptop, Palette, Upload } from "lucide-react";
import { exportAllData, importAllData, isValidBackup } from "@/lib/db/backup";
import { useNotesStore } from "@/stores/notesStore";
import { useScratchpadStore } from "@/stores/scratchpadStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/types";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-3.5">
          {icon}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y rounded-xl border bg-card">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.set);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const setGlobalBusy = useUiStore((s) => s.setGlobalBusy);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEnabled()
      .then((actual) => {
        if (!cancelled && actual !== useSettingsStore.getState().settings.autostart) {
          void setSetting("autostart", actual);
        }
      })
      .catch((err) => {
        console.error(err);
      });
    return () => {
      cancelled = true;
    };
  }, [setSetting]);

  const handleNotificationsEnabled = async (on: boolean) => {
    if (!on) {
      await setSetting("notificationsEnabled", false);
      return;
    }
    try {
      const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
      if (!granted) {
        toast.error("Notification permission was not granted");
        await setSetting("notificationsEnabled", false);
        return;
      }
      await setSetting("notificationsEnabled", true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to enable notifications");
      await setSetting("notificationsEnabled", false);
    }
  };

  const handleAutostart = async (on: boolean) => {
    setAutostartBusy(true);
    try {
      if (on) {
        await enable();
      } else {
        await disable();
      }
      const actual = await isEnabled();
      await setSetting("autostart", actual);
      toast.success(actual ? "Autostart enabled" : "Autostart disabled");
    } catch (err) {
      console.error(err);
      toast.error("Failed to change autostart");
      await setSetting("autostart", await isEnabled().catch(() => settings.autostart));
    } finally {
      setAutostartBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    setGlobalBusy("Exporting backup…");
    try {
      const backup = await exportAllData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setGlobalBusy(null);
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    try {
      // Each step gets its own error message so failures are diagnosable.
      let text: string;
      try {
        text = await file.text();
      } catch (err) {
        console.error(err);
        toast.error("Import failed — the file could not be read");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.error(err);
        toast.error("Import failed — the file is not valid JSON");
        return;
      }

      if (!isValidBackup(parsed)) {
        toast.error("Not a valid MoDo backup file");
        return;
      }

      const ok = await requestConfirm({
        title: "Import backup?",
        description:
          "This will REPLACE all current notes, tasks, snippets and settings with the backup contents. This cannot be undone.",
        confirmLabel: "Replace Everything",
        destructive: true,
      });
      if (!ok) return;

      setGlobalBusy("Importing backup…");
      try {
        await importAllData(parsed);
        await Promise.all([
          useTasksStore.getState().load(),
          useNotesStore.getState().load(),
          useTagsStore.getState().load(),
          useSettingsStore.getState().load(),
          useSnippetsStore.getState().load(),
          useScratchpadStore.getState().load(),
        ]);
        toast.success("Backup imported");
      } catch (err) {
        console.error(err);
        toast.error("Import failed — no data was changed", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setGlobalBusy(null);
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize how MoDo looks and behaves
        </p>
      </header>

      <Section icon={<Palette />} title="Appearance">
        <Row label="Theme">
          <Select
            value={settings.theme}
            onValueChange={(v) => void setSetting("theme", v as AppSettings["theme"])}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Editor font size" description="Font size for the notes editor">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={12}
              max={28}
              className="w-20"
              value={settings.editorFontSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 12 && v <= 28) void setSetting("editorFontSize", v);
              }}
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </Row>
        <Row label="Start of week">
          <Select
            value={String(settings.weekStartsOn)}
            onValueChange={(v) =>
              void setSetting("weekStartsOn", Number(v) as AppSettings["weekStartsOn"])
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="0">Sunday</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Default view on launch">
          <Select
            value={settings.defaultView}
            onValueChange={(v) =>
              void setSetting("defaultView", v as AppSettings["defaultView"])
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dashboard">Dashboard</SelectItem>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="notes">Notes</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section icon={<Bell />} title="Notifications">
        <Row
          label="Task reminders"
          description="Desktop notifications when tasks are due"
        >
          <Switch
            checked={settings.notificationsEnabled}
            onCheckedChange={(c) => void handleNotificationsEnabled(c)}
            aria-label="Toggle notifications"
          />
        </Row>
        <Row
          label="Default pre-reminder"
          description="How early to remind before the due time"
        >
          <Select
            value={String(settings.preReminderMin)}
            onValueChange={(v) => void setSetting("preReminderMin", Number(v))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">At due time</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section icon={<Laptop />} title="System">
        <Row label="Start with system" description="Launch MoDo on login">
          <Switch
            checked={settings.autostart}
            disabled={autostartBusy}
            onCheckedChange={(c) => void handleAutostart(c)}
            aria-label="Toggle autostart"
          />
        </Row>
      </Section>

      <Section icon={<Database />} title="Data">
        <Row label="Export backup" description="Save all data as a JSON file">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleExport()}>
            <Download className="size-4" /> Export
          </Button>
        </Row>
        <Row
          label="Import backup"
          description="Replace all current data with a backup file"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" /> Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />
        </Row>
      </Section>
    </div>
  );
}


