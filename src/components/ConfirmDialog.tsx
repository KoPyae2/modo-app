import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Global confirm dialog, driven by uiStore.requestConfirm(). */
export function ConfirmDialog() {
  const confirm = useUiStore((s) => s.confirm);
  const resolveConfirm = useUiStore((s) => s.resolveConfirm);

  return (
    <Dialog
      open={confirm.open}
      onOpenChange={(open) => {
        if (!open) resolveConfirm(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="items-start">
          <div className="mb-1 flex items-center gap-3">
            <span
              className={
                confirm.destructive
                  ? "grid size-10 place-items-center rounded-2xl bg-destructive/10 text-destructive"
                  : "grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"
              }
            >
              {confirm.destructive ? (
                <AlertTriangle className="size-5" />
              ) : (
                <CheckCircle2 className="size-5" />
              )}
            </span>
            <DialogTitle>{confirm.title}</DialogTitle>
          </div>
          <DialogDescription className="pl-[52px]">{confirm.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => resolveConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant={confirm.destructive ? "destructive" : "default"}
            onClick={() => resolveConfirm(true)}
            autoFocus
          >
            {confirm.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
