import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastVariant = "default" | "success" | "error" | "info" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastItem {
  id: string;
  message: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
  leaving: boolean;
}

const EXIT_MS = 260;
const MAX_KEPT = 8; // total kept in the stack
const COLLAPSED_VISIBLE = 3; // cards peeking when collapsed
const PEEK = 13; // px each back card peeks above the front one
const GAP = 10; // px gap between cards when expanded

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

function addToast(message: string, variant: ToastVariant, options?: ToastOptions) {
  const item: ToastItem = {
    id: crypto.randomUUID(),
    message,
    description: options?.description,
    variant,
    duration: options?.duration ?? (variant === "error" ? 5000 : 3500),
    action: options?.action,
    leaving: false,
  };
  toasts = [...toasts.slice(-(MAX_KEPT - 1)), item];
  emit();
  return item.id;
}

function dismissToast(id: string) {
  const target = toasts.find((t) => t.id === id);
  if (!target || target.leaving) return;
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, EXIT_MS);
}

export const toast = Object.assign(
  (message: string, options?: ToastOptions) => addToast(message, "default", options),
  {
    success: (message: string, options?: ToastOptions) => addToast(message, "success", options),
    error: (message: string, options?: ToastOptions) => addToast(message, "error", options),
    info: (message: string, options?: ToastOptions) => addToast(message, "info", options),
    warning: (message: string, options?: ToastOptions) => addToast(message, "warning", options),
    dismiss: dismissToast,
  },
);

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" />,
  error: <XCircle className="size-4.5 shrink-0 text-red-500" />,
  info: <Info className="size-4.5 shrink-0 text-sky-500" />,
  warning: <AlertTriangle className="size-4.5 shrink-0 text-amber-500" />,
};

interface CardProps {
  item: ToastItem;
  index: number; // 0 = newest (front of the stack)
  total: number;
  offset: number; // px to lift this card up from the anchor
  expanded: boolean;
  paused: boolean;
  reportHeight: (id: string, height: number) => void;
}

function ToastCard({ item, index, total, offset, expanded, paused, reportHeight }: CardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => {
    if (ref.current) reportHeight(item.id, ref.current.offsetHeight);
  });

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    if (paused || item.leaving) return;
    const timer = window.setTimeout(() => dismissToast(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [paused, item.leaving, item.id, item.duration]);

  const collapsedScale = expanded ? 1 : 1 - index * 0.06;
  const hidden = !expanded && index >= COLLAPSED_VISIBLE;

  let transform = `translateY(${-offset}px) scale(${collapsedScale})`;
  let opacity = hidden ? 0 : 1;
  if (!mounted) {
    transform = `translateY(${-offset + 18}px) scale(${collapsedScale})`;
    opacity = 0;
  } else if (item.leaving) {
    transform = `translateY(${-offset}px) translateX(28px) scale(${collapsedScale * 0.96})`;
    opacity = 0;
  }

  return (
    <div
      ref={ref}
      role="status"
      style={{
        transform,
        opacity,
        zIndex: total - index,
        transformOrigin: "bottom center",
        transition:
          "transform 380ms cubic-bezier(0.34, 1.3, 0.64, 1), opacity 240ms ease",
      }}
      className="group absolute inset-x-0 bottom-0 flex items-start gap-2.5 rounded-xl border bg-popover px-3.5 py-3 text-popover-foreground shadow-lg shadow-black/5 dark:shadow-black/20"
    >
      {variantIcon[item.variant]}
      <div className="min-w-0 flex-1 pt-px">
        <p className="text-[13px] font-medium leading-5">{item.message}</p>
        {item.description && (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.description}</p>
        )}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismissToast(item.id);
          }}
          className="shrink-0 self-center rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        className="absolute -left-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full border bg-popover text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

export function Toaster() {
  const items = React.useSyncExternalStore(subscribe, getSnapshot);
  const [hovered, setHovered] = React.useState(false);
  const [heights, setHeights] = React.useState<Record<string, number>>({});

  const reportHeight = React.useCallback((id: string, height: number) => {
    setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  // reset hover when the stack empties (mouseleave never fires on removed nodes)
  React.useEffect(() => {
    if (items.length === 0 && hovered) setHovered(false);
  }, [items.length, hovered]);

  React.useEffect(() => {
    setHeights((prev) => {
      const alive = new Set(items.map((t) => t.id));
      const keys = Object.keys(prev).filter((k) => alive.has(k));
      if (keys.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(keys.map((k) => [k, prev[k]]));
    });
  }, [items]);

  if (items.length === 0) return null;

  const ordered = [...items].reverse(); // newest first
  const expanded = hovered;

  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < ordered.length; i++) {
    offsets.push(expanded ? acc : Math.min(i, COLLAPSED_VISIBLE - 1) * PEEK);
    acc += (heights[ordered[i].id] ?? 0) + GAP;
  }

  const frontHeight = heights[ordered[0].id] ?? 0;
  const containerHeight = expanded
    ? Math.max(acc - GAP, frontHeight)
    : frontHeight + PEEK * (Math.min(ordered.length, COLLAPSED_VISIBLE) - 1);

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] w-full max-w-xs"
      style={{ height: containerHeight, transition: "height 380ms cubic-bezier(0.34, 1.3, 0.64, 1)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {ordered.map((item, index) => (
        <ToastCard
          key={item.id}
          item={item}
          index={index}
          total={ordered.length}
          offset={offsets[index]}
          expanded={expanded}
          paused={hovered}
          reportHeight={reportHeight}
        />
      ))}
    </div>
  );
}
