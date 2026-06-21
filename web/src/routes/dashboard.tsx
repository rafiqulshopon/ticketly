import { Button } from "@/components/ui/button";

export function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button>New ticket</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        The ticket list, filters, and metrics land here in Phase 2 / Phase 6.
      </p>
    </div>
  );
}
