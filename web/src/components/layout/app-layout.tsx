import { Outlet, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Ticketly
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Dashboard
            </Link>
          </nav>
          <div className="ml-auto">
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
