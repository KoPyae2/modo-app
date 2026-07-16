import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileText,
  Folder as FolderIcon,
  Hash,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTaskDueToday, isTaskOverdue } from "@/lib/dates";
import { useUiStore } from "@/stores/uiStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useNotesStore } from "@/stores/notesStore";
import { useSnippetsStore } from "@/stores/snippetsStore";
import { useTagsStore } from "@/stores/tagsStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NameColorDialog } from "@/components/NameColorDialog";
import type { AppView, Folder, Project, Tag } from "@/types";

function viewMatches(current: AppView, target: AppView): boolean {
  if (current.name !== target.name) return false;
  if (current.name === "tasks" && target.name === "tasks") {
    if (current.filter.kind !== target.filter.kind) return false;
    if (current.filter.kind === "project" && target.filter.kind === "project")
      return current.filter.projectId === target.filter.projectId;
    if (current.filter.kind === "tag" && target.filter.kind === "tag")
      return current.filter.tagId === target.filter.tagId;
    return true;
  }
  if (current.name === "notes" && target.name === "notes") {
    return (current.folderId ?? null) === (target.folderId ?? null);
  }
  return true;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  count?: number;
  onClick: () => void;
  trailing?: React.ReactNode;
}

function NavItem({ icon, label, active, collapsed, count, onClick, trailing }: NavItemProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-[background-color,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-primary/15",
        active
          ? "bg-primary/10 font-semibold text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-primary"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        collapsed && "justify-center px-1",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center transition-colors duration-150 [&_svg]:size-4",
          active ? "text-primary" : "text-muted-foreground group-hover/nav:text-foreground",
        )}
      >
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-left leading-5">{label}</span>
          {count !== undefined && count > 0 && (
            <span
              className={cn(
                "ml-1 min-w-5 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 tabular-nums transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground group-hover/nav:bg-secondary group-hover/nav:text-secondary-foreground",
              )}
            >
              {count}
            </span>
          )}
          {trailing}
        </>
      )}
      {collapsed && count !== undefined && count > 0 && (
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary ring-2 ring-card" />
      )}
    </button>
  );

  if (!collapsed) return button;
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {count !== undefined && count > 0 ? ` (${count})` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function SectionHeader({
  label,
  collapsed,
  onAdd,
  addLabel,
  open,
  onToggle,
  count,
}: {
  label: string;
  collapsed: boolean;
  onAdd?: () => void;
  addLabel?: string;
  open: boolean;
  onToggle: () => void;
  count: number;
}) {
  if (collapsed) return <div className="mx-2 my-3 h-px bg-border/70" />;
  return (
    <div className="mb-1 mt-4 flex items-center justify-between px-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group/section flex min-w-0 items-center gap-1 rounded text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="truncate">{label}</span>
        {!open && count > 0 && (
          <span className="ml-0.5 font-semibold normal-case tracking-normal">({count})</span>
        )}
      </button>
      {onAdd && (
        <Button
          variant="ghost"
          size="iconSm"
          className="size-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onAdd}
          aria-label={addLabel}
        >
          <Plus className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

type EditTarget =
  | { kind: "folder"; item: Folder }
  | { kind: "project"; item: Project }
  | { kind: "tag"; item: Tag }
  | { kind: "new-folder" }
  | { kind: "new-project" }
  | { kind: "new-tag" }
  | null;

export function Sidebar() {
  const view = useUiStore((s) => s.view);
  const navigate = useUiStore((s) => s.navigate);
  const navigateTasks = useUiStore((s) => s.navigateTasks);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  const tasks = useTasksStore((s) => s.tasks);
  const projects = useTasksStore((s) => s.projects);
  const { addProject, updateProject, deleteProject } = useTasksStore();
  const notes = useNotesStore((s) => s.notes);
  const folders = useNotesStore((s) => s.folders);
  const { addFolder, updateFolder, deleteFolder } = useNotesStore();
  const snippets = useSnippetsStore((s) => s.snippets);
  const tags = useTagsStore((s) => s.tags);
  const { addTag, updateTag, deleteTag } = useTagsStore();

  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  // ponytail: localStorage, not the settings table — purely cosmetic UI state
  const [openSections, setOpenSections] = useState<Record<"projects" | "folders" | "tags", boolean>>(() => {
    const defaults = { projects: true, folders: true, tags: true };
    try {
      const raw = localStorage.getItem("sidebar-open-sections");
      return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<typeof defaults>) } : defaults;
    } catch {
      return defaults;
    }
  });
  const toggleSection = (key: "projects" | "folders" | "tags") =>
    setOpenSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("sidebar-open-sections", JSON.stringify(next));
      return next;
    });

  const counts = useMemo(() => {
    const topLevelTasks = tasks.filter((t) => !t.parentTaskId && !t.isTrashed);
    const open = topLevelTasks.filter((t) => !t.isCompleted);
    const completed = topLevelTasks.filter((t) => t.isCompleted);
    const projectCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const folderCounts = new Map<string, number>();

    for (const task of open) {
      if (task.projectId) {
        projectCounts.set(task.projectId, (projectCounts.get(task.projectId) ?? 0) + 1);
      }
      for (const tagId of task.tagIds) {
        tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
      }
    }

    for (const note of notes.filter((n) => !n.isTrashed)) {
      if (note.folderId) {
        folderCounts.set(note.folderId, (folderCounts.get(note.folderId) ?? 0) + 1);
      }
    }

    return {
      today: open.filter((t) => isTaskDueToday(t) || isTaskOverdue(t)).length,
      upcoming: open.filter((t) => t.dueDate && !isTaskDueToday(t) && !isTaskOverdue(t)).length,
      all: open.length,
      completed: completed.length,
      notes: notes.filter((n) => !n.isTrashed).length,
      snippets: snippets.filter((s) => !s.isTrashed).length,
      projects: projectCounts,
      folders: folderCounts,
      tags: tagCounts,
    };
  }, [notes, snippets, tasks]);

  const itemMenu = (onEdit: () => void, onDelete: () => void) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-none rounded-lg p-1 text-muted-foreground opacity-0 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover/nav:pointer-events-auto group-hover/nav:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100"
          aria-label="More options"
        >
          <MoreHorizontal className="size-3.5" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-card/60 backdrop-blur-xl backdrop-saturate-150 transition-[width] duration-200 dark:bg-card/55",
        collapsed ? "w-14" : "w-64",
      )}
      aria-label="Sidebar navigation"
    >
      <div
        className={cn(
          "border-b px-3 py-2.5",
          collapsed ? "justify-center px-0" : "justify-between",
          "flex items-center",
        )}
      >
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2 px-0.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg">
              <img src="/app-icon.png" alt="" className="size-7 rounded-md" draggable={false} />
            </div>
            <div className="min-w-0 truncate text-sm font-semibold tracking-tight">MoDo</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="iconSm"
          className="rounded-lg hover:bg-muted hover:text-foreground"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2.5">
        <NavItem
          icon={<Search />}
          label="Search"
          collapsed={collapsed}
          active={false}
          onClick={() => setSearchOpen(true)}
        />
        <NavItem
          icon={<LayoutDashboard />}
          label="Dashboard"
          collapsed={collapsed}
          active={view.name === "dashboard"}
          onClick={() => navigate({ name: "dashboard" })}
        />
        <NavItem
          icon={<CalendarDays />}
          label="Calendar"
          collapsed={collapsed}
          active={view.name === "calendar"}
          onClick={() => navigate({ name: "calendar" })}
        />
        <NavItem
          icon={<Calendar />}
          label="Today"
          collapsed={collapsed}
          count={counts.today}
          active={viewMatches(view, { name: "tasks", filter: { kind: "today" } })}
          onClick={() => navigateTasks({ kind: "today" })}
        />
        <NavItem
          icon={<CalendarClock />}
          label="Upcoming"
          collapsed={collapsed}
          count={counts.upcoming}
          active={viewMatches(view, { name: "tasks", filter: { kind: "upcoming" } })}
          onClick={() => navigateTasks({ kind: "upcoming" })}
        />
        <NavItem
          icon={<ListTodo />}
          label="All Tasks"
          collapsed={collapsed}
          count={counts.all}
          active={viewMatches(view, { name: "tasks", filter: { kind: "all" } })}
          onClick={() => navigateTasks({ kind: "all" })}
        />
        <NavItem
          icon={<CheckCircle2 />}
          label="Completed"
          collapsed={collapsed}
          count={counts.completed}
          active={viewMatches(view, { name: "tasks", filter: { kind: "completed" } })}
          onClick={() => navigateTasks({ kind: "completed" })}
        />
        <NavItem
          icon={<FileText />}
          label="All Notes"
          collapsed={collapsed}
          count={counts.notes}
          active={view.name === "notes" && (view.folderId ?? null) === null}
          onClick={() => navigate({ name: "notes", folderId: null })}
        />
        <NavItem
          icon={<Code2 />}
          label="Snippets"
          collapsed={collapsed}
          count={counts.snippets}
          active={view.name === "snippets"}
          onClick={() => navigate({ name: "snippets" })}
        />
        <NavItem
          icon={<Zap />}
          label="Scratchpad"
          collapsed={collapsed}
          active={view.name === "scratchpad"}
          onClick={() => navigate({ name: "scratchpad" })}
        />

        <SectionHeader
          label="Projects"
          collapsed={collapsed}
          onAdd={() => setEditTarget({ kind: "new-project" })}
          addLabel="New project"
          open={openSections.projects}
          onToggle={() => toggleSection("projects")}
          count={projects.length}
        />
        {(collapsed || openSections.projects) && projects.map((project) => (
          <NavItem
            key={project.id}
            icon={<span className="block size-2.5 rounded-full" style={{ backgroundColor: project.color }} />}
            label={project.name}
            collapsed={collapsed}
            count={counts.projects.get(project.id)}
            active={viewMatches(view, {
              name: "tasks",
              filter: { kind: "project", projectId: project.id },
            })}
            onClick={() => navigateTasks({ kind: "project", projectId: project.id })}
            trailing={itemMenu(
              () => setEditTarget({ kind: "project", item: project }),
              async () => {
                const ok = await requestConfirm({
                  title: `Delete project "${project.name}"?`,
                  description: "Tasks in this project will be kept without a project.",
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (ok) void deleteProject(project.id);
              },
            )}
          />
        ))}

        <SectionHeader
          label="Folders"
          collapsed={collapsed}
          onAdd={() => setEditTarget({ kind: "new-folder" })}
          addLabel="New folder"
          open={openSections.folders}
          onToggle={() => toggleSection("folders")}
          count={folders.length}
        />
        {(collapsed || openSections.folders) && folders.map((folder) => (
          <NavItem
            key={folder.id}
            icon={<FolderIcon style={{ color: folder.color }} />}
            label={folder.name}
            collapsed={collapsed}
            count={counts.folders.get(folder.id)}
            active={view.name === "notes" && view.folderId === folder.id}
            onClick={() => navigate({ name: "notes", folderId: folder.id })}
            trailing={itemMenu(
              () => setEditTarget({ kind: "folder", item: folder }),
              async () => {
                const ok = await requestConfirm({
                  title: `Delete folder "${folder.name}"?`,
                  description: "Notes inside will be kept without a folder.",
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (ok) void deleteFolder(folder.id);
              },
            )}
          />
        ))}

        <SectionHeader
          label="Tags"
          collapsed={collapsed}
          onAdd={() => setEditTarget({ kind: "new-tag" })}
          addLabel="New tag"
          open={openSections.tags}
          onToggle={() => toggleSection("tags")}
          count={tags.length}
        />
        {(collapsed || openSections.tags) && tags.map((tag) => (
          <NavItem
            key={tag.id}
            icon={<Hash style={{ color: tag.color }} />}
            label={tag.name}
            collapsed={collapsed}
            count={counts.tags.get(tag.id)}
            active={viewMatches(view, { name: "tasks", filter: { kind: "tag", tagId: tag.id } })}
            onClick={() => navigateTasks({ kind: "tag", tagId: tag.id })}
            trailing={itemMenu(
              () => setEditTarget({ kind: "tag", item: tag }),
              async () => {
                const ok = await requestConfirm({
                  title: `Delete tag "${tag.name}"?`,
                  description: "The tag will be removed from all notes and tasks.",
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (ok) void deleteTag(tag.id);
              },
            )}
          />
        ))}
      </nav>

      <NameColorDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title={
          editTarget?.kind === "new-project"
            ? "New Project"
            : editTarget?.kind === "new-folder"
              ? "New Folder"
              : editTarget?.kind === "new-tag"
                ? "New Tag"
                : editTarget?.kind === "project"
                  ? "Edit Project"
                  : editTarget?.kind === "folder"
                    ? "Edit Folder"
                    : "Edit Tag"
        }
        initialName={
          editTarget && "item" in editTarget ? editTarget.item.name : ""
        }
        initialColor={
          editTarget && "item" in editTarget ? editTarget.item.color : undefined
        }
        onSubmit={(name, color) => {
          if (!editTarget) return;
          switch (editTarget.kind) {
            case "new-project":
              void addProject(name, color);
              break;
            case "new-folder":
              void addFolder(name, color);
              break;
            case "new-tag":
              void addTag(name, color);
              break;
            case "project":
              void updateProject({ ...editTarget.item, name, color });
              break;
            case "folder":
              void updateFolder({ ...editTarget.item, name, color });
              break;
            case "tag":
              void updateTag({ ...editTarget.item, name, color });
              break;
          }
        }}
      />
    </aside>
  );
}
