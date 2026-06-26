import { Toaster as SonnerToaster } from "sonner";
import { cn } from "@/lib/utils";

/**
 * App-wide toast host. The app is light-only today (no theme toggle), so this is
 * pinned to light and styled entirely from design tokens. Mounted once in
 * main.tsx; call `toast.success(...)` / `toast.error(...)` from anywhere.
 */
export function Toaster({ className }: { className?: string }) {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast border-border bg-popover text-popover-foreground shadow-lg",
            className,
          ),
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  );
}

export { toast } from "sonner";
