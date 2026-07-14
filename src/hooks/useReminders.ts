import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { taskDueAt } from "@/lib/dates";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTasksStore } from "@/stores/tasksStore";

const CHECK_INTERVAL_MS = 30_000;
const FIRED_KEY = "notetodo.firedReminders";

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveFired(fired: Set<string>) {
  // Keep the set bounded
  localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-500)));
}

/**
 * Polls open tasks and fires desktop notifications at the pre-reminder
 * offset and at the due time. Fired reminders are deduped in localStorage.
 */
export function useReminders() {
  const firedRef = useRef<Set<string>>(loadFired());
  const permissionRef = useRef<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const ensurePermission = async (): Promise<boolean> => {
      if (permissionRef.current !== null) return permissionRef.current;
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === "granted";
      }
      permissionRef.current = granted;
      return granted;
    };

    const check = async () => {
      const { settings } = useSettingsStore.getState();
      if (!settings.notificationsEnabled) return;
      const { tasks } = useTasksStore.getState();
      const now = Date.now();
      const fired = firedRef.current;
      let changed = false;

      for (const task of tasks) {
        if (task.isCompleted || task.parentTaskId || !task.dueDate || !task.dueTime)
          continue;
        const due = taskDueAt(task);
        if (!due) continue;
        const dueMs = due.getTime();

        const points: { key: string; at: number; title: string; body: string }[] = [];
        const preOffset = task.reminderOffsetMin ?? settings.preReminderMin;
        if (preOffset > 0) {
          points.push({
            key: `${task.id}:${task.dueDate}:${task.dueTime}:pre`,
            at: dueMs - preOffset * 60_000,
            title: "Upcoming task",
            body: `"${task.title}" is due in ${preOffset} min`,
          });
        }
        points.push({
          key: `${task.id}:${task.dueDate}:${task.dueTime}:due`,
          at: dueMs,
          title: "Task due now",
          body: task.title,
        });

        for (const point of points) {
          // Fire when the point has passed within the last 10 minutes (missed-window grace)
          if (
            now >= point.at &&
            now - point.at < 10 * 60_000 &&
            !fired.has(point.key)
          ) {
            if (!(await ensurePermission()) || cancelled) return;
            sendNotification({ title: point.title, body: point.body });
            fired.add(point.key);
            changed = true;
          }
        }
      }
      if (changed) saveFired(fired);
    };

    void check();
    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
