import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Maximize2, Minus, Settings, Square, Trash2, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

type TauriWindow = ReturnType<typeof getCurrentWindow>;

function getAppWindow(): TauriWindow | null {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

async function runWindowAction(action: (appWindow: TauriWindow) => Promise<void>) {
  const appWindow = getAppWindow();
  if (!appWindow) return;
  try {
    await action(appWindow);
  } catch (error) {
    console.warn("Window action failed", error);
  }
}

export function AppTitleBar() {
  const [maximized, setMaximized] = useState(false);
  const view = useUiStore((s) => s.view);
  const navigate = useUiStore((s) => s.navigate);

  useEffect(() => {
    let disposed = false;
    let unlistenResize: (() => void) | undefined;

    const syncMaximized = async () => {
      const appWindow = getAppWindow();
      if (!appWindow) return;
      try {
        const next = await appWindow.isMaximized();
        if (!disposed) setMaximized(next);
      } catch {
        if (!disposed) setMaximized(false);
      }
    };

    const appWindow = getAppWindow();
    if (!appWindow) return undefined;

    void syncMaximized();
    void appWindow.onResized(() => {
      void syncMaximized();
    }).then((unlisten) => {
      unlistenResize = unlisten;
    }).catch(() => undefined);

    return () => {
      disposed = true;
      unlistenResize?.();
    };
  }, []);

  const toggleMaximize = async () => {
    await runWindowAction((appWindow) => appWindow.toggleMaximize());
    const appWindow = getAppWindow();
    if (!appWindow) return;
    try {
      setMaximized(await appWindow.isMaximized());
    } catch {
      setMaximized((value) => !value);
    }
  };

  const startDragging = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1) return;
    void runWindowAction((appWindow) => appWindow.startDragging());
  };

  return (
    <header
      className="app-titlebar flex h-10 shrink-0 select-none items-center border-b bg-card/60 text-foreground backdrop-blur-xl backdrop-saturate-150 dark:bg-card/55"
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
        onMouseDown={startDragging}
        onDoubleClick={() => void toggleMaximize()}
      >
        <span className="truncate text-sm font-semibold tracking-tight">MoDo</span>
        <span className="h-1.5 w-1.5 rounded-full bg-primary/75" />
      </div>

      <div className="flex h-full items-center">
        <TitleBarButton
          label="Trash"
          active={view.name === "trash"}
          onClick={() => navigate({ name: "trash" })}
        >
          <Trash2 className="size-4" />
        </TitleBarButton>
        <TitleBarButton
          label="Settings"
          active={view.name === "settings"}
          onClick={() => navigate({ name: "settings" })}
        >
          <Settings className="size-4" />
        </TitleBarButton>
        <div className="mx-1.5 h-4 w-px shrink-0 bg-border" />
        <TitleBarButton
          label="Minimize"
          onClick={() => void runWindowAction((appWindow) => appWindow.minimize())}
        >
          <Minus className="size-4" />
        </TitleBarButton>
        <TitleBarButton label={maximized ? "Restore" : "Maximize"} onClick={() => void toggleMaximize()}>
          {maximized ? <Square className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </TitleBarButton>
        <TitleBarButton
          label="Close"
          danger
          onClick={() => void runWindowAction((appWindow) => appWindow.close())}
        >
          <X className="size-4" />
        </TitleBarButton>
      </div>
    </header>
  );
}

function TitleBarButton({
  label,
  danger,
  active,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid h-10 w-11 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        danger && "hover:bg-destructive hover:text-destructive-foreground",
        active && "bg-accent/70 text-foreground",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {children}
    </button>
  );
}
