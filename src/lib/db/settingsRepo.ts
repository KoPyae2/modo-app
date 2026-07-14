import { getDb } from "./client";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types";

function normalizeSettings(stored: Record<string, unknown>): AppSettings {
  const theme = stored.theme;
  const defaultView = stored.defaultView;
  const preReminderMin = stored.preReminderMin;
  const editorFontSize = stored.editorFontSize;
  const weekStartsOn = stored.weekStartsOn;

  return {
    theme:
      theme === "light" || theme === "dark" || theme === "system"
        ? theme
        : DEFAULT_SETTINGS.theme,
    defaultView:
      defaultView === "dashboard" ||
      defaultView === "tasks" ||
      defaultView === "notes"
        ? defaultView
        : DEFAULT_SETTINGS.defaultView,
    notificationsEnabled:
      typeof stored.notificationsEnabled === "boolean"
        ? stored.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    preReminderMin:
      typeof preReminderMin === "number" &&
      Number.isFinite(preReminderMin) &&
      preReminderMin >= 0 &&
      preReminderMin <= 1440
        ? preReminderMin
        : DEFAULT_SETTINGS.preReminderMin,
    editorFontSize:
      typeof editorFontSize === "number" &&
      Number.isFinite(editorFontSize) &&
      editorFontSize >= 12 &&
      editorFontSize <= 28
        ? editorFontSize
        : DEFAULT_SETTINGS.editorFontSize,
    weekStartsOn:
      weekStartsOn === 0 || weekStartsOn === 1
        ? weekStartsOn
        : DEFAULT_SETTINGS.weekStartsOn,
    autostart:
      typeof stored.autostart === "boolean"
        ? stored.autostart
        : DEFAULT_SETTINGS.autostart,
  };
}

export const settingsRepo = {
  async getAll(): Promise<AppSettings> {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings",
    );
    const stored: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        // ignore malformed values, defaults apply
      }
    }
    return normalizeSettings(stored);
  },

  async set<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = $2`,
      [key, JSON.stringify(value)],
    );
  },
};
