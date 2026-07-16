import { useEffect, useRef, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { toast } from "@/components/ui/toast";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  Minus,
  Palette,
  Plus,
  Power,
  Type,
  Upload,
} from "lucide-react";
import { DARK_BACKGROUNDS, LIGHT_BACKGROUNDS } from "@/lib/backgrounds";
import { exportAllData, importAllData, isValidBackup } from "@/lib/db/backup";
import { useNotesStore } from "@/stores/notesStore";
import { useScratchpadStore } from "@/stores/scratchpadStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useTagsStore } from "@/stores/tagsStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useUiStore } from "@/stores/uiStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/types";

function SettingsGroup({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border bg-card">{children}</div>
      {footer && (
        <p className="mt-2 px-4 text-xs leading-5 text-muted-foreground">{footer}</p>
      )}
    </section>
  );
}

const rowClass =
  "relative flex w-full items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-14 after:right-0 after:h-px after:bg-border/60 last:after:hidden";

function IconBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-white [&_svg]:size-4",
        color,
      )}
    >
      {children}
    </span>
  );
}

function SettingsRow({
  icon,
  iconColor,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={rowClass}>
      <IconBadge color={iconColor}>{icon}</IconBadge>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-5">{label}</p>
        {description && (
          <p className="text-xs leading-4 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

function SettingsButtonRow({
  icon,
  iconColor,
  label,
  description,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        rowClass,
        "text-left transition-colors hover:bg-accent/50 active:bg-accent disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <IconBadge color={iconColor}>{icon}</IconBadge>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-5">{label}</p>
        {description && (
          <p className="text-xs leading-4 text-muted-foreground">{description}</p>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border bg-background/50">
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid h-7 w-8 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-12 border-x text-center text-[13px] tabular-nums leading-7">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid h-7 w-8 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function BackgroundTile({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative block aspect-video w-full overflow-hidden rounded-lg border transition-shadow",
          selected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
            : "hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 hover:ring-offset-card",
        )}
      >
        {children}
        {selected && (
          <span className="absolute bottom-1 right-1 grid size-4.5 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </span>
        )}
      </button>
      <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

const selectTriggerClass =
  "h-8 w-auto gap-1.5 border-0 bg-transparent px-2 text-[13px] text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus:ring-0";

const iosSwitchClass = "data-[state=checked]:bg-[#34c759]";

export function SettingsView() {
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.set);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const setGlobalBusy = useUiStore((s) => s.setGlobalBusy);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);

  // Which theme's background set to show in the picker
  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const backgroundKey = isDark ? "backgroundDark" : "backgroundLight";
  const backgroundOptions = isDark ? DARK_BACKGROUNDS : LIGHT_BACKGROUNDS;
  const activeBackground = settings[backgroundKey];

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
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-7 px-4">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize how MoDo looks and behaves
        </p>
      </header>

      <SettingsGroup title="Appearance">
        <SettingsRow icon={<Palette />} iconColor="bg-purple-500" label="Theme">
          <Select
            value={settings.theme}
            onValueChange={(v) => void setSetting("theme", v as AppSettings["theme"])}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          icon={<Type />}
          iconColor="bg-blue-500"
          label="Editor font size"
          description="Font size for the notes editor"
        >
          <Stepper
            value={settings.editorFontSize}
            min={12}
            max={28}
            onChange={(v) => void setSetting("editorFontSize", v)}
          />
        </SettingsRow>
        <SettingsRow icon={<CalendarDays />} iconColor="bg-red-500" label="Start of week">
          <Select
            value={String(settings.weekStartsOn)}
            onValueChange={(v) =>
              void setSetting("weekStartsOn", Number(v) as AppSettings["weekStartsOn"])
            }
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="0">Sunday</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          icon={<LayoutGrid />}
          iconColor="bg-indigo-500"
          label="Default view on launch"
        >
          <Select
            value={settings.defaultView}
            onValueChange={(v) =>
              void setSetting("defaultView", v as AppSettings["defaultView"])
            }
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="dashboard">Dashboard</SelectItem>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="notes">Notes</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title={isDark ? "Background · Dark mode" : "Background · Light mode"}
        footer="Each theme remembers its own background — switch the theme to pick one for the other mode."
      >
        <div className="grid grid-cols-3 gap-3 p-4">
          <BackgroundTile
            label="None"
            selected={activeBackground === "none"}
            onClick={() => void setSetting(backgroundKey, "none")}
          >
            <div className="app-workspace h-full w-full" />
          </BackgroundTile>
          {backgroundOptions.map((bg) => (
            <BackgroundTile
              key={bg.id}
              label={bg.label}
              selected={activeBackground === bg.id}
              onClick={() => void setSetting(backgroundKey, bg.id)}
            >
              <img
                src={bg.url}
                alt={bg.label}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </BackgroundTile>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <SettingsRow
          icon={<Bell />}
          iconColor="bg-rose-500"
          label="Task reminders"
          description="Desktop notifications when tasks are due"
        >
          <Switch
            className={iosSwitchClass}
            checked={settings.notificationsEnabled}
            onCheckedChange={(c) => void handleNotificationsEnabled(c)}
            aria-label="Toggle notifications"
          />
        </SettingsRow>
        <SettingsRow
          icon={<Clock />}
          iconColor="bg-orange-500"
          label="Default pre-reminder"
          description="How early to remind before the due time"
        >
          <Select
            value={String(settings.preReminderMin)}
            onValueChange={(v) => void setSetting("preReminderMin", Number(v))}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="0">At due time</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="System">
        <SettingsRow
          icon={<Power />}
          iconColor="bg-slate-500"
          label="Start with system"
          description="Launch MoDo on login"
        >
          <Switch
            className={iosSwitchClass}
            checked={settings.autostart}
            disabled={autostartBusy}
            onCheckedChange={(c) => void handleAutostart(c)}
            aria-label="Toggle autostart"
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Data"
        footer="Backups include all notes, tasks, snippets, tags and settings as a single JSON file."
      >
        <SettingsButtonRow
          icon={<Download />}
          iconColor="bg-emerald-500"
          label="Export backup"
          description="Save all data as a JSON file"
          disabled={busy}
          onClick={() => void handleExport()}
        />
        <SettingsButtonRow
          icon={<Upload />}
          iconColor="bg-sky-500"
          label="Import backup"
          description="Replace all current data with a backup file"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        />
      </SettingsGroup>

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
    </div>
  );
}
