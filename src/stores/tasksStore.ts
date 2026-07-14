import { create } from "zustand";
import { toast } from "sonner";
import { tasksRepo, type NewTaskInput } from "@/lib/db/tasksRepo";
import { projectsRepo } from "@/lib/db/collectionsRepo";
import { nextOccurrence } from "@/lib/recurrence";
import { isTaskOverdue, todayStr } from "@/lib/dates";
import { nowIso } from "@/lib/utils";
import type { Project, Task } from "@/types";

interface TasksState {
  tasks: Task[];
  trashedTasks: Task[];
  projects: Project[];
  loaded: boolean;

  load: () => Promise<void>;
  loadTrash: () => Promise<void>;

  addTask: (input: NewTaskInput) => Promise<Task | null>;
  updateTask: (task: Task) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  moveManyToTrash: (ids: string[]) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  restoreManyTasks: (ids: string[]) => Promise<void>;
  deleteTaskPermanently: (id: string) => Promise<void>;
  deleteManyTasksPermanently: (ids: string[]) => Promise<void>;
  reorderTasks: (orderedIds: string[]) => Promise<void>;
  rescheduleOverdueToToday: () => Promise<void>;

  addProject: (name: string, color: string) => Promise<Project | null>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  trashedTasks: [],
  projects: [],
  loaded: false,

  load: async () => {
    const [tasks, projects] = await Promise.all([
      tasksRepo.getAll(),
      projectsRepo.getAll(),
    ]);
    set({ tasks, projects, loaded: true });
  },

  loadTrash: async () => {
    set({ trashedTasks: await tasksRepo.getTrashed() });
  },

  addTask: async (input) => {
    try {
      const task = await tasksRepo.create(input);
      set((s) => ({ tasks: [...s.tasks, task] }));
      return task;
    } catch (err) {
      console.error(err);
      toast.error("Failed to create task");
      return null;
    }
  },

  updateTask: async (task) => {
    const prev = get().tasks;
    const updated = { ...task, updatedAt: nowIso() };
    set({ tasks: prev.map((t) => (t.id === task.id ? updated : t)) });
    try {
      await tasksRepo.update(updated);
    } catch (err) {
      set({ tasks: prev });
      console.error(err);
      toast.error("Failed to update task");
    }
  },

  /**
   * Complete/uncomplete. Completing a recurring task also spawns the next
   * occurrence (with fresh, unchecked subtasks copied from this one).
   */
  toggleComplete: async (id) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    const completing = !task.isCompleted;
    const updated: Task = {
      ...task,
      isCompleted: completing,
      completedAt: completing ? nowIso() : null,
      updatedAt: nowIso(),
    };
    set({ tasks: state.tasks.map((t) => (t.id === id ? updated : t)) });

    try {
      await tasksRepo.update(updated);

      if (completing && task.recurrenceRule && !task.parentTaskId) {
        const next = await tasksRepo.create({
          title: task.title,
          description: task.description,
          dueDate: nextOccurrence(task.recurrenceRule, task.dueDate),
          dueTime: task.dueTime,
          priority: task.priority,
          projectId: task.projectId,
          recurrenceRule: task.recurrenceRule,
          reminderOffsetMin: task.reminderOffsetMin,
          tagIds: task.tagIds,
        });
        const subtasks = get().tasks.filter((t) => t.parentTaskId === id);
        const newSubs: Task[] = [];
        for (const sub of subtasks) {
          const created = await tasksRepo.create({
            title: sub.title,
            parentTaskId: next.id,
          });
          newSubs.push(created);
        }
        set((s) => ({ tasks: [...s.tasks, next, ...newSubs] }));
        toast.success("Recurring task rescheduled", {
          description: `Next: ${next.dueDate}`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task");
      void get().load();
    }
  },

  moveToTrash: async (id) => {
    const prev = get().tasks;
    set({ tasks: prev.filter((t) => t.id !== id && t.parentTaskId !== id) });
    try {
      await tasksRepo.moveToTrash(id);
      toast.success("Task moved to trash");
    } catch (err) {
      set({ tasks: prev });
      console.error(err);
      toast.error("Failed to delete task");
    }
  },

  moveManyToTrash: async (ids) => {
    if (ids.length === 0) return;
    const prev = get().tasks;
    const idSet = new Set(ids);
    set({
      tasks: prev.filter(
        (t) => !idSet.has(t.id) && !(t.parentTaskId && idSet.has(t.parentTaskId)),
      ),
    });
    try {
      for (const id of ids) await tasksRepo.moveToTrash(id);
      toast.success(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} moved to trash`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete tasks");
      void get().load();
    }
  },

  restoreTask: async (id) => {
    try {
      await tasksRepo.restore(id);
      await Promise.all([get().load(), get().loadTrash()]);
      toast.success("Task restored");
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore task");
    }
  },

  restoreManyTasks: async (ids) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await tasksRepo.restore(id);
      await Promise.all([get().load(), get().loadTrash()]);
      toast.success(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} restored`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore tasks");
      void get().loadTrash();
    }
  },

  deleteTaskPermanently: async (id) => {
    try {
      await tasksRepo.deletePermanently(id);
      set((s) => ({
        trashedTasks: s.trashedTasks.filter(
          (t) => t.id !== id && t.parentTaskId !== id,
        ),
      }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete task");
    }
  },

  deleteManyTasksPermanently: async (ids) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await tasksRepo.deletePermanently(id);
      const idSet = new Set(ids);
      set((s) => ({
        trashedTasks: s.trashedTasks.filter(
          (t) => !idSet.has(t.id) && !(t.parentTaskId && idSet.has(t.parentTaskId)),
        ),
      }));
      toast.success(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} deleted forever`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete tasks");
      void get().loadTrash();
    }
  },

  /** Persist a new manual order for the given id sequence. */
  reorderTasks: async (orderedIds) => {
    const prev = get().tasks;
    const orderedIdSet = new Set(orderedIds);
    const topLevel = [...prev]
      .filter((t) => !t.parentTaskId)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
      );
    const orderedTasksById = new Map(prev.map((task) => [task.id, task]));
    const topLevelIdSet = new Set(topLevel.map((task) => task.id));
    if (
      orderedIdSet.size !== orderedIds.length ||
      orderedIds.some((id) => !orderedTasksById.has(id) || !topLevelIdSet.has(id))
    ) {
      return;
    }

    const reorderedIds = [...orderedIds];
    const fullOrder = topLevel.map((task) =>
      orderedIdSet.has(task.id)
        ? orderedTasksById.get(reorderedIds.shift() as string)!
        : task,
    );
    const orderMap = new Map(fullOrder.map((task, i) => [task.id, i + 1]));
    const updatedTasks = prev.map((t) =>
      orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t,
    );
    set({ tasks: updatedTasks });
    try {
      await tasksRepo.setSortOrders(
        fullOrder.map((task, i) => ({ id: task.id, sortOrder: i + 1 })),
      );
    } catch (err) {
      set({ tasks: prev });
      console.error(err);
      toast.error("Failed to reorder tasks");
    }
  },

  rescheduleOverdueToToday: async () => {
    const overdue = get().tasks.filter(
      (t) => isTaskOverdue(t) && !t.parentTaskId,
    );
    if (overdue.length === 0) return;
    const today = todayStr();
    for (const task of overdue) {
      await get().updateTask({ ...task, dueDate: today });
    }
    toast.success(
      `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"} moved to today`,
    );
  },

  addProject: async (name, color) => {
    try {
      const project = await projectsRepo.create(name, color);
      set((s) => ({ projects: [...s.projects, project] }));
      return project;
    } catch (err) {
      console.error(err);
      toast.error("Failed to create project");
      return null;
    }
  },

  updateProject: async (project) => {
    const prev = get().projects;
    set({ projects: prev.map((p) => (p.id === project.id ? project : p)) });
    try {
      await projectsRepo.update(project);
    } catch (err) {
      set({ projects: prev });
      console.error(err);
      toast.error("Failed to update project");
    }
  },

  deleteProject: async (id) => {
    const prev = get().projects;
    set({ projects: prev.filter((p) => p.id !== id) });
    try {
      await projectsRepo.delete(id);
      // Tasks keep existing with project cleared (FK SET NULL); refresh
      await get().load();
    } catch (err) {
      set({ projects: prev });
      console.error(err);
      toast.error("Failed to delete project");
    }
  },
}));
