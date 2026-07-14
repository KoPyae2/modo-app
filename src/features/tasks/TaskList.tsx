import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useTasksStore } from "@/stores/tasksStore";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/types";

interface TaskListProps {
  tasks: Task[];
  /** Manual-sort mode enables drag & drop reordering */
  sortable?: boolean;
  /** Selection mode: rows toggle selection instead of opening/completing */
  selectedIds?: Set<string>;
  onSelectToggle?: (id: string) => void;
  onSelectSweep?: (id: string) => void;
}

export function TaskList({ tasks, sortable = false, selectedIds, onSelectToggle, onSelectSweep }: TaskListProps) {
  const reorderTasks = useTasksStore((s) => s.reorderTasks);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void reorderTasks(ids);
  };

  if (!sortable || onSelectToggle) {
    return (
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            selected={selectedIds?.has(task.id)}
            onSelectToggle={onSelectToggle}
            onSelectSweep={onSelectSweep}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} draggable />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
