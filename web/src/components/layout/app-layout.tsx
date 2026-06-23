import { useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { signOut, useSession } from "@/lib/auth";
import { Button } from "@/components/ui";

export function AppLayout() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    // useSession() resets reactively on success; navigate to the login page.
    await signOut({ fetchOptions: { onSuccess: () => navigate("/login") } });
    setSigningOut(false);
  }

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
            {session?.user?.role === "admin" && (
              <Link to="/users" className="hover:text-foreground">
                Users
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {session ? (
              <>
                <span className="text-sm font-medium text-foreground">{session.user.name}</span>
                <Button variant="outline" size="sm" onClick={onSignOut} disabled={signingOut}>
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
