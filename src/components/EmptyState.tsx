import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[clamp(360px,calc(100vh-16rem),640px)] w-full items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-7" />
        </div>
        <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {actionLabel && onAction && (
          <Button size="sm" onClick={onAction} className="mt-5">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
